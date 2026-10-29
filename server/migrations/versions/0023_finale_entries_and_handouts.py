"""Grand Finale: each team's section, building and room, wild cards, and the registration desk's ID card and coupon records

Additive only: two new tables.
- finale_entries: a super admin's section for a team (ranked in its own section otherwise), a building and room when the team
  exhibits somewhere else than its octonorm, and the wild-card flag.
- finale_handouts: the ID card and lunch coupon the registration desk handed to each registered student.

Revision ID: 0023
Revises: 0022
Create Date: 2026-10-29
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0023"
down_revision: str | None = "0022"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SECTIONS = "section IS NULL OR section IN ('category', 'coe', 'club', 'school', 'college', 'startup')"


def upgrade() -> None:
    op.create_table(
        "finale_entries",
        sa.Column("team_id", sa.Uuid(), nullable=False),
        sa.Column("section", sa.String(length=10), nullable=True),
        sa.Column("building", sa.String(length=60), server_default=sa.text("''"), nullable=False),
        sa.Column("room", sa.String(length=60), server_default=sa.text("''"), nullable=False),
        sa.Column("wildcard", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_by", sa.String(length=320), nullable=False),
        sa.CheckConstraint(SECTIONS, name=op.f("ck_finale_entries_section")),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], name=op.f("fk_finale_entries_team_id_teams"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("team_id", name=op.f("pk_finale_entries")),
    )
    op.create_table(
        "finale_handouts",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("team_id", sa.Uuid(), nullable=False),
        sa.Column("id_card_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id_card_by", sa.String(length=320), nullable=True),
        sa.Column("coupon_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("coupon_by", sa.String(length=320), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=op.f("fk_finale_handouts_user_id_users"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], name=op.f("fk_finale_handouts_team_id_teams"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", name=op.f("pk_finale_handouts")),
    )
    op.create_index(op.f("ix_finale_handouts_team_id"), "finale_handouts", ["team_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_finale_handouts_team_id"), table_name="finale_handouts")
    op.drop_table("finale_handouts")
    op.drop_table("finale_entries")
