import json
import logging
import math
from datetime import datetime, timezone
from typing import Any

import requests
from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.config import settings
from app.core.security import require_role
from app.models.user import User
from app.schemas.wialon import (
    FleetResponse,
    MessageHistoryResponse,
    SensorValue,
    TelemetryPoint,
    WialonReportOptions,
    WialonReportRequest,
    WialonReportResponse,
    WialonReportTable,
    WialonReportTemplate,
    WialonTarget,
    WialonUnit,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/wialon", tags=["wialon"])

UNIT_FLAGS = 0x00000001 | 0x00000002 | 0x00000400 | 0x00001000 | 0x00002000
MESSAGE_DATA_FLAGS_MASK = 0xFF00
HISTORY_MAX_SECONDS = 31 * 24 * 60 * 60
HISTORY_MAX_MESSAGES = 2000
REPORT_MAX_SECONDS = 31 * 24 * 60 * 60
REPORT_MAX_ROWS_PER_TABLE = 2500
REPORT_MAX_ROWS_TOTAL = 5000
STALE_UNIT_SECONDS = 24 * 60 * 60


class WialonApiError(RuntimeError):
    def __init__(self, service: str, message: str) -> None:
        super().__init__(message)
        self.service = service


class WialonClient:
    def __init__(self, base_url: str, token: str) -> None:
        self.base_url = base_url
        self.token = token
        self.http = requests.Session()
        self.sid: str | None = None

    def call_raw(self, service: str, params: dict[str, Any]) -> Any:
        data = {"svc": service, "params": json.dumps(params)}
        if self.sid is not None:
            data["sid"] = self.sid

        try:
            response = self.http.post(self.base_url, data=data, timeout=(10, 45))
            response.raise_for_status()
            result = response.json()
        except ValueError as exc:
            raise WialonApiError(service, "Wialon returned invalid JSON.") from exc
        except requests.RequestException as exc:
            raise WialonApiError(service, "Could not reach Wialon.") from exc

        return result

    def call(self, service: str, params: dict[str, Any]) -> dict[str, Any]:
        result = self.call_raw(service, params)
        if not isinstance(result, dict):
            raise WialonApiError(service, "Wialon returned an unexpected response.")
        if "error" in result:
            raise WialonApiError(service, f"Wialon API error code {result['error']}.")
        return result

    def login(self) -> None:
        result = self.call("token/login", {"token": self.token})
        sid = result.get("eid")
        if not isinstance(sid, str) or not sid:
            raise WialonApiError("token/login", "Login response did not include a session.")
        self.sid = sid

    def list_units(self) -> list[dict[str, Any]]:
        result = self.call(
            "core/search_items",
            {
                "spec": {
                    "itemsType": "avl_unit",
                    "propName": "sys_name",
                    "propValueMask": "*",
                    "sortType": "sys_name",
                },
                "force": 1,
                "flags": UNIT_FLAGS,
                "from": 0,
                "to": 0,
            },
        )
        units = result.get("items")
        if not isinstance(units, list) or any(not isinstance(item, dict) for item in units):
            raise WialonApiError("core/search_items", "Invalid units response.")
        if any(not isinstance(item.get("id"), int) for item in units):
            raise WialonApiError("core/search_items", "A unit has an invalid ID.")
        return units

    def list_unit_groups(self) -> list[dict[str, Any]]:
        result = self.call(
            "core/search_items",
            {
                "spec": {
                    "itemsType": "avl_unit_group",
                    "propName": "sys_name",
                    "propValueMask": "*",
                    "sortType": "sys_name",
                },
                "force": 1,
                "flags": 1,
                "from": 0,
                "to": 0,
            },
        )
        groups = result.get("items")
        if not isinstance(groups, list) or any(not isinstance(item, dict) for item in groups):
            raise WialonApiError("core/search_items", "Invalid unit groups response.")
        return groups

    def list_report_resources(self) -> list[dict[str, Any]]:
        result = self.call(
            "core/search_items",
            {
                "spec": {
                    "itemsType": "avl_resource",
                    "propName": "sys_name",
                    "propValueMask": "*",
                    "sortType": "sys_name",
                },
                "force": 1,
                "flags": 0x2001,
                "from": 0,
                "to": 0,
            },
        )
        resources = result.get("items")
        if not isinstance(resources, list) or any(
            not isinstance(item, dict) for item in resources
        ):
            raise WialonApiError("core/search_items", "Invalid report resources response.")
        return resources

    def get_unit(self, unit_id: int) -> dict[str, Any]:
        result = self.call("core/search_item", {"id": unit_id, "flags": 0x1001})
        unit = result.get("item")
        if not isinstance(unit, dict):
            raise WialonApiError("core/search_item", "Unit was not found.")
        return unit

    def load_messages(
        self, unit_id: int, time_from: int, time_to: int
    ) -> tuple[int, list[dict[str, Any]]]:
        result = self.call(
            "messages/load_interval",
            {
                "itemId": unit_id,
                "timeFrom": time_from,
                "timeTo": time_to,
                "flags": 0,
                "flagsMask": MESSAGE_DATA_FLAGS_MASK,
                "loadCount": HISTORY_MAX_MESSAGES,
            },
        )
        messages = result.get("messages")
        if not isinstance(messages, list) or any(
            not isinstance(message, dict) for message in messages
        ):
            raise WialonApiError("messages/load_interval", "Invalid messages response.")
        count = result.get("count", len(messages))
        if not isinstance(count, int) or count < 0:
            raise WialonApiError("messages/load_interval", "Invalid messages count.")
        return count, messages

    def close(self) -> None:
        try:
            if self.sid is not None:
                self.call("core/logout", {})
                self.sid = None
        except WialonApiError:
            logger.warning("Wialon session logout failed.", exc_info=True)
        finally:
            self.http.close()


def _client() -> WialonClient:
    token = settings.WIALON_TOKEN
    if token is None or not token.get_secret_value().strip():
        raise HTTPException(
            status_code=503,
            detail="Wialon integration is not configured on the server.",
        )
    return WialonClient(settings.WIALON_BASE_URL, token.get_secret_value())


def _number(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _message_time(message: dict[str, Any]) -> datetime | None:
    timestamp = _number(message.get("t"))
    if timestamp is None:
        return None
    try:
        return datetime.fromtimestamp(timestamp, tz=timezone.utc)
    except (OSError, OverflowError, ValueError):
        return None


def _sensor_names(unit: dict[str, Any]) -> dict[str, str]:
    sensors = unit.get("sens")
    if not isinstance(sensors, dict):
        return {}
    return {
        str(sensor.get("p")): str(sensor.get("n"))
        for sensor in sensors.values()
        if isinstance(sensor, dict) and sensor.get("p") and sensor.get("n")
    }


def _metric(params: dict[str, Any], names: set[str]) -> float | None:
    for key, value in params.items():
        if str(key).lower() in names:
            number = _number(value)
            if number is not None:
                return number
    return None


def _telemetry_point(
    message: dict[str, Any],
    sensor_names: dict[str, str],
    *,
    distance_factor: float = 1.0,
) -> TelemetryPoint:
    position = message.get("pos")
    if not isinstance(position, dict):
        position = {}
    params = message.get("p")
    if not isinstance(params, dict):
        params = {}

    speed = _number(position.get("s"))
    mileage = _metric(params, {"mileage", "odometer", "counter_mileage"})
    sensors = [
        SensorValue(key=str(key), name=sensor_names.get(str(key), str(key)), value=value)
        for key, value in params.items()
    ]
    return TelemetryPoint(
        message_time=_message_time(message),
        latitude=_number(position.get("y")),
        longitude=_number(position.get("x")),
        speed_kmh=speed * distance_factor if speed is not None else None,
        mileage=mileage * distance_factor if mileage is not None else None,
        engine_hours=_metric(
            params, {"engine_hours", "enginehours", "ah", "motor_hours", "motohours"}
        ),
        sensors=sensors,
    )


def _unit_payload(unit: dict[str, Any]) -> WialonUnit:
    message = unit.get("lmsg")
    if not isinstance(message, dict):
        message = {}
    if not message.get("pos") and isinstance(unit.get("pos"), dict):
        message = {**message, "pos": unit["pos"]}

    distance_factor = 1.609344 if unit.get("mu") in (1, 2) else 1.0
    point = _telemetry_point(
        message, _sensor_names(unit), distance_factor=distance_factor
    )
    mileage_counter = _number(unit.get("cnm_km"))
    if mileage_counter is None:
        mileage_counter = _number(unit.get("cnm"))
        if mileage_counter is not None:
            mileage_counter *= distance_factor
    if mileage_counter is not None:
        point.mileage = mileage_counter
    if point.engine_hours is None:
        point.engine_hours = _number(unit.get("cneh"))
    if point.message_time is None and isinstance(unit.get("pos"), dict):
        point.message_time = _message_time({"t": unit["pos"].get("t")})

    if (
        point.message_time is None
        or point.latitude is None
        or point.longitude is None
        or point.speed_kmh is None
    ):
        status = "no_data"
    elif (
        datetime.now(timezone.utc) - point.message_time
    ).total_seconds() > STALE_UNIT_SECONDS:
        status = "stale"
    elif point.speed_kmh > 0:
        status = "moving"
    else:
        status = "stopped"

    properties = unit.get("prp")
    if not isinstance(properties, dict):
        properties = {}
    unit_type = unit.get("unit_type") or properties.get("unit_type")
    return WialonUnit(
        id=int(unit["id"]),
        name=str(unit.get("nm") or f"Unit {unit['id']}"),
        unit_type=str(unit_type) if unit_type else None,
        groups=[],
        status=status,
        raw_sensors=message.get("p") if isinstance(message.get("p"), dict) else {},
        **point.model_dump(),
    )


@router.get("/units", response_model=FleetResponse)
def get_fleet_units(
    current_user: User = Depends(
        require_role("admin", "gsm", "operator", "master", "management")
    ),
):
    del current_user
    client = _client()
    try:
        client.login()
        units = client.list_units()
        groups = client.list_unit_groups()
        group_names_by_unit: dict[int, list[str]] = {}
        for group in groups:
            group_name = str(group.get("nm") or "")
            members = group.get("u")
            if not isinstance(members, list):
                continue
            for unit_id in members:
                if isinstance(unit_id, int):
                    group_names_by_unit.setdefault(unit_id, []).append(group_name)
        records = [_unit_payload(unit) for unit in units]
        for record in records:
            record.groups = group_names_by_unit.get(record.id, [])
    except WialonApiError as exc:
        logger.warning("Wialon request failed for %s: %s", exc.service, exc)
        raise HTTPException(
            status_code=502,
            detail=f"Could not load fleet data from Wialon ({exc.service}).",
        ) from exc
    finally:
        client.close()
    return FleetResponse(
        updated_at=datetime.now(timezone.utc),
        unit_count=len(records),
        units=records,
    )


@router.get("/units/{unit_id}/messages", response_model=MessageHistoryResponse)
def get_unit_message_history(
    unit_id: int,
    from_ts: int = Query(ge=0),
    to_ts: int = Query(ge=0),
    current_user: User = Depends(
        require_role("admin", "gsm", "operator", "master", "management")
    ),
):
    del current_user
    if to_ts <= from_ts:
        raise HTTPException(status_code=422, detail="to_ts must be later than from_ts.")
    if to_ts - from_ts > HISTORY_MAX_SECONDS:
        raise HTTPException(status_code=422, detail="History range cannot exceed 31 days.")

    client = _client()
    try:
        client.login()
        unit = client.get_unit(unit_id)
        total_count, messages = client.load_messages(unit_id, from_ts, to_ts)
        sensor_names = _sensor_names(unit)
        distance_factor = 1.609344 if unit.get("mu") in (1, 2) else 1.0
        records = [
            _telemetry_point(
                message, sensor_names, distance_factor=distance_factor
            )
            for message in messages
        ]
    except WialonApiError as exc:
        logger.warning("Wialon request failed for %s: %s", exc.service, exc)
        raise HTTPException(
            status_code=502,
            detail=f"Could not load Wialon message history ({exc.service}).",
        ) from exc
    finally:
        client.close()

    return MessageHistoryResponse(
        unit_id=unit_id,
        unit_name=str(unit.get("nm") or f"Unit {unit_id}"),
        total_count=total_count,
        returned_count=len(records),
        truncated=total_count > len(records),
        messages=records,
    )


@router.get("/reports/options", response_model=WialonReportOptions)
def get_report_options(
    current_user: User = Depends(
        require_role("admin", "gsm", "operator", "master", "management")
    ),
):
    del current_user
    client = _client()
    try:
        client.login()
        units = client.list_units()
        groups = client.list_unit_groups()
        resources = client.list_report_resources()
        templates: list[WialonReportTemplate] = []
        for resource in resources:
            resource_id = resource.get("id")
            resource_name = resource.get("nm")
            report_templates = resource.get("rep")
            if not isinstance(resource_id, int) or not isinstance(report_templates, dict):
                continue
            for template in report_templates.values():
                if not isinstance(template, dict):
                    continue
                template_id = template.get("id")
                object_type = template.get("ct")
                if (
                    not isinstance(template_id, int)
                    or object_type not in ("avl_unit", "avl_unit_group")
                    or not template.get("n")
                ):
                    continue
                templates.append(
                    WialonReportTemplate(
                        resource_id=resource_id,
                        resource_name=str(resource_name or ""),
                        template_id=template_id,
                        name=str(template["n"]),
                        object_type=object_type,
                    )
                )
    except WialonApiError as exc:
        logger.warning("Wialon request failed for %s: %s", exc.service, exc)
        raise HTTPException(
            status_code=502,
            detail=f"Could not load Wialon report templates ({exc.service}).",
        ) from exc
    finally:
        client.close()

    return WialonReportOptions(
        units=[
            WialonTarget(id=int(unit["id"]), name=str(unit.get("nm") or unit["id"]))
            for unit in units
        ],
        groups=[
            WialonTarget(id=int(group["id"]), name=str(group.get("nm") or group["id"]))
            for group in groups
            if isinstance(group.get("id"), int)
        ],
        templates=templates,
    )


@router.post("/reports/run", response_model=WialonReportResponse)
def run_wialon_report(
    request: WialonReportRequest,
    current_user: User = Depends(
        require_role("admin", "gsm", "operator", "master", "management")
    ),
):
    del current_user
    if request.to_ts <= request.from_ts:
        raise HTTPException(status_code=422, detail="to_ts must be later than from_ts.")
    if request.to_ts - request.from_ts > REPORT_MAX_SECONDS:
        raise HTTPException(status_code=422, detail="Report range cannot exceed 31 days.")

    client = _client()
    try:
        client.login()
        result = client.call(
            "report/exec_report",
            {
                "reportResourceId": request.resource_id,
                "reportTemplateId": request.template_id,
                "reportObjectId": request.object_id,
                "reportObjectSecId": request.object_sec_id,
                "interval": {
                    "from": request.from_ts,
                    "to": request.to_ts,
                    "flags": 0,
                },
            },
        )
        report_result = result.get("reportResult")
        if not isinstance(report_result, dict):
            raise WialonApiError("report/exec_report", "Report result is missing.")

        tables: list[WialonReportTable] = []
        report_tables = report_result.get("tables", [])
        if not isinstance(report_tables, list):
            raise WialonApiError("report/exec_report", "Invalid report tables response.")
        remaining_rows = REPORT_MAX_ROWS_TOTAL
        for table_index, table in enumerate(report_tables):
            if not isinstance(table, dict):
                continue
            row_count = table.get("rows", 0)
            if not isinstance(row_count, int) or row_count < 0:
                raise WialonApiError("report/exec_report", "Invalid report row count.")
            returned_count = min(
                row_count, REPORT_MAX_ROWS_PER_TABLE, remaining_rows
            )
            remaining_rows -= returned_count
            rows: list[dict[str, Any]] = []
            if returned_count:
                data = client.call_raw(
                    "report/get_result_rows",
                    {
                        "tableIndex": table_index,
                        "indexFrom": 0,
                        "indexTo": returned_count - 1,
                    },
                )
                if not isinstance(data, list) or any(
                    not isinstance(row, dict) for row in data
                ):
                    raise WialonApiError(
                        "report/get_result_rows", "Invalid report rows response."
                    )
                rows = data
            headers = table.get("header", [])
            tables.append(
                WialonReportTable(
                    name=str(table.get("name") or ""),
                    label=str(table.get("label") or table.get("name") or ""),
                    headers=[str(value) for value in headers]
                    if isinstance(headers, list)
                    else [],
                    row_count=row_count,
                    rows=rows,
                    total=table.get("total")
                    if isinstance(table.get("total"), list)
                    else None,
                    truncated=row_count > len(rows),
                )
            )
        stats = report_result.get("stats", [])
        if not isinstance(stats, list):
            stats = []
        report_name = next(
            (
                str(item[1])
                for item in stats
                if isinstance(item, list) and len(item) > 1 and item[0] == "Отчет"
            ),
            "Wialon report",
        )
        object_name = next(
            (
                str(item[1])
                for item in stats
                if isinstance(item, list)
                and len(item) > 1
                and item[0] in ("Объект", "Группа")
            ),
            str(request.object_id),
        )
    except WialonApiError as exc:
        logger.warning("Wialon request failed for %s: %s", exc.service, exc)
        raise HTTPException(
            status_code=502,
            detail=f"Could not run Wialon report ({exc.service}).",
        ) from exc
    finally:
        client.close()

    return WialonReportResponse(
        report_name=report_name,
        object_name=object_name,
        stats=[
            [str(value) for value in item]
            for item in stats
            if isinstance(item, list)
        ],
        tables=tables,
    )
