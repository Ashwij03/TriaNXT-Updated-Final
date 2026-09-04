// NEW FILE — Dynamic Subscription & Plan Catalog System.
// PaymentModal — the hosted-gateway checkout for paid plan tiers.
//
// Flow (API mode — REACT_APP_API_URL configured):
//   1. POST /billing/subscription/checkout/ { planId } ->
//      { gatewayOrderId, amount, currency, gatewayKey, paymentTransactionId }
//   2. Load the gateway's checkout script ON DEMAND (no blocking <script>
//      in public/index.html) and open the hosted widget with gatewayKey +
//      gatewayOrderId + amount + currency. Card data NEVER touches this
//      frontend — the widget is hosted by the gateway.
//   3. Success callback -> POST /billing/subscription/confirm/ with
//      { paymentTransactionId, gatewayPaymentId, gatewaySignature } (field
//      names taken from the gateway's callback payload). This is the
//      server-side signature-verification moment: it can fail even when the
//      widget reported success, so a confirm failure is shown as a DISTINCT
//      state from a user-cancelled payment.
//   4. Confirm success -> the service refreshes the subscription and fires
//      SUBSCRIPTION_UPDATED_EVENT, then this modal closes with
//      onClose({ outcome: "success" }) so the parent shows its banner.
//
// Demo path (no backend): initiateCheckout() returns a clearly-marked
// simulated payload and the modal shows a "Simulate Successful Payment"
// panel so the full flow can be exercised in the demo build. This path is
// never reached when the backend is configured.
//
// UX: Escape / overlay click close (blocked while a payment is in flight so
// a user can't abandon a half-confirmed transaction), Tab focus trap, and a
// busy phase that prevents double-submission.

import { useEffect, useRef, useState } from "react";
import {
  initiateCheckout,
  confirmPayment,
  rememberCheckoutPlan,
} from "../../services/subscriptionService";
import { formatPrice } from "../../utils/subscriptionFormat";

const RAZORPAY_CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";
const RAZORPAY_SCRIPT_ID = "razorpay-checkout-script";

