"""Registration desk volunteers sign in with an email and password

Additive only: admins gets password_hash, password_set_at and password_set_by (all nullable). Only desk volunteers get a
password; every other organiser keeps signing in with Google.

Revision ID: 0024
Revises: 0023
Create Date: 2026-10-29
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0024"
down_revision: str | None = "0023"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("admins", sa.Column("password_hash", sa.String(length=200), nullable=True))
    op.add_column("admins", sa.Column("password_set_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("admins", sa.Column("password_set_by", sa.String(length=320), nullable=True))


def downgrade() -> None:
    op.drop_column("admins", "password_set_by")
    op.drop_column("admins", "password_set_at")
    op.drop_column("admins", "password_hash")
