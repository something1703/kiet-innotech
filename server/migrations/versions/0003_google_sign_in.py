"""google sign-in replaces cognito; shared rate limits

Revision ID: 0003
Revises: 0002
Create Date: 2026-09-30
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Cognito subs mean nothing to Google; clear them rather than carry them over.
    op.drop_constraint(op.f("uq_users_cognito_sub"), "users", type_="unique")
    op.alter_column("users", "cognito_sub", new_column_name="google_sub")
    op.execute("UPDATE users SET google_sub = NULL")
    op.create_unique_constraint(op.f("uq_users_google_sub"), "users", ["google_sub"])
    op.create_table(
        "rate_limits",
        sa.Column("key", sa.String(length=200), nullable=False),
        sa.Column("window_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("count", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("key", name=op.f("pk_rate_limits")),
    )


def downgrade() -> None:
    op.drop_table("rate_limits")
    op.drop_constraint(op.f("uq_users_google_sub"), "users", type_="unique")
    op.alter_column("users", "google_sub", new_column_name="cognito_sub")
    op.create_unique_constraint(op.f("uq_users_cognito_sub"), "users", ["cognito_sub"])
