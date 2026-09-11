from typing import List

from pydantic_settings import BaseSettings


class AppSettings(BaseSettings):
    APP_NAME: str = "Fuel & Transport Monitoring System"
    DEBUG: bool = False
    APP_VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api/v1"

    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"