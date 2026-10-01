"""students can be banned by organisers

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-02
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("banned_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("banned_reason", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("banned_by", sa.String(length=320), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "banned_by")
    op.drop_column("users", "banned_reason")
    op.drop_column("users", "banned_at")
