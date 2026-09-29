"""team join codes

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-29
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from app.rules import new_join_code

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("teams", sa.Column("join_code", sa.String(length=9), nullable=True))
    # Existing teams each get their own random code before the column becomes required and unique.
    connection = op.get_bind()
    for (team_id,) in connection.execute(sa.text("SELECT id FROM teams")):
        connection.execute(sa.text("UPDATE teams SET join_code = :code WHERE id = :id"), {"code": new_join_code(), "id": team_id})
    op.alter_column("teams", "join_code", nullable=False)
    op.create_unique_constraint(op.f("uq_teams_join_code"), "teams", ["join_code"])


def downgrade() -> None:
    op.drop_constraint(op.f("uq_teams_join_code"), "teams", type_="unique")
    op.drop_column("teams", "join_code")
