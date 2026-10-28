"""Grand Finale: judges who sign in with a password, the event desk (check-in and food coupons) and its volunteers

Additive only:
- jurors: password_hash, password_set_at and password_set_by (all nullable). Outside judges at the Grand Finale sign in
  with their email and a password instead of Google; existing judges are untouched and keep signing in with Google.
- admins: the role check is widened to allow "desk" (event desk volunteers: check-in and food coupons only).
- meals, meal_coupons, meal_extras: new tables for the food coupons handed out at the event desk.

Revision ID: 0020
Revises: 0019
Create Date: 2026-10-28
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0020"
down_revision: str | None = "0019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ROLES = "role IN ('super_admin', 'admin', 'outside_admin', 'startup_admin', 'college_admin', 'school_admin', 'desk')"
OLD_ROLES = "role IN ('super_admin', 'admin', 'outside_admin', 'startup_admin', 'college_admin', 'school_admin')"


def upgrade() -> None:
    op.add_column("jurors", sa.Column("password_hash", sa.String(length=200), nullable=True))
    op.add_column("jurors", sa.Column("password_set_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("jurors", sa.Column("password_set_by", sa.String(length=320), nullable=True))

    op.drop_constraint(op.f("ck_admins_role"), "admins", type_="check")
    op.create_check_constraint(op.f("ck_admins_role"), "admins", ROLES)

    op.create_table(
        "meals",
        sa.Column("key", sa.String(length=40), nullable=False),
        sa.Column("label", sa.String(length=60), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("open", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by", sa.String(length=320), nullable=True),
        sa.PrimaryKeyConstraint("key", name=op.f("pk_meals")),
    )
    op.create_table(
        "meal_coupons",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("meal", sa.String(length=40), nullable=False),
        sa.Column("team_id", sa.Uuid(), nullable=False),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("issued_by", sa.String(length=320), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=op.f("fk_meal_coupons_user_id_users"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["meal"], ["meals.key"], name=op.f("fk_meal_coupons_meal_meals"), ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], name=op.f("fk_meal_coupons_team_id_teams"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "meal", name=op.f("pk_meal_coupons")),
    )
    op.create_index(op.f("ix_meal_coupons_team_id"), "meal_coupons", ["team_id"])
    op.create_table(
        "meal_extras",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("meal", sa.String(length=40), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("recipient", sa.String(length=120), nullable=False),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("issued_by", sa.String(length=320), nullable=False),
        sa.CheckConstraint("quantity BETWEEN 1 AND 500", name=op.f("ck_meal_extras_quantity")),
        sa.ForeignKeyConstraint(["meal"], ["meals.key"], name=op.f("fk_meal_extras_meal_meals"), ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_meal_extras")),
    )


def downgrade() -> None:
    op.drop_table("meal_extras")
    op.drop_index(op.f("ix_meal_coupons_team_id"), table_name="meal_coupons")
    op.drop_table("meal_coupons")
    op.drop_table("meals")
    # Desk volunteers would violate the old constraint, so a downgrade needs them removed first.
    op.drop_constraint(op.f("ck_admins_role"), "admins", type_="check")
    op.create_check_constraint(op.f("ck_admins_role"), "admins", OLD_ROLES)
    op.drop_column("jurors", "password_set_by")
    op.drop_column("jurors", "password_set_at")
    op.drop_column("jurors", "password_hash")
