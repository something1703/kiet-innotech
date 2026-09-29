"""Database engine and per-request sessions."""

from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import Engine, MetaData, create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import get_settings


class Base(DeclarativeBase):
    # Predictable constraint names, so IntegrityErrors can be mapped to messages and migrations stay stable.
    metadata = MetaData(
        naming_convention={
            "ix": "ix_%(table_name)s_%(column_0_name)s",
            "uq": "uq_%(table_name)s_%(column_0_name)s",
            "ck": "ck_%(table_name)s_%(constraint_name)s",
            "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
            "pk": "pk_%(table_name)s",
        }
    )


def violated_constraint(error: IntegrityError) -> str:
    """Name of the constraint behind an IntegrityError (PostgreSQL), or the raw message otherwise."""
    diag = getattr(error.orig, "diag", None)
    return getattr(diag, "constraint_name", None) or str(error.orig)


@lru_cache
def get_engine() -> Engine:
    # pool_pre_ping drops connections RDS has closed while idle.
    return create_engine(get_settings().database_url, pool_pre_ping=True, pool_size=10, max_overflow=10)


@lru_cache
def get_sessionmaker() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """One session per request. Services commit explicitly; anything uncommitted is rolled back."""
    session = get_sessionmaker()()
    try:
        yield session
    finally:
        session.rollback()
        session.close()
