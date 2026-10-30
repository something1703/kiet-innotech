"""A super admin can look up the sign-in passwords of judges and registration desk volunteers

Additive only: admins and jurors get password_sealed (nullable): the password encrypted with a key derived from the
server's session secret, so a database dump alone does not reveal it. Accounts that already have a password keep only
their hash until they are given a new one.

Revision ID: 0025
Revises: 0024
Create Date: 2026-10-30
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0025"
down_revision: str | None = "0024"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("admins", sa.Column("password_sealed", sa.Text(), nullable=True))
    op.add_column("jurors", sa.Column("password_sealed", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("jurors", "password_sealed")
    op.drop_column("admins", "password_sealed")
