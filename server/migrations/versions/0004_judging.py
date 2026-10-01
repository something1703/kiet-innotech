"""judging (jurors, panels, tents, scores), outside admins, audit participant type

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-01
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Outside admins: other colleges and schools, no department.
    op.drop_constraint(op.f("ck_admins_role"), "admins", type_="check")
    op.drop_constraint(op.f("ck_admins_department"), "admins", type_="check")
    op.create_check_constraint(op.f("ck_admins_role"), "admins", "role IN ('super_admin', 'admin', 'outside_admin')")
    op.create_check_constraint(op.f("ck_admins_department"), "admins", "role <> 'admin' OR department IS NOT NULL")

    op.add_column("audit_log", sa.Column("participant_type", sa.String(length=10), nullable=True))
    # Existing entries of teams that still exist; the history of deleted teams stays institute-wide.
    op.execute("UPDATE audit_log SET participant_type = teams.participant_type FROM teams WHERE audit_log.team_id = teams.id")

    op.create_table(
        "jurors",
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("kind", sa.String(length=10), nullable=False),
        sa.Column("department", sa.String(length=20), nullable=True),
        sa.Column("organisation", sa.String(length=200), nullable=False),
        sa.Column("phone", sa.String(length=10), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by", sa.String(length=320), nullable=True),
        sa.CheckConstraint("kind IN ('faculty', 'external')", name=op.f("ck_jurors_kind")),
        sa.CheckConstraint("kind = 'external' OR department IS NOT NULL", name=op.f("ck_jurors_department")),
        sa.PrimaryKeyConstraint("email", name=op.f("pk_jurors")),
    )
    op.create_table(
        "panels",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("round", sa.String(length=10), nullable=False),
        sa.Column("name", sa.String(length=60), nullable=False),
        sa.Column("name_key", sa.String(length=60), nullable=False),
        sa.Column("location", sa.String(length=120), nullable=False),
        sa.Column("department", sa.String(length=20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by", sa.String(length=320), nullable=True),
        sa.CheckConstraint("round IN ('department', 'final')", name=op.f("ck_panels_round")),
        sa.CheckConstraint("round = 'final' OR department IS NOT NULL", name=op.f("ck_panels_department")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_panels")),
    )
    op.create_index("uq_panels_round_name_key", "panels", ["round", "name_key"], unique=True)
    op.create_index(op.f("ix_panels_department"), "panels", ["department"], unique=False)

    op.create_table(
        "panel_jurors",
        sa.Column("panel_id", sa.Uuid(), nullable=False),
        sa.Column("juror_email", sa.String(length=320), nullable=False),
        sa.Column("chair", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["juror_email"], ["jurors.email"], name=op.f("fk_panel_jurors_juror_email_jurors"), ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["panel_id"], ["panels.id"], name=op.f("fk_panel_jurors_panel_id_panels"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("panel_id", "juror_email", name=op.f("pk_panel_jurors")),
    )
    op.create_index(op.f("ix_panel_jurors_juror_email"), "panel_jurors", ["juror_email"], unique=False)
    op.create_index("uq_panel_jurors_chair", "panel_jurors", ["panel_id"], unique=True, postgresql_where=sa.text("chair"))

    op.create_table(
        "panel_teams",
        sa.Column("panel_id", sa.Uuid(), nullable=False),
        sa.Column("team_id", sa.Uuid(), nullable=False),
        sa.Column("round", sa.String(length=10), nullable=False),
        sa.ForeignKeyConstraint(["panel_id"], ["panels.id"], name=op.f("fk_panel_teams_panel_id_panels"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], name=op.f("fk_panel_teams_team_id_teams"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("panel_id", "team_id", name=op.f("pk_panel_teams")),
    )
    op.create_index("uq_panel_teams_round_team", "panel_teams", ["round", "team_id"], unique=True)

    op.create_table(
        "final_tents",
        sa.Column("team_id", sa.Uuid(), nullable=False),
        sa.Column("tent", sa.String(length=12), nullable=False),
        sa.Column("assigned_by", sa.String(length=320), nullable=False),
        sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], name=op.f("fk_final_tents_team_id_teams"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("team_id", name=op.f("pk_final_tents")),
        sa.UniqueConstraint("tent", name=op.f("uq_final_tents_tent")),
    )

    op.create_table(
        "scores",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("round", sa.String(length=10), nullable=False),
        sa.Column("team_id", sa.Uuid(), nullable=False),
        sa.Column("juror_email", sa.String(length=320), nullable=False),
        sa.Column("marks", sa.JSON(), nullable=False),
        sa.Column("total", sa.Integer(), nullable=False),
        sa.Column("remarks", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("round IN ('department', 'final')", name=op.f("ck_scores_round")),
        sa.ForeignKeyConstraint(["juror_email"], ["jurors.email"], name=op.f("fk_scores_juror_email_jurors"), ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], name=op.f("fk_scores_team_id_teams"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_scores")),
    )
    op.create_index(op.f("ix_scores_team_id"), "scores", ["team_id"], unique=False)
    op.create_index(op.f("ix_scores_juror_email"), "scores", ["juror_email"], unique=False)
    op.create_index("uq_scores_round_team_juror", "scores", ["round", "team_id", "juror_email"], unique=True)


def downgrade() -> None:
    op.drop_table("scores")
    op.drop_table("final_tents")
    op.drop_table("panel_teams")
    op.drop_table("panel_jurors")
    op.drop_table("panels")
    op.drop_table("jurors")
    op.drop_column("audit_log", "participant_type")
    op.execute("DELETE FROM admins WHERE role = 'outside_admin'")
    op.drop_constraint(op.f("ck_admins_department"), "admins", type_="check")
    op.drop_constraint(op.f("ck_admins_role"), "admins", type_="check")
    op.create_check_constraint(op.f("ck_admins_role"), "admins", "role IN ('super_admin', 'admin')")
    op.create_check_constraint(op.f("ck_admins_department"), "admins", "role = 'super_admin' OR department IS NOT NULL")
