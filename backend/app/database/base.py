from sqlalchemy.orm import DeclarativeBase, declared_attr
import re


class Base(DeclarativeBase):
    """Base for all models."""

    __abstract__ = True

    @declared_attr.directive
    def __tablename__(cls) -> str:
        # Converts CamelCase to snake_case and pluralizes
        return re.sub(r'(?<!^)(?=[A-Z])', '_', cls.__name__).lower() + "s"