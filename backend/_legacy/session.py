from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.config.settings import get_settings

settings = get_settings()

engine = create_async_engine(
    str(settings.db.DB_DSN),
    pool_pre_ping=True,
    echo=False,  # Set to True for debugging SQL queries
)

AsyncSessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)