# Wialon GPS integration

## Configuration

Add the following values to the backend's server-side `.env` file. Never put the Wialon token in frontend variables, source code, or chat:

```dotenv
WIALON_BASE_URL=https://gps.agmk.uz/wialon/ajax.html
WIALON_TOKEN=<rotated Wialon API token>
```

The production Compose backend reads `.env`. Recreate/restart the backend after changing it so the new environment is loaded. The token is held as a secret setting and is only sent from the backend to Wialon over HTTPS.

## What the new page reads

The **GPS monitoringi** page fetches current unit data when opened, every 60 seconds while the page is visible, or when refreshed manually. The backend logs in with `token/login`, searches `avl_unit` items using `core/search_items`, and logs out after each request. It requests basic unit data, last position/message, configured sensors and counters. The page shows:

- unit name and Wialon ID;
- latest message timestamp, position and speed;
- mileage and engine-hour values from Wialon unit counters, with message parameters as a fallback;
- every parameter from the latest message, using the configured sensor name when available;
- movement state derived from the last message (`moving`, `stopped`, `stale` after 24 hours without a new message, or `no_data`).

The data remains live in Wialon and is not copied into the Fuel Monitoring database. Missing mileage, engine hours, coordinates, or sensor values remain empty; the integration does not estimate missing values.
Speed and mileage are converted to km-based units for Wialon units configured with US/imperial measurement units; other units are left unchanged.

## Message history

The page's **Xabarlar tarixi** tab requests data messages for one unit using `messages/load_interval`. It accepts Unix timestamps, limits the requested interval to 31 days, and returns at most 2,000 messages per request. Wialon timestamps are normalized to UTC and rendered in Asia/Tashkent time. This is on-demand history, not local archival storage.

## API routes

- `GET /api/wialon/units` — live fleet and latest telemetry.
- `GET /api/wialon/units/{unit_id}/messages?from_ts=<unix>&to_ts=<unix>` — bounded history for one unit.
- `GET /api/wialon/reports/options` — visible units, groups, and report templates.
- `POST /api/wialon/reports/run` — run a selected Wialon template and return table totals/rows.

Both routes require an authenticated Fuel Monitoring user with an application role. Wialon errors are returned as explicit gateway errors; missing server configuration returns `503`.
Report requests are limited to 31 days and at most 5,000 rows across all returned tables.

## Wialon sections observed

The signed-in Wialon interface exposes Dashboard, Monitoring, Tracks, Messages, Reports, Geozones, Routes, Drivers, Trailers, Passengers, Tasks, Notifications, Users, and Units. The Reports screen also lists account-specific report templates. This integration currently covers live unit telemetry and data messages only; Wialon report-template execution, tracks, geozones, and the other management sections are not yet imported.
