"""
Rate limits shared by every API worker, stored in PostgreSQL (fixed windows).

Counted in a separate transaction, so an attempt still counts when the request itself fails and rolls back,
which is the whole point for guessing (e.g. wrong join codes).
"""

from datetime import timedelta

from sqlalchemy import case
from sqlalchemy.dialects.postgresql import insert

from ..db import get_engine
from ..errors import ApiError
from ..models import RateLimit, utcnow


def hit(key: str, limit: int, window: timedelta, message: str) -> None:
    """Counts one attempt for `key`; raises 429 once more than `limit` attempts fall in the current window."""
    now = utcnow()
    expired = RateLimit.window_start < now - window
    statement = (
        insert(RateLimit)
        .values(key=key, window_start=now, count=1)
        .on_conflict_do_update(
            index_elements=[RateLimit.key],
            set_={
                "count": case((expired, 1), else_=RateLimit.count + 1),
                "window_start": case((expired, now), else_=RateLimit.window_start),
            },
        )
        .returning(RateLimit.count)
    )
    with get_engine().begin() as connection:
        count = connection.execute(statement).scalar_one()
    if count > limit:
        raise ApiError(message, 429)
