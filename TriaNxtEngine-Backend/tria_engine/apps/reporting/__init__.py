# tria_engine/apps/reporting/
#
# Custom Report Builder / Standard Report Center + Financials & Milestones
# (Varsha's scope on the TriaNXT CTMS project).
#
# New tables introduced here (created by the alembic migration
# `reporting_tables` and registered on Base.metadata so the test suite and
# the create_all helper pick them up):
#   report_template      saved Report-Builder configurations
#   report_deviation     deviations mirror (read-only reporting source)
#   report_studydocument study-document mirror (eISF completeness source)
#   finance_budget       site budget lines (baseline vs actual spend)
#   finance_milestone    contractual / study milestones
#   finance_invoice      invoice generation
#   finance_payout       payout requests + approvals
#
# The mirrors (deviation / document) exist because the clinical data the
# standard reports read lives in the frontend localStorage stores / ctms
# JSON mirrors — this app keeps its two read-only mirrors separate so the
# module is self-contained and additive (nothing owned by other teams is
# touched).
