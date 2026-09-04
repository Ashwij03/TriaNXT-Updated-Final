# tria_engine/apps/ctms/router.py
#
# Aggregate router mounting the six Site CTMS gap-module surfaces under a
# single prefix, mirroring how tria_engine/main.py mounts app routers:
#
#   /api/site/amendments/*          M18 Protocol Amendments
#   /api/site/ip/*                  M19 IP / Supply Accountability
#   /api/site/irb/*                 M20 IRB / IEC Submissions
#   /api/site/icf/*                 M21 ICF / eConsent & Re-consent
#   /api/site/vendors/*             M22 Vendor & Lab Management
#   /api/site/feasibility/*         M23 Site Feasibility & Selection
#   /api/site/feasibility-scoring/* M23 scoring configuration

from __future__ import annotations

from fastapi import APIRouter

from .router_amendments import router as amendments_router
from .router_feasibility import router as feasibility_router
from .router_feasibility import scoring_router as feasibility_scoring_router
from .router_icf import router as icf_router
from .router_ip import router as ip_router
from .router_irb import router as irb_router
from .router_vendor import router as vendor_router
from .router_sync import router as sync_router
from .router_subjects import router as subjects_router
from .router_visits import router as visits_router

router = APIRouter(prefix="/api/site", tags=["ctms-site-gaps"])

router.include_router(amendments_router)
router.include_router(ip_router)
router.include_router(irb_router)
router.include_router(icf_router)
router.include_router(vendor_router)
router.include_router(feasibility_router)
router.include_router(feasibility_scoring_router)
router.include_router(subjects_router)
router.include_router(visits_router)
router.include_router(sync_router)
