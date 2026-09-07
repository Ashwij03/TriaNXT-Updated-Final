# tria_engine/alembic/versions/cb91e2a4f001_reporting_finance_tables.py
#
# Varsha's scope — Custom Report Builder / Report Center + Financials &
# Milestones. Adds the reporting app tables:
#   report_template, report_deviation, report_studydocument,
#   finance_budget, finance_milestone, finance_invoice, finance_payout
#
# Additive only: nothing existing is altered or dropped. Revision id
# matches the models in tria_engine/apps/reporting/models.py.

"""reporting and finance tables (report builder, budgets, milestones, invoices, payouts)

Revision ID: cb91e2a4f001
Revises: 70f65d974cc7
Create Date: 2026-09-05
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "cb91e2a4f001"
down_revision = "70f65d974cc7"
branch_labels = None
depends_on = None

# Same portable BIGINT convention used by core/database.py (BIGINT on
# PostgreSQL, INTEGER on SQLite so rowid autoincrement keeps working).
BIGINT = sa.BigInteger().with_variant(sa.Integer(), "sqlite")


def _base_columns(include_json_data: bool = False) -> list:
    columns = [
        sa.Column("id", BIGINT, primary_key=True, autoincrement=True),
        sa.Column("code", sa.String(64), nullable=False),
    ]
    if include_json_data:
        columns.append(sa.Column("data", sa.JSON(), nullable=False))
    return columns


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    def table_exists(name: str) -> bool:
        return name in inspector.get_table_names()

    # --- read-only reporting mirrors (JSON documents) -------------------
    if not table_exists("report_deviation"):
        op.create_table(
            "report_deviation",
            sa.Column("id", BIGINT, primary_key=True, autoincrement=True),
            sa.Column("code", sa.String(64), nullable=False, index=True),
            sa.Column(
                "organization_id",
                BIGINT,
                sa.ForeignKey("organizations_organization.id", ondelete="SET NULL"),
                nullable=True,
                index=True,
            ),
            sa.Column("study_id", sa.String(100), nullable=True, index=True),
            sa.Column("site_id", sa.String(100), nullable=True, index=True),
            sa.Column("data", sa.JSON(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
        )
    if not table_exists("report_studydocument"):
        op.create_table(
            "report_studydocument",
            sa.Column("id", BIGINT, primary_key=True, autoincrement=True),
            sa.Column("code", sa.String(64), nullable=False, index=True),
            sa.Column(
                "organization_id",
                BIGINT,
                sa.ForeignKey("organizations_organization.id", ondelete="SET NULL"),
                nullable=True,
                index=True,
            ),
            sa.Column("study_id", sa.String(100), nullable=True, index=True),
            sa.Column("site_id", sa.String(100), nullable=True, index=True),
            sa.Column("data", sa.JSON(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
        )

    # --- report templates ------------------------------------------------
    if not table_exists("report_template"):
        op.create_table(
            "report_template",
            sa.Column("id", BIGINT, primary_key=True, autoincrement=True),
            sa.Column("code", sa.String(64), nullable=False, index=True),
            sa.Column("name", sa.String(200), nullable=False),
            sa.Column(
                "organization_id",
                BIGINT,
                sa.ForeignKey("organizations_organization.id", ondelete="CASCADE"),
                nullable=True,
                index=True,
            ),
            sa.Column(
                "owner_id",
                BIGINT,
                sa.ForeignKey("accounts_user.id", ondelete="CASCADE"),
                nullable=True,
                index=True,
            ),
            sa.Column("study_id", sa.String(100), nullable=True, index=True),
            sa.Column("config", sa.JSON(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
        )

    # --- finance tables ---------------------------------------------------
    if not table_exists("finance_budget"):
        op.create_table(
            "finance_budget",
            sa.Column("id", BIGINT, primary_key=True, autoincrement=True),
            sa.Column("code", sa.String(64), nullable=False, index=True),
            sa.Column("name", sa.String(200), nullable=False),
            sa.Column(
                "organization_id",
                BIGINT,
                sa.ForeignKey("organizations_organization.id", ondelete="CASCADE"),
                nullable=True,
                index=True,
            ),
            sa.Column("study_id", sa.String(100), nullable=True, index=True),
            sa.Column("site_id", sa.String(100), nullable=True, index=True),
            sa.Column("site_name", sa.String(255), nullable=False, server_default=""),
            sa.Column("currency", sa.String(8), nullable=False, server_default="USD"),
            sa.Column("baseline_amount", sa.Numeric(14, 2), nullable=False, server_default="0"),
            sa.Column("period_label", sa.String(64), nullable=False, server_default=""),
            sa.Column("status", sa.String(24), nullable=False, server_default="Active"),
            sa.Column("notes", sa.Text(), nullable=False, server_default=""),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
        )
    if not table_exists("finance_milestone"):
        op.create_table(
            "finance_milestone",
            sa.Column("id", BIGINT, primary_key=True, autoincrement=True),
            sa.Column("code", sa.String(64), nullable=False, index=True),
            sa.Column("name", sa.String(200), nullable=False),
            sa.Column(
                "organization_id",
                BIGINT,
                sa.ForeignKey("organizations_organization.id", ondelete="CASCADE"),
                nullable=True,
                index=True,
            ),
            sa.Column("study_id", sa.String(100), nullable=True, index=True),
            sa.Column("site_id", sa.String(100), nullable=True, index=True),
            sa.Column("category", sa.String(64), nullable=False, server_default="Contractual"),
            sa.Column("weight", sa.Numeric(14, 2), nullable=False, server_default="1"),
            sa.Column("target_date", sa.Date(), nullable=True),
            sa.Column("status", sa.String(32), nullable=False, server_default="Not Started"),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
        )
    if not table_exists("finance_invoice"):
        op.create_table(
            "finance_invoice",
            sa.Column("id", BIGINT, primary_key=True, autoincrement=True),
            sa.Column("code", sa.String(64), nullable=False, index=True),
            sa.Column("number", sa.String(64), nullable=False, server_default=""),
            sa.Column(
                "organization_id",
                BIGINT,
                sa.ForeignKey("organizations_organization.id", ondelete="CASCADE"),
                nullable=True,
                index=True,
            ),
            sa.Column("study_id", sa.String(100), nullable=True, index=True),
            sa.Column("site_id", sa.String(100), nullable=True, index=True),
            sa.Column("budget_code", sa.String(64), nullable=False, server_default=""),
            sa.Column("description", sa.String(500), nullable=False, server_default=""),
            sa.Column("amount", sa.Numeric(14, 2), nullable=False, server_default="0"),
            sa.Column("currency", sa.String(8), nullable=False, server_default="USD"),
            sa.Column("status", sa.String(24), nullable=False, server_default="Draft"),
            sa.Column("period_label", sa.String(64), nullable=False, server_default=""),
            sa.Column("issue_date", sa.Date(), nullable=True),
            sa.Column("due_date", sa.Date(), nullable=True),
            sa.Column("created_by", sa.String(200), nullable=False, server_default=""),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
        )
    if not table_exists("finance_payout"):
        op.create_table(
            "finance_payout",
            sa.Column("id", BIGINT, primary_key=True, autoincrement=True),
            sa.Column("code", sa.String(64), nullable=False, index=True),
            sa.Column(
                "organization_id",
                BIGINT,
                sa.ForeignKey("organizations_organization.id", ondelete="CASCADE"),
                nullable=True,
                index=True,
            ),
            sa.Column("study_id", sa.String(100), nullable=True, index=True),
            sa.Column("site_id", sa.String(100), nullable=True, index=True),
            sa.Column("budget_code", sa.String(64), nullable=False, server_default=""),
            sa.Column("invoice_code", sa.String(64), nullable=False, server_default=""),
            sa.Column("reason", sa.String(500), nullable=False, server_default=""),
            sa.Column("amount", sa.Numeric(14, 2), nullable=False, server_default="0"),
            sa.Column("currency", sa.String(8), nullable=False, server_default="USD"),
            sa.Column("status", sa.String(24), nullable=False, server_default="Pending"),
            sa.Column("requested_by", sa.String(200), nullable=False, server_default=""),
            sa.Column("requested_at", sa.DateTime(), nullable=False),
            sa.Column("decided_by", sa.String(200), nullable=False, server_default=""),
            sa.Column("decided_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
        )


def downgrade() -> None:
    for table in (
        "finance_payout",
        "finance_invoice",
        "finance_milestone",
        "finance_budget",
        "report_template",
        "report_studydocument",
        "report_deviation",
    ):
        op.drop_table(table)
