import { describe, it, expect, beforeEach } from "vitest";
import {
  recordShipment,
  receiveShipment,
  dispenseToSubject,
  resolveExcursion,
  returnLot,
  destroyLot,
  runReconciliation,
  getExpectedOnHand,
  getLots,
  getLot,
} from "../ipAccountabilityService";

describe("ipAccountabilityService (M19 / spec 6.26)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function receivedLot() {
    const lot = recordShipment({
      studyCode: "STDY-001",
      siteCode: "SITE-01",
      lotNumber: "LOT-2026-A",
      quantity: 100,
    });
    return receiveShipment(lot.id, { condition: "Acceptable" });
  }

  it("records a shipment and confirms receipt with on-hand quantity", () => {
    const lot = receivedLot();
    expect(lot.status).toBe("Received");
    expect(lot.quantityOnHand).toBe(100);
    expect(getExpectedOnHand(lot)).toBe(100);
    expect(getLots("STDY-001")).toHaveLength(1);
  });

  it("validates shipment and receipt inputs", () => {
    expect(() => recordShipment({})).toThrow(/required/);
    expect(() =>
      recordShipment({ studyCode: "S", siteCode: "X", lotNumber: "L1", quantity: 0 })
    ).toThrow(/positive/);
    const lot = recordShipment({ studyCode: "S", siteCode: "X", lotNumber: "L1", quantity: 5 });
    expect(() => receiveShipment(lot.id, { condition: "Warm" })).toThrow(/condition/);
  });

  it("IP-01: blocks dispensation beyond on-hand quantity", () => {
    const lot = receivedLot();
    expect(() => dispenseToSubject(lot.id, "SUB-001", 101)).toThrow(
      /cannot exceed on-hand/
    );
  });

  it("dispenses to a subject and decrements on-hand", () => {
    const lot = receivedLot();
    const after = dispenseToSubject(lot.id, "SUB-001", 40, "V1");
    expect(after.quantityOnHand).toBe(60);
    expect(after.status).toBe("In Use");
    expect(after.transactions.at(-1).type).toBe("Dispense");
    expect(after.transactions.at(-1).subjectId).toBe("SUB-001");
  });

  it("IP-02: excursion with no disposition blocks further dispensation", () => {
    const lot = recordShipment({ studyCode: "S", siteCode: "X", lotNumber: "L2", quantity: 50 });
    receiveShipment(lot.id, { condition: "Excursion", temperature: 9.5 });
    expect(() => dispenseToSubject(lot.id, "SUB-001", 10)).toThrow(
      /excursion requires a disposition decision/
    );
  });

  it("resolves an excursion with a Use disposition and unblocks dispensation", () => {
    const lot = recordShipment({ studyCode: "S", siteCode: "X", lotNumber: "L3", quantity: 50 });
    const received = receiveShipment(lot.id, { condition: "Excursion", temperature: 9.5 });
    const excursion = received.excursions[0];

    resolveExcursion(lot.id, excursion.id, "Use");
    expect(() => dispenseToSubject(lot.id, "SUB-001", 10)).not.toThrow();
    expect(getLot(lot.id).quantityOnHand).toBe(40);
  });

  it("IP-03: destruction requires two-person (witness) evidence", () => {
    const lot = receivedLot();
    expect(() => destroyLot(lot.id)).toThrow(/witness/);
    const after = destroyLot(lot.id, "Dr. Witness");
    expect(after.status).toBe("Destroyed");
    expect(after.quantityOnHand).toBe(0);
  });

  it("reconciliation surfaces discrepancies instead of zeroing them", () => {
    const lot = receivedLot();
    dispenseToSubject(lot.id, "SUB-001", 30, "V1");
    const balanced = runReconciliation(lot.id);
    expect(balanced.reconciliationStatus).toBe("Balanced");

    // Simulate a loss: force on-hand out of line with the transaction trail.
    const store = JSON.parse(localStorage.getItem("trianxtIpAccountability"));
    store.lots[0].quantityOnHand = 60; // trail says 70 remain
    localStorage.setItem("trianxtIpAccountability", JSON.stringify(store));

    const after = runReconciliation(lot.id);
    expect(after.reconciliationStatus).toBe("Discrepancy");
    expect(after.expectedOnHand).toBe(70);
  });

  it("returns remaining quantity and closes the lot when fully returned", () => {
    const lot = receivedLot();
    dispenseToSubject(lot.id, "SUB-001", 40, "V1");
    const after = returnLot(lot.id, 60, "Site closeout return");
    expect(after.status).toBe("Returned");
    expect(after.quantityOnHand).toBe(0);
  });

  it("keeps a full transaction trail for chain of custody", () => {
    const lot = receivedLot();
    dispenseToSubject(lot.id, "SUB-001", 25, "V1");
    const fresh = getLot(lot.id);
    const kinds = fresh.transactions.map((tx) => tx.type);
    expect(kinds).toEqual(["Receipt", "Dispense"]);
    expect(fresh.history.length).toBeGreaterThanOrEqual(2);
  });
});
