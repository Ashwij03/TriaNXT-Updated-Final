#!/usr/bin/env python
"""Wire central RBAC enforcement into the ctms gap-module layer (idempotent).

* common.create_record  -> enforce "create" (module from model class)
* common.save_record    -> signature gains `user`; enforce "update"
* common.audit          -> audit description gains role + org scope (G10)
* delete handlers       -> enforce "delete" (amendments, feasibility)
"""
import io
import sys

BASE = "tria_engine/apps/ctms/"


def sub(content, old, new, label, expect=1):
    count = content.count(old)
    if count != expect:
        print(f"FAIL [{label}]: expected {expect} occurrence(s), found {count}")
        print("  old:", repr(old[:140]))
        sys.exit(1)
    return content.replace(old, new)


def sub_all(content, old, new, label):
    count = content.count(old)
    if count < 1:
        print(f"FAIL [{label}]: expected >=1 occurrence, found 0")
        print("  old:", repr(old[:140]))
        sys.exit(1)
    return content.replace(old, new)


def patch_common():
    with io.open(BASE + "common.py", encoding="utf-8") as f:
        c = f.read()
    if "from ..accounts.rbac import enforce_for_model, resolve_role" in c:
        print("OK common.py (already applied)")
        return

    c = sub(
        c,
        "from ..accounts.services import create_audit_log",
        "from ..accounts.services import create_audit_log\nfrom ..accounts.rbac import enforce_for_model, resolve_role",
        "common-import",
    )
    c = sub(
        c,
        """def create_record(db: Session, model, user, code: str, data: dict) -> dict:
    row = model(code=code, organization_id=user.organization_id, data=data)""",
        """def create_record(db: Session, model, user, code: str, data: dict) -> dict:
    enforce_for_model(user, model, "create")
    row = model(code=code, organization_id=user.organization_id, data=data)""",
        "common-create-record",
    )
    c = sub(
        c,
        """def save_record(db: Session, row, data: dict) -> dict:
    row.data = data""",
        """def save_record(db: Session, user, row, data: dict) -> dict:
    enforce_for_model(user, type(row), "update")
    row.data = data""",
        "common-save-record",
    )
    c = sub(
        c,
        """    bits = [details[k] for k in (details or {}) if details.get(k) not in (None, "")]
    description = f"{user.username} {action}"
    if bits:
        description += " (" + ", ".join(str(b) for b in bits) + ")"
    create_audit_log(""",
        """    bits = [details[k] for k in (details or {}) if details.get(k) not in (None, "")]
    description = f"{user.username} {action}"
    if bits:
        description += " (" + ", ".join(str(b) for b in bits) + ")"
    # Audit context: resolved role + org scope for every state-changing
    # action (RBAC validation G10 — actor, role and scope on each record).
    description += f" [role={resolve_role(user) or 'UNKNOWN'}, scope=org:{getattr(user, 'organization_id', None) or 'ALL'}]"
    create_audit_log(""",
        "common-audit-context",
    )
    with io.open(BASE + "common.py", "w", encoding="utf-8", newline="\n") as f:
        f.write(c)
    print("OK common.py")


def patch_save_calls():
    for name in [
        "router_amendments.py",
        "router_feasibility.py",
        "router_ip.py",
        "router_irb.py",
        "router_icf.py",
        "router_vendor.py",
    ]:
        with io.open(BASE + name, encoding="utf-8") as f:
            content = f.read()
        if "save_record(db, user, row, " in content:
            print(f"OK {name} (already applied)")
            continue
        content = sub_all(
            content,
            "save_record(db, row, ",
            "save_record(db, user, row, ",
            f"{name}-save-row",
        )
        if name == "router_feasibility.py":
            content = sub_all(
                content,
                "save_record(db, existing, ",
                "save_record(db, user, existing, ",
                "router_feasibility.py-save-existing",
            )
        with io.open(BASE + name, "w", encoding="utf-8", newline="\n") as f:
            f.write(content)
        print(f"OK {name}")


def patch_deletes():
    with io.open(BASE + "router_amendments.py", encoding="utf-8") as f:
        a = f.read()
    if "enforce_for_model(user, CtmsAmendment, \"delete\")" not in a:
        a = sub(
            a,
            """from .common import (
    CtmsError,
    actor_name,
    audit,
    create_record,
    filter_study,
    guarded,
    list_records,
    load_row,
    save_record,
)""",
            """from .common import (
    CtmsError,
    actor_name,
    audit,
    create_record,
    enforce_for_model,
    filter_study,
    guarded,
    list_records,
    load_row,
    save_record,
)""",
            "router_amendments.py-import",
        )
        a = sub(
            a,
            """    def _delete():
        row, record = load_row(db, CtmsAmendment, user, code, "Amendment not found.")
        delete_amendment(""",
            """    def _delete():
        row, record = load_row(db, CtmsAmendment, user, code, "Amendment not found.")
        enforce_for_model(user, CtmsAmendment, "delete")
        delete_amendment(""",
            "router_amendments.py-delete-enforce",
        )
        with io.open(BASE + "router_amendments.py", "w", encoding="utf-8", newline="\n") as f:
            f.write(a)
        print("OK router_amendments.py delete")
    else:
        print("OK router_amendments.py delete (already applied)")

    with io.open(BASE + "router_feasibility.py", encoding="utf-8") as f:
        fz = f.read()
    if "enforce_for_model(user, CtmsFeasibilityCandidate, \"delete\")" not in fz:
        fz = sub(
            fz,
            "from .common import (",
            "from .common import (\n    enforce_for_model,",
            "router_feasibility.py-import",
        )
        fz = sub(
            fz,
            """    def _delete():
        row, record = load_row(db, CtmsFeasibilityCandidate, user, code, "Candidate not found.")
        can_delete_candidate(record)""",
            """    def _delete():
        row, record = load_row(db, CtmsFeasibilityCandidate, user, code, "Candidate not found.")
        enforce_for_model(user, CtmsFeasibilityCandidate, "delete")
        can_delete_candidate(record)""",
            "router_feasibility.py-delete-enforce",
        )
        with io.open(BASE + "router_feasibility.py", "w", encoding="utf-8", newline="\n") as f:
            f.write(fz)
        print("OK router_feasibility.py delete")
    else:
        print("OK router_feasibility.py delete (already applied)")


def main():
    patch_common()
    patch_save_calls()
    patch_deletes()
    print("ALL OK")


if __name__ == "__main__":
    main()