"""shared Grand Finale stalls: two projects of one club can be shown at the same stall number

Only the unique constraint on final_tents.tent goes (a plain index takes its place, for searching by stall); a team still
has at most one stall. No row changes.

Revision ID: 0021
Revises: 0020
Create Date: 2026-10-28
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0021"
down_revision: str | None = "0020"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint(op.f("uq_final_tents_tent"), "final_tents", type_="unique")
    op.create_index(op.f("ix_final_tents_tent"), "final_tents", ["tent"])


def downgrade() -> None:
    # Shared stalls would violate the old constraint, so a downgrade needs them split first.
    op.drop_index(op.f("ix_final_tents_tent"), table_name="final_tents")
    op.create_unique_constraint(op.f("uq_final_tents_tent"), "final_tents", ["tent"])
