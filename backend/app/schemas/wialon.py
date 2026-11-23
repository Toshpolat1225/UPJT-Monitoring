from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class SensorValue(BaseModel):
    key: str
    name: str
    value: Any


class TelemetryPoint(BaseModel):
    message_time: datetime | None
    latitude: float | None
    longitude: float | None
    speed_kmh: float | None
    mileage: float | None
    engine_hours: float | None
    sensors: list[SensorValue]


class WialonUnit(TelemetryPoint):
    id: int
    name: str
    unit_type: str | None
    groups: list[str]
    status: Literal["moving", "stopped", "stale", "no_data"]
    raw_sensors: dict[str, Any]


class FleetResponse(BaseModel):
    updated_at: datetime
    unit_count: int
    units: list[WialonUnit]


class MessageHistoryResponse(BaseModel):
    unit_id: int
    unit_name: str
    total_count: int
    returned_count: int
    truncated: bool
    messages: list[TelemetryPoint]


class WialonTarget(BaseModel):
    id: int
    name: str


class WialonReportTemplate(BaseModel):
    resource_id: int
    resource_name: str
    template_id: int
    name: str
    object_type: Literal["avl_unit", "avl_unit_group"]


class WialonReportOptions(BaseModel):
    units: list[WialonTarget]
    groups: list[WialonTarget]
    templates: list[WialonReportTemplate]


class WialonReportRequest(BaseModel):
    resource_id: int = Field(gt=0)
    template_id: int = Field(gt=0)
    object_id: int = Field(gt=0)
    object_sec_id: int = Field(default=0, ge=0)
    from_ts: int = Field(ge=0)
    to_ts: int = Field(gt=0)


class WialonReportTable(BaseModel):
    name: str
    label: str
    headers: list[str]
    row_count: int
    rows: list[dict[str, Any]]
    total: list[Any] | None
    truncated: bool


class WialonReportResponse(BaseModel):
    report_name: str
    object_name: str
    stats: list[list[str]]
    tables: list[WialonReportTable]
