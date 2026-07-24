# Production Deployment and Configuration Guide

This guide provides step-by-step instructions for deploying the UPJT-Monitoring system to a production Linux server.

## 1. Prerequisites

The production server must have the following software installed and configured:
- **OS:** A modern Linux distribution (e.g., Ubuntu 22.04 LTS).
- **Docker:** Version `24.0` or newer.
- **Docker Compose:** Version `2.20` or newer.
- **Git:** Version `2.40` or newer.
- **Firewall:** A configured firewall (e.g., `ufw`) allowing traffic on ports `22` (SSH), `80` (HTTP), and `443` (HTTPS).

## 2. Environment Configuration

1.  Clone the repository to your server:
    ```bash
    git clone https://github.com/upjt/UPJT-Monitoring.git
    cd UPJT-Monitoring
    ```

2.  Create the production environment file by copying the example:
    ```bash
    cp .env.production.example .env.production
    ```

3.  **Edit `.env.production`** with a secure text editor (e.g., `nano` or `vim`) and replace all placeholder values with strong, unique secrets. **This is a critical security step.**
    ```env
    # Example:
    POSTGRES_PASSWORD=YOUR_SECURE_DATABASE_PASSWORD_HERE
    JWT_SECRET_KEY=YOUR_VERY_LONG_AND_COMPLEX_JWT_SECRET_KEY_HERE
    REDIS_PASSWORD=YOUR_SECURE_REDIS_PASSWORD_HERE
    BACKUP_ENCRYPTION_KEY=YOUR_STRONG_BACKUP_ENCRYPTION_KEY_HERE
    CORS_ORIGINS=["https://monitoring.upjt.uz"]
    ```

4.  Create a symbolic link so Docker Compose can find the environment file:
    ```bash
    ln -sf .env.production .env
    ```

## 3. Initial Deployment

1.  **Build and Start Containers:** Pull pre-built images from your registry or build them locally. Start all services in detached mode.
    ```bash
    docker compose -f docker-compose.prod.yml up -d --build
    ```

2.  **Run Database Migrations:** Apply all pending Alembic migrations to set up the database schema.
    ```bash
    docker compose -f docker-compose.prod.yml exec backend alembic upgrade head
    ```

3.  **Verify Deployment:** Check that all containers are running and healthy.
    ```bash
    docker compose -f docker-compose.prod.yml ps
    ```
    All services should show a `running` or `healthy` status. You can now access the application via your domain.