// Loads the gateway's checkout script exactly once; every later opener
// reuses the already-loaded instance.
function loadGatewayScript() {
  return new Promise<void>((resolve, reject) => {
    if (typeof window !== "undefined" && window.Razorpay) {
      resolve();
      return;
    }

    const existing = document.getElementById(RAZORPAY_SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("The payment gateway could not be loaded.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = RAZORPAY_SCRIPT_ID;
    script.src = RAZORPAY_CHECKOUT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("The payment gateway could not be loaded. Please try again."));
    document.body.appendChild(script);
  });
}

function focusableSelector() {
  return 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
}

function PaymentModal({ plan, onClose }: any) {
  // Phase state machine:
  //   "initializing"  checkout POST in flight
  //   "opening"       gateway script loaded, opening the hosted widget
  //   "paying"        widget open (user in the gateway's hosted checkout)
  //   "confirming"    success callback received, server signature check
  //   "success"       confirmed — about to close with outcome "success"
  //   "cancelled"     user dismissed the widget — no charge was made
  //   "confirm_error" gateway succeeded but server verification failed
  //   "error"         checkout init / script load failed (retry available)
  //   "demo_ready"    no-backend build: simulated checkout panel
  const [phase, setPhase] = useState("initializing");
  const [error, setError] = useState("");
  const [checkout, setCheckout] = useState(null);

  const overlayRef = useRef(null);
  const initiatedRef = useRef(false);
  const closedRef = useRef(false);

  const closeWith = (outcome) => {
    if (closedRef.current) {
      return;
    }
    closedRef.current = true;
    onClose(outcome);
  };

  const handleConfirmSuccess = async (payload, checkoutRecord) => {
    if (closedRef.current) {
      return;
    }

    setPhase("confirming");

    try {
      await confirmPayment({
        paymentTransactionId: checkoutRecord.paymentTransactionId,
        gatewayPaymentId: payload.gatewayPaymentId,
        gatewaySignature: payload.gatewaySignature,
      });
      setPhase("success");
      closeWith({ outcome: "success" });
    } catch (err) {
      // Gateway widget reported success, but the server's signature check
      // failed — show this distinctly from a user-cancelled payment.
      setPhase("confirm_error");
      setError(
        (err && err.message) ||
          "Your payment could not be verified. No plan changes were made — if you were charged, contact support."
      );
    }
  };

  const openGatewayWidget = (checkoutRecord) => {
    const { gatewayOrderId, amount, currency, gatewayKey } = checkoutRecord;

    if (!gatewayKey || !gatewayOrderId) {
      setPhase("error");
      setError("The payment gateway could not be initialized. Please try again.");
      return;
    }

    setPhase("paying");

    try {
      // Hosted widget — card data is entered on the gateway's own page and
      // never passes through this application.
      const razorpay = new window.Razorpay({
        key: gatewayKey,
        amount,
        currency: currency || "INR",
        order_id: gatewayOrderId,
        name: "TriaNXT",
        description: `${plan?.name || "Plan"} subscription`,
        handler: (response) =>
          handleConfirmSuccess(
            {
              gatewayPaymentId: response.razorpay_payment_id,
              gatewaySignature: response.razorpay_signature,
            },
            checkoutRecord
          ),
        modal: {
          ondismiss: () => {
            if (!closedRef.current) {
              setPhase("cancelled");
            }
          },
        },
      });

      razorpay.open();
    } catch {
      setPhase("error");
      setError(
        "The payment window could not be opened. Please try again — no charge was made."
      );
    }
  };

  // Kick off checkout once on open. initiatedRef guards against React
  // StrictMode's dev double-invoke so a single open never creates two
  // PaymentTransaction rows.
  useEffect(() => {
    if (initiatedRef.current) {
      return undefined;
    }
    initiatedRef.current = true;

    const run = async () => {
      try {
        rememberCheckoutPlan(plan.id);

        const checkoutRecord = await initiateCheckout(plan.id);
        if (closedRef.current) {
          return;
        }

        if (checkoutRecord && checkoutRecord.demo) {
          // No-backend demo build: simulate the gateway.
          setCheckout(checkoutRecord);
          setPhase("demo_ready");
          return;
        }

        setCheckout(checkoutRecord);

        await loadGatewayScript();
        if (closedRef.current) {
          return;
        }

        openGatewayWidget(checkoutRecord);
      } catch (err) {
        if (!closedRef.current) {
          setPhase("error");
          setError(
            (err && err.message) ||
              "The checkout could not be started. Please try again."
          );
        }
      }
    };

    run();
    // openGatewayWidget / handleConfirmSuccess are re-created per render;
    // the checkout must only run once per modal open (initiatedRef guards
    // the StrictMode double-invoke), so the mount-only deps are intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  // Escape closes unless a payment/confirmation is in flight (abandoning a
  // half-confirmed transaction must be a deliberate act).
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key !== "Escape") {
        return;
      }

      if (
        phase === "confirming" ||
        phase === "paying" ||
        phase === "success"
      ) {
        return;
      }

      if (phase === "cancelled" || phase === "confirm_error") {
        closeWith({ outcome: phase === "cancelled" ? "cancelled" : "confirm_failed" });
        return;
      }

      onClose({ outcome: "cancelled" });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // closeWith is a stable-by-ref helper; phase/onClose are the real deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, onClose]);

  // Focus the dialog on open + minimal Tab trap.
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) {
      return undefined;
    }

    const firstFocusable = overlay.querySelector(focusableSelector());
    if (firstFocusable) {
      firstFocusable.focus();
    }

    const handleTab = (event) => {
      if (event.key !== "Tab") {
        return;
      }

      const focusables = Array.from(
        overlay.querySelectorAll(focusableSelector()) as unknown as HTMLElement[]
      ).filter((el: any) => !el.disabled && el.offsetParent !== null);

      if (focusables.length === 0) {
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    overlay.addEventListener("keydown", handleTab);
    return () => overlay.removeEventListener("keydown", handleTab);
  }, [phase]);

  const handleOverlayClick = () => {
    if (phase === "confirming" || phase === "paying" || phase === "success") {
      return;
    }
    if (phase === "cancelled" || phase === "confirm_error") {
      closeWith({ outcome: phase === "cancelled" ? "cancelled" : "confirm_failed" });
      return;
    }
    onClose({ outcome: "cancelled" });
  };

  const retryCheckout = () => {
    setPhase("initializing");
    setError("");
    setCheckout(null);

    initiateCheckout(plan.id)
      .then((checkoutRecord) => {
        if (closedRef.current) {
          return null;
        }

        if (checkoutRecord && checkoutRecord.demo) {
          setCheckout(checkoutRecord);
          setPhase("demo_ready");
          return null;
        }

        setCheckout(checkoutRecord);
        return loadGatewayScript().then(() => {
          if (!closedRef.current) {
            openGatewayWidget(checkoutRecord);
          }
        });
      })
      .catch((err) => {
        if (!closedRef.current) {
          setPhase("error");
          setError(
            (err && err.message) ||
              "The checkout could not be started. Please try again."
          );
        }
      });
  };

  const simulateDemoPayment = async () => {
    setPhase("confirming");
    try {
      await confirmPayment({
        paymentTransactionId: checkout.paymentTransactionId,
        gatewayPaymentId: "demo_payment_success",
        gatewaySignature: "demo_signature",
      });
      setPhase("success");
      closeWith({ outcome: "success" });
    } catch (err) {
      setPhase("confirm_error");
      setError(
        (err && err.message) ||
          "The demo payment could not be confirmed. Please try again."
      );
    }
  };

  const busy = phase === "initializing" || phase === "confirming" || phase === "paying" || phase === "success";

  return (
    <div
      className="subscription-modal-overlay payment-modal-overlay"
      onClick={handleOverlayClick}
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Pay for ${plan?.name || "plan"}`}
    >
      <div
        className="subscription-modal payment-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="subscription-modal-header">
          <h3>Subscribe to {plan?.name || "Plan"}</h3>
        </div>

        <div className="subscription-modal-body payment-modal-body">
          <div className="payment-summary">
            <span>Plan</span>
            <strong>{plan?.name || "—"}</strong>
            <span>Price</span>
            <strong>{formatPrice(plan?.price)}</strong>
          </div>

          {(phase === "initializing" || phase === "confirming") && (
            <div className="payment-phase payment-phase--busy">
              <span className="payment-spinner" aria-hidden="true" />
              <p>
                {phase === "initializing"
                  ? "Preparing your secure checkout..."
                  : "Verifying your payment — please wait..."}
              </p>
            </div>
          )}

          {phase === "paying" && (
            <div className="payment-phase">
              <p>
                The secure payment window is open. Complete the payment there
                to continue — your card details are handled by the payment
                gateway, never by this application.
              </p>
            </div>
          )}

          {phase === "demo_ready" && (
            <div className="payment-phase payment-phase--demo">
              <p className="payment-demo-badge">Demo Mode — no real payment</p>
              <p>
                This build has no billing backend configured, so the checkout
                is simulated. Use the button below to exercise the
                post-payment flow.
              </p>
              <button
                type="button"
                className="subscription-btn-save payment-demo-pay-btn"
                onClick={simulateDemoPayment}
              >
                Simulate Successful Payment
              </button>
            </div>
          )}

          {phase === "cancelled" && (
            <div className="payment-phase payment-phase--info">
              <p>
                Payment was not completed — no charge was made. Your
                subscription is unchanged.
              </p>
              <button
                type="button"
                className="subscription-btn-save"
                onClick={() => closeWith({ outcome: "cancelled" })}
              >
                Close
              </button>
            </div>
          )}

          {phase === "confirm_error" && (
            <div className="payment-phase payment-phase--error">
              <p>{error}</p>
              <button
                type="button"
                className="subscription-btn-save"
                onClick={() => closeWith({ outcome: "confirm_failed", message: error })}
              >
                Close
              </button>
            </div>
          )}

          {phase === "error" && (
            <div className="payment-phase payment-phase--error">
              <p>{error}</p>
              <button
                type="button"
                className="subscription-btn-save"
                onClick={retryCheckout}
              >
                Retry
              </button>
            </div>
          )}
        </div>

        <div className="subscription-modal-footer payment-modal-footer">
          <button
            type="button"
            className="subscription-btn-cancel"
            onClick={() =>
              closeWith({ outcome: "cancelled", message: "Payment was not completed — no charge was made." })
            }
            disabled={busy}
          >
            Cancel
          </button>
          <p className="payment-secure-note">
            Payments are processed securely by our payment gateway.
          </p>
        </div>
      </div>
    </div>
  );
}

export default PaymentModal;