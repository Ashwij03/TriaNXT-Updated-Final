/**
 * Unit tests for PlanPickerModal
 * ==============================
 *
 * Verifies the shared picker's logic:
 *   - the catalog renders as tier cards with the current plan marked (the
 *     current card's action is disabled; a current PAID tier still renders
 *     a disabled "Select & Pay", while a current FREE tier says "Current Plan");
 *   - free tiers offer "Select" -> lightweight confirm; paid tiers offer
 *     "Select & Pay" (-> onPay); Admins get a secondary "Assign without
 *     payment" on paid non-current tiers (-> confirm -> onAssignWithoutPayment);
 *   - assignment failures surface through the in-modal error line and the
 *     confirm action stays retryable (error surfacing);
 *   - Escape / overlay click close; an empty catalog renders its empty state.
 *
 * planCatalogService is mocked (its own behavior is covered by the service
 * suites) so each test controls exactly which catalog renders.
 */

import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import PlanPickerModal from "../PlanPickerModal";
import { getPlanCatalog } from "../../../services/planCatalogService";

jest.mock("../../../services/planCatalogService", () => ({
  getPlanCatalog: jest.fn(),
  UNLIMITED_LIMIT: 999999,
}));

const seedCatalog = [
  {
    id: "plan_basic",
    name: "Basic",
    price: 0,
    isDefault: true,
    features: [],
    maxStudies: 3,
    maxUsers: 5,
    storageLimitGb: 10,
  },
  {
    id: "plan_professional",
    name: "Professional",
    price: 499,
    isDefault: false,
    features: [],
    maxStudies: 10,
    maxUsers: 25,
    storageLimitGb: 100,
  },
  {
    id: "plan_enterprise",
    name: "Enterprise",
    price: 1999,
    isDefault: false,
    features: [],
    maxStudies: 999999,
    maxUsers: 999999,
    storageLimitGb: 1000,
  },
];

function cardFor(planName) {
  return screen.getByText(planName).closest(".plan-picker-card");
}

function renderPicker({
  currentPlanId = "plan_professional",
  adminMode = false,
  onPay = jest.fn(),
  onAssignWithoutPayment = jest.fn().mockResolvedValue({}),
  onClose = jest.fn(),
}: any = {}) {
  return render(
    <PlanPickerModal
      currentPlanId={currentPlanId}
      adminMode={adminMode}
      onPay={onPay}
      onAssignWithoutPayment={onAssignWithoutPayment}
      onClose={onClose}
    />
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  getPlanCatalog.mockReturnValue(seedCatalog);
});

describe("catalog grid", () => {
  test("renders every tier and disables the current plan's action", () => {
    const { container } = renderPicker();

    expect(screen.getByText("Basic")).toBeInTheDocument();
    expect(screen.getByText("Professional")).toBeInTheDocument();
    expect(screen.getByText("Enterprise")).toBeInTheDocument();

    // The current (Professional) card is visually marked...
    expect(container.querySelector(".plan-picker-card--current")).toBeTruthy();
    expect(within(cardFor("Professional")).getByText("Current Plan")).toBeInTheDocument();

    // ...and its paid action is disabled; Enterprise's stays enabled.
    expect(
      within(cardFor("Professional")).getByRole("button", { name: "Select & Pay" })
    ).toBeDisabled();
    expect(
      within(cardFor("Enterprise")).getByRole("button", { name: "Select & Pay" })
    ).toBeEnabled();

    // Default tier badge shows on Basic.
    expect(within(cardFor("Basic")).getByText("Default")).toBeInTheDocument();

    // Fallback feature rows render from limits (features array was empty).
    expect(screen.getByText("Up to 10 studies")).toBeInTheDocument();
    expect(screen.getByText("Up to Unlimited studies")).toBeInTheDocument();
  });

  test("Select & Pay appears on paid tiers; Select on the free tier", () => {
    renderPicker({ currentPlanId: "plan_professional", adminMode: false });

    // Basic (free, non-current) offers Select.
    expect(within(cardFor("Basic")).getByRole("button", { name: "Select" })).toBeEnabled();

    // Both paid tiers offer Select & Pay (current one disabled).
    expect(
      within(cardFor("Professional")).getByRole("button", { name: "Select & Pay" })
    ).toBeDisabled();
    expect(
      within(cardFor("Enterprise")).getByRole("button", { name: "Select & Pay" })
    ).toBeEnabled();
  });

  test("a current FREE tier says 'Current Plan' instead of Select", () => {
    renderPicker({ currentPlanId: "plan_basic", adminMode: false });

    expect(
      within(cardFor("Basic")).getByRole("button", { name: "Current Plan" })
    ).toBeDisabled();
    // The other tiers stay actionable.
    expect(
      within(cardFor("Professional")).getByRole("button", { name: "Select & Pay" })
    ).toBeEnabled();
  });

  test("non-Admins never see the comped-assignment action", () => {
    renderPicker({ adminMode: false });
    expect(
      screen.queryByRole("button", { name: "Assign without payment" })
    ).not.toBeInTheDocument();
  });

  test("empty catalog renders the empty state instead of a broken grid", () => {
    getPlanCatalog.mockReturnValue([]);

    renderPicker();

    expect(
      screen.getByText("No plans are available yet. Contact your Admin.")
    ).toBeInTheDocument();
  });
});

