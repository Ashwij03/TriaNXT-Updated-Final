import { describe, it, expect, beforeEach } from "vitest";
import {
  addVendor,
  setVendorActive,
  offboardVendor,
  isVendorContractExpiring,
  getVendors,
  registerKit,
  advanceKitStatus,
  getKits,
  getKit,
  getAllKits,
} from "../vendorService";

describe("vendorService (M22 / spec 6.29)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("adds a vendor and validates name/type", () => {
    const vendor = addVendor({
      name: "Northside Central Lab",
      type: "Central Lab",
      contractRef: "CT-2026-01",
      contractExpiryDate: "2099-01-01",
    });
    expect(vendor.status).toBe("Onboarding");
    expect(getVendors()).toHaveLength(1);

    expect(() => addVendor({ name: "", type: "Central Lab" })).toThrow(/name/);
    expect(() =>
      addVendor({ name: "X", type: "Bogus Lab" })
    ).toThrow(/type/);
    expect(() =>
      addVendor({ name: "Northside Central Lab", type: "Central Lab" })
    ).toThrow(/already exists/);
  });

  it("activates and offboards vendors with a retained reason", () => {
    const vendor = addVendor({ name: "Imaging Co", type: "Imaging" });
    expect(setVendorActive(vendor.id).status).toBe("Active");

    expect(() => offboardVendor(vendor.id)).toThrow(/reason/);
    const offboarded = offboardVendor(vendor.id, "Contract ended.");
    expect(offboarded.status).toBe("Offboarded");
    expect(offboarded.offboardReason).toBe("Contract ended.");
    expect(() => setVendorActive(vendor.id)).toThrow(/reactivated/);
  });

  it("flags contracts expiring inside the horizon", () => {
    const vendor = addVendor({
      name: "Expiring Lab",
      type: "Central Lab",
      contractExpiryDate: new Date(Date.now() + 30 * 86400000)
        .toISOString()
        .split("T")[0],
    });
    expect(isVendorContractExpiring(vendor, 90)).toBe(true);
    const safe = addVendor({
      name: "Safe Lab",
      type: "Central Lab",
      contractExpiryDate: "2099-01-01",
    });
    expect(isVendorContractExpiring(safe, 90)).toBe(false);
  });

  it("registers a kit only with a vendor, subject and visit context", () => {
    const vendor = addVendor({ name: "Core Lab", type: "Central Lab" });
    setVendorActive(vendor.id);

    expect(() => registerKit({})).toThrow(/vendor, subject and visit/);
    const kit = registerKit({
      vendorId: vendor.id,
      studyCode: "STDY-001",
      subjectId: "SUB-100",
      visitCode: "V3",
      kitType: "Serum",
    });
    expect(kit.status).toBe("Collected");
    expect(getKits("STDY-001")).toHaveLength(1);
  });

  it("advances kit status through the chain of custody", () => {
    const vendor = addVendor({ name: "Core Lab", type: "Central Lab" });
    setVendorActive(vendor.id);
    const kit = registerKit({
      vendorId: vendor.id,
      studyCode: "STDY-001",
      subjectId: "SUB-100",
      visitCode: "V3",
      kitType: "Serum",
    });

    advanceKitStatus(kit.id, "Shipped", "Courier pickup");
    advanceKitStatus(kit.id, "Received", "Core Lab intake");
    advanceKitStatus(kit.id, "Resulted");

    const fresh = getKit(kit.id);
    expect(fresh.status).toBe("Resulted");
    expect(fresh.chainOfCustody.map((entry) => entry.action)).toEqual([
      "Collected at site",
      "Shipped",
      "Received",
      "Resulted",
    ]);
    // Cannot move backwards
    expect(() => advanceKitStatus(kit.id, "Collected")).toThrow(/forward/);
    expect(getAllKits()).toHaveLength(1);
  });

  it("blocks kits registered to offboarded vendors", () => {
    const vendor = addVendor({ name: "Gone Lab", type: "Central Lab" });
    setVendorActive(vendor.id);
    offboardVendor(vendor.id, "Closed.");
    expect(() =>
      registerKit({
        vendorId: vendor.id,
        studyCode: "S",
        subjectId: "SUB-1",
        visitCode: "V1",
        kitType: "Urine",
      })
    ).toThrow(/offboarded/);
  });
});
