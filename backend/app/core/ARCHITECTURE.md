# UPJT-Monitoring Enterprise v1.0 — System Architecture

## 1. High-Level Overview

UPJT-Monitoring is an enterprise-grade system designed for real-time monitoring, management, and auditing of fuel consumption and vehicle operations. The architecture is built on a modern, containerized, and decoupled stack to ensure scalability, security, and maintainability.

## 2. Technology Stack

- **Backend Framework:** Python 3.11 / FastAPI (Async)
- **Data Access:** SQLAlchemy 2.0 (Core & ORM) with `asyncpg` driver
- **Database:** PostgreSQL 15+
- **Database Migrations:** Alembic
- **Caching & Rate Limiting:** Redis 7+
- **Frontend Framework:** React 18 / TypeScript / Vite
- **State Management & Data Fetching:** TanStack Query
- **UI Components:** shadcn/ui, TailwindCSS
- **Testing:** Pytest (Backend), Playwright (E2E)
- **Containerization:** Docker, Docker Compose
- **Reverse Proxy & Load Balancer:** Nginx
- **Observability:** Prometheus (Metrics), Grafana (Dashboards), Loki (Logs)

## 3. Component Interaction & Data Flow

The system follows a classic three-tier architecture, containerized for portability and isolation.

```
[ Client / Browser ]
       │
       ▼ (HTTPS / WSS on ports 443, 80)
[ Nginx Reverse Proxy ]
       │
       ├─► [ React Frontend (Static Files) ]
       │
       └─► [ /api/v1/... ] ─► [ FastAPI Backend (Gunicorn/Uvicorn) ]
                                  │
           ┌──────────────────────┴──────────────────────┐
           ▼                                             ▼
    [ PostgreSQL 15 ]                             [ Redis 7 ]
 (Primary Data, Audit Logs)                (Rate Limiting, Cache, Sessions)
```

**Typical Request Flow (e.g., POST /api/v1/daily-entries):**
1.  The client's browser sends an HTTPS request to Nginx.
2.  Nginx terminates the SSL connection and proxies the request to the appropriate upstream service, in this case, the FastAPI `backend` container.
3.  The `RequestIDMiddleware` in FastAPI assigns a unique `X-Request-ID`.
4.  The `RedisRateLimiterMiddleware` checks the request rate for the client's IP in Redis.
5.  The JWT authentication dependency verifies the `Authorization` header.
6.  The RBAC dependency checks if the user's role has the required permissions for the endpoint.
7.  The request payload is validated by Pydantic.
8.  The `DailyEntriesService` begins a database transaction.
9.  The service performs business logic (e.g., checks fuel limits).
10. The `DailyEntriesRepository` executes `INSERT` and `UPDATE` statements against the PostgreSQL database.
11. The transaction is committed.
12. A `201 Created` response is sent back through the chain to the client.
13. The `AuditLoggingMiddleware` logs the successful `POST` request.

## 4. Security Architecture

- **Authentication:** JWTs with short-lived Access Tokens (stored in memory/sessionStorage) and long-lived Refresh Tokens (managed via `HttpOnly`, `Secure` cookies).
- **Authorization:** Dynamic Role-Based Access Control (RBAC). Permissions are attached to roles and checked on a per-endpoint basis using FastAPI dependencies.
- **Network Security:**
  - All external traffic is routed through Nginx.
  - Backend, Database, and Redis containers are on an `internal` Docker network, inaccessible from the outside.
  - Strict CORS policy allows requests only from whitelisted frontend origins.
  - TLS 1.3 is enforced for all external communication.
- **Application Security:**
  - **Rate Limiting:** Redis-backed rate limiting per IP address (default: 120 req/min).
  - **Security Headers:** HSTS, CSP, X-Frame-Options, and other security headers are applied by a dedicated middleware.
  - **Input Validation:** All incoming data is strictly validated by Pydantic models to prevent injection and mass assignment vulnerabilities.

## 5. Database Architecture

- **Schema Management:** All schema changes are managed exclusively through Alembic migrations.
- **Auditing:** A trigger-based system on the PostgreSQL database automatically logs all `INSERT`, `UPDATE`, and `DELETE` operations to an immutable `audit_log` table.
- **Backup & Recovery:** An enterprise-grade BDR strategy is in place, featuring daily logical backups (`pg_dump`) and continuous WAL archiving, enabling Point-in-Time Recovery (PITR).