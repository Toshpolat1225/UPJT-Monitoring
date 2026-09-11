from pydantic import PostgresDsn
from pydantic_settings import BaseSettings


class DatabaseSettings(BaseSettings):
    DB_USER: str
    DB_PASSWORD: str
    DB_HOST: str
    DB_PORT: int
    DB_NAME: str

    DB_DSN: PostgresDsn

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"