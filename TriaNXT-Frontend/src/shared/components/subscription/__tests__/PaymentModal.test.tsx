/**
 * Unit tests for PaymentModal
 * ===========================
 *
 * Verifies the checkout state machine:
 *   - demo build: initiateCheckout()'s simulated payload renders the demo
 *     panel; "Simulate Successful Payment" maps the callback payload to
 *     confirmPayment and closes with { outcome: "success" };
 *   - real gateway: with window.Razorpay stubbed, the widget is opened with
 *     the server's gatewayKey / order / amount / currency, and the handler
 *     payload (razorpay_payment_id / razorpay_signature) is forwarded to
 *     confirmPayment alongside the server's paymentTransactionId;
 *   - confirm failure (server signature verification) renders as a DISTINCT
 *     state from a user-cancelled payment and does not report success;
 *   - user cancellation reports a no-charge outcome;
 *   - checkout-initiation failure offers a working Retry.
 *
 * subscriptionService is mocked so no localStorage/network happens.
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import PaymentModal from "../PaymentModal";
import {
  initiateCheckout,
  confirmPayment,
  rememberCheckoutPlan,
} from "../../../services/subscriptionService";

jest.mock("../../../services/subscriptionService", () => ({
  initiateCheckout: jest.fn(),
  confirmPayment: jest.fn(),
  rememberCheckoutPlan: jest.fn(),
}));

const professionalPlan = {
  id: "plan_professional",
  name: "Professional",
  price: 499,
};

function renderPayment(onClose) {
  return render(<PaymentModal plan={professionalPlan} onClose={onClose} />);
}

beforeEach(() => {
  jest.clearAllMocks();
  delete window.Razorpay;
});

describe("demo build payment flow", () => {
  test("runs the full simulated flow and closes with success", async () => {
    initiateCheckout.mockResolvedValue({
      gatewayOrderId: "demo_order_1",
      amount: 49900,
      currency: "INR",
      gatewayKey: "demo_key",
      paymentTransactionId: "demo_txn_1",
      demo: true,
    });
    confirmPayment.mockResolvedValue({ status: "Active" });

    const onClose = jest.fn();
    renderPayment(onClose);

    // Checkout initiated for the selected plan.
    await screen.findByText("Demo Mode — no real payment");
    expect(rememberCheckoutPlan).toHaveBeenCalledWith("plan_professional");

    // Simulate the gateway reporting success.
    fireEvent.click(
      screen.getByRole("button", { name: "Simulate Successful Payment" })
    );

    await waitFor(() =>
      expect(confirmPayment).toHaveBeenCalledWith({
        paymentTransactionId: "demo_txn_1",
        gatewayPaymentId: "demo_payment_success",
        gatewaySignature: "demo_signature",
      })
    );

    // Success closes the modal with the success outcome for the parent banner.
    await waitFor(() =>
      expect(onClose).toHaveBeenCalledWith({ outcome: "success" })
    );
  });

  test("user cancellation closes with a no-charge outcome", async () => {
    initiateCheckout.mockResolvedValue({
      demo: true,
      paymentTransactionId: "demo_txn_1",
    });
    confirmPayment.mockResolvedValue({});

    const onClose = jest.fn();
    renderPayment(onClose);

    await screen.findByText("Demo Mode — no real payment");

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(onClose).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: "cancelled" })
      )
    );
    expect(confirmPayment).not.toHaveBeenCalled();
    expect(onClose.mock.calls[0][0].message).toMatch(/no charge was made/i);
  });

  test("a failed demo confirm renders the distinct confirm-error state", async () => {
    initiateCheckout.mockResolvedValue({
      demo: true,
      paymentTransactionId: "demo_txn_1",
    });
    confirmPayment.mockRejectedValue(new Error("Signature verification failed."));

    const onClose = jest.fn();
    renderPayment(onClose);

    await screen.findByText("Demo Mode — no real payment");
    fireEvent.click(
      screen.getByRole("button", { name: "Simulate Successful Payment" })
    );

    // Distinct from "cancelled": the widget succeeded but the server check
    // failed — surfaced as an error (the server's message), no success
    // reported, and the modal is NOT auto-closed.
    await screen.findByText("Signature verification failed.");

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() =>
      expect(onClose).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: "confirm_failed",
          message: "Signature verification failed.",
        })
      )
    );
  });

  test("checkout-initiation failure shows an error with a working Retry", async () => {
    initiateCheckout
      .mockRejectedValueOnce(new Error("Billing service unavailable"))
      .mockResolvedValueOnce({
        demo: true,
        paymentTransactionId: "demo_txn_2",
      });

    const onClose = jest.fn();
    renderPayment(onClose);

    await screen.findByText("Billing service unavailable");

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    // Retry re-initiates and lands on the demo panel.
    await screen.findByText("Demo Mode — no real payment");
    expect(initiateCheckout).toHaveBeenCalledTimes(2);
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("real gateway flow (API-mode checkout payload)", () => {
  class FakeRazorpay {
    constructor(options) {
      FakeRazorpay.lastOptions = options;
    }

    open() {
      // Simulate the gateway firing its success handler.
      FakeRazorpay.lastOptions.handler({
        razorpay_payment_id: "pay_abc123",
        razorpay_signature: "sig_xyz789",
      });
    }
  }

  test("opens the hosted widget with the server payload and confirms server-side", async () => {
    window.Razorpay = FakeRazorpay;

    initiateCheckout.mockResolvedValue({
      gatewayOrderId: "order_raz_1",
      amount: 49900,
      currency: "INR",
      gatewayKey: "key_raz_1",
      paymentTransactionId: "txn_raz_1",
      // no demo flag -> real gateway path
    });
    confirmPayment.mockResolvedValue({ status: "Active" });

    const onClose = jest.fn();
    renderPayment(onClose);

    // The widget received the server's gatewayKey/order/amount/currency.
    await waitFor(() =>
      expect(FakeRazorpay.lastOptions).toMatchObject({
        key: "key_raz_1",
        order_id: "order_raz_1",
        amount: 49900,
        currency: "INR",
      })
    );

    // The gateway callback payload is forwarded to the server confirm with
    // the server-side paymentTransactionId (the signature-verification step).
    await waitFor(() =>
      expect(confirmPayment).toHaveBeenCalledWith({
        paymentTransactionId: "txn_raz_1",
        gatewayPaymentId: "pay_abc123",
        gatewaySignature: "sig_xyz789",
      })
    );

    await waitFor(() =>
      expect(onClose).toHaveBeenCalledWith({ outcome: "success" })
    );
  });

  test("a gateway that reports success but fails server verification never reports success", async () => {
    window.Razorpay = FakeRazorpay;

    initiateCheckout.mockResolvedValue({
      gatewayOrderId: "order_raz_2",
      amount: 49900,
      currency: "INR",
      gatewayKey: "key_raz_2",
      paymentTransactionId: "txn_raz_2",
    });
    confirmPayment.mockRejectedValue(
      new Error("Signature mismatch — possible tampering.")
    );

    const onClose = jest.fn();
    renderPayment(onClose);

    await screen.findByText("Signature mismatch — possible tampering.");

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });
});