describe("tier actions", () => {
  test("Select on a free tier opens the confirm step and assigns without payment", async () => {
    const onAssignWithoutPayment = jest.fn().mockResolvedValue({});
    renderPicker({ onAssignWithoutPayment });

    fireEvent.click(within(cardFor("Basic")).getByRole("button", { name: "Select" }));

    // Lightweight confirm dialog (not the payment modal) for free tiers.
    expect(screen.getByText("Assign Basic?")).toBeInTheDocument();
    expect(
      screen.getByText(
        /this plan is free — it will be applied to your organization immediately/i
      )
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Confirm Assignment" }));

    await waitFor(() =>
      expect(onAssignWithoutPayment).toHaveBeenCalledTimes(1)
    );
    expect(onAssignWithoutPayment).toHaveBeenCalledWith(seedCatalog[0]);
  });

  test("paid tiers route to the payment flow through onPay", () => {
    const onPay = jest.fn();
    renderPicker({ onPay });

    fireEvent.click(
      within(cardFor("Enterprise")).getByRole("button", { name: "Select & Pay" })
    );

    expect(onPay).toHaveBeenCalledTimes(1);
    expect(onPay).toHaveBeenCalledWith(seedCatalog[2]); // Enterprise
  });

  test("Admins can comp a paid tier via confirm -> assign without payment", async () => {
    const onAssignWithoutPayment = jest.fn().mockResolvedValue({});
    renderPicker({ adminMode: true, onAssignWithoutPayment });

    // Enterprise card's secondary action.
    fireEvent.click(
      within(cardFor("Enterprise")).getByRole("button", {
        name: "Assign without payment",
      })
    );

    expect(screen.getByText("Assign Enterprise?")).toBeInTheDocument();
    expect(
      screen.getByText(
        /will be applied to your organization immediately without a payment/i
      )
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Confirm Assignment" }));

    await waitFor(() =>
      expect(onAssignWithoutPayment).toHaveBeenCalledWith(seedCatalog[2])
    );
  });

  test("a failed assignment surfaces the error and stays retryable", async () => {
    const onAssignWithoutPayment = jest
      .fn()
      .mockRejectedValue(new Error("Cannot assign a deactivated plan."));
    renderPicker({ onAssignWithoutPayment });

    fireEvent.click(within(cardFor("Basic")).getByRole("button", { name: "Select" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm Assignment" }));

    // Error surfacing (the message renders in the picker + confirm layers).
    const errors = await screen.findAllByText("Cannot assign a deactivated plan.");
    expect(errors.length).toBeGreaterThan(0);

    // The confirm button is re-enabled so the user can retry.
    const confirmButton = screen.getByRole("button", {
      name: "Confirm Assignment",
    });
    expect(confirmButton).toBeEnabled();

    // The dialog stays open — no silent success.
    expect(screen.getByText("Assign Basic?")).toBeInTheDocument();
  });
});

describe("dismissal + guard rails", () => {
  test("Escape closes the picker", () => {
    const onClose = jest.fn();
    renderPicker({ onClose });

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("clicking the overlay backdrop closes the picker", () => {
    const onClose = jest.fn();
    const { container } = renderPicker({ onClose });

    fireEvent.click(container.querySelector(".plan-picker-overlay"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("clicking inside the dialog does not close it", () => {
    const onClose = jest.fn();
    const { container } = renderPicker({ onClose });

    fireEvent.click(container.querySelector(".plan-picker-modal"));

    expect(onClose).not.toHaveBeenCalled();
  });

  test("an in-flight assignment blocks overlay dismissal and double-submit", async () => {
    let resolveAssign;
    const onAssignWithoutPayment = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveAssign = resolve;
        })
    );
    const onClose = jest.fn();
    const { container } = renderPicker({
      onAssignWithoutPayment,
      onClose,
    });

    fireEvent.click(within(cardFor("Basic")).getByRole("button", { name: "Select" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm Assignment" }));

    await waitFor(() => expect(onAssignWithoutPayment).toHaveBeenCalledTimes(1));

    // The confirm action is disabled while the assignment is in flight
    // (label switches to "Assigning...").
    const assigningButton = screen.getByRole("button", { name: "Assigning..." });
    expect(assigningButton).toBeDisabled();

    // Backdrop click while busy must not close the modal.
    fireEvent.click(container.querySelector(".plan-picker-overlay"));
    expect(onClose).not.toHaveBeenCalled();

    // Resolving hands control back to the parent (which closes on success) —
    // the component itself stays open and never double-submits.
    resolveAssign({});
    await waitFor(() =>
      expect(onAssignWithoutPayment).toHaveBeenCalledTimes(1)
    );
    expect(screen.getByText("Assign Basic?")).toBeInTheDocument();
  });
});
