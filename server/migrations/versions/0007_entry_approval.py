"""startup and COE KIET entries are accepted by an admin before they qualify for the Grand Finale

Additive: three nullable or defaulted columns on teams. Every existing team keeps approval_required = false, so
nothing that is registered today changes.

Revision ID: 0007
Revises: 0006
Create Date: 2026-10-09
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("teams", sa.Column("approval_required", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("teams", sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("teams", sa.Column("approved_by", sa.String(length=320), nullable=True))


def downgrade() -> None:
    op.drop_column("teams", "approved_by")
    op.drop_column("teams", "approved_at")
    op.drop_column("teams", "approval_required")
