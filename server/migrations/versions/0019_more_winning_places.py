"""winning places beyond 2nd for departments with a bigger finalist quota

A department's finalist quota for a problem statement can be up to 10 (CSE has three places in PS 1 and 2 this year), so a
department-round winner can be 3rd and below. Only the check on awards.place changes (1 or 2 becomes 1 to 10); no row changes.

Revision ID: 0019
Revises: 0018
Create Date: 2026-10-26
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0019"
down_revision: str | None = "0018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint(op.f("ck_awards_place"), "awards", type_="check")
    op.create_check_constraint(op.f("ck_awards_place"), "awards", "place >= 1 AND place <= 10")


def downgrade() -> None:
    op.drop_constraint(op.f("ck_awards_place"), "awards", type_="check")
    op.create_check_constraint(op.f("ck_awards_place"), "awards", "place IN (1, 2)")
