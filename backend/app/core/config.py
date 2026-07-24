import os
from typing import List, Literal
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- General App Settings ---
    APP_NAME: str = Field("UPJT Monitoring", env="APP_NAME")
    APP_VERSION: str = Field("1.0.0", env="APP_VERSION")
    DEBUG: bool = Field(False, env="DEBUG")
    ENVIRONMENT: Literal["development", "testing", "staging", "production"] = Field("production", env="ENVIRONMENT")
    CORS_ORIGINS: List[str] = Field(["https://your.domain.com"], env="CORS_ORIGINS")
    API_V1_PREFIX: str = "/api/v1"

    # --- Database Settings ---
    DATABASE_URL: str = Field(..., env="DATABASE_URL")

    # --- JWT Settings ---
    SECRET_KEY: str = Field(..., env="SECRET_KEY")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # --- Redis Settings ---
    REDIS_PASSWORD: str = Field(..., env="REDIS_PASSWORD")