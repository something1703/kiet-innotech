"""one team per Grand Finale stall again

Puts back the unique constraint 0021 removed: two teams can never have the same stall number. Production had its three
shared stalls split before this ran, so no row changes; a database that still has a shared stall stops here instead.

Revision ID: 0022
Revises: 0021
Create Date: 2026-10-28
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0022"
down_revision: str | None = "0021"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_index(op.f("ix_final_tents_tent"), table_name="final_tents")
    op.create_unique_constraint(op.f("uq_final_tents_tent"), "final_tents", ["tent"])


def downgrade() -> None:
    op.drop_constraint(op.f("uq_final_tents_tent"), "final_tents", type_="unique")
    op.create_index(op.f("ix_final_tents_tent"), "final_tents", ["tent"])
