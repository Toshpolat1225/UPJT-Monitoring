from functools import lru_cache
from pydantic_settings import BaseSettings

from .app import AppSettings
from .db import DatabaseSettings
from .jwt import JWTSettings


class Settings(BaseSettings):
    app: AppSettings = AppSettings()
    db: DatabaseSettings = DatabaseSettings()
    jwt: JWTSettings = JWTSettings()


@lru_cache()
def get_settings() -> Settings:
    return Settings()