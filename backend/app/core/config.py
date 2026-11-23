from pydantic import SecretStr, field_validator
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    APP_NAME: str = "Fuel & Transport Monitoring System"
    DATABASE_URL: str = "postgresql://postgres:postgres@db:5432/sttb_monitoring"
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173"]
    WIALON_BASE_URL: str = "https://gps.agmk.uz/wialon/ajax.html"
    WIALON_TOKEN: SecretStr | None = None

    @field_validator("SECRET_KEY", mode="before")
    @classmethod
    def strip_secret_key_quotes(cls, value: str) -> str:
        return value.strip().strip('"').strip("'")

    class Config:
        env_file = ".env"


settings = Settings()
