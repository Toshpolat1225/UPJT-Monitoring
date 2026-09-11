from pydantic_settings import BaseSettings


class JWTSettings(BaseSettings):
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 1 day

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"