import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthLayout from "./AuthLayout";

function ForgotPassword() {

  const navigate = useNavigate();

  // Step machine: "email" -> "otp" -> "reset"
  const [step, setStep] = useState("email");

  const [email, setEmail] =
    useState("");

  const [otp, setOtp] =
    useState("");

  // The OTP we generated and (in a real backend) emailed to the user.
  // Kept in state here only because there is no backend yet — see note
  // in handleSendOtp below.
  const [generatedOtp, setGeneratedOtp] =
    useState("");

  const [newPassword, setNewPassword] =
    useState("");

  const [message, setMessage] =
    useState("");

  const handleSendOtp = () => {

    const users =
      JSON.parse(
        localStorage.getItem("users")
      ) || [];

    const userExists =
      users.some(
        (u) => u.email === email
      );

    if (!userExists) {

      setMessage(
        "Email not registered"
      );

      return;
    }

    const code = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    setGeneratedOtp(code);

    // NOTE: There is no email-sending backend/service in this project
    // yet. This is the exact spot where a real API call (e.g.
    // POST /api/auth/send-otp) would go to generate the OTP server-side
    // and email it to the user. Until that exists, we log it to the
    // console so the flow can be tested end-to-end.
    console.log(
      "OTP for " + email + " is " + code
    );

    setMessage(
      "An OTP has been sent to " + email
    );

    setOtp("");
    setStep("otp");
  };

  const handleVerifyOtp = () => {

    if (!otp.trim()) {

      setMessage("Please enter the OTP");

      return;
    }

    if (otp === generatedOtp) {

      setMessage("");
      setStep("reset");

    } else {

      setMessage("Incorrect OTP. Please try again.");
    }
  };

  const handleResendOtp = () => {

    setMessage("");
    handleSendOtp();
  };

  const handleReset = () => {

    if (!newPassword.trim()) {

      setMessage("Please enter a new password");

      return;
    }

    const users =
      JSON.parse(
        localStorage.getItem("users")
      ) || [];

    const userIndex =
      users.findIndex(
        (u) => u.email === email
      );

    if (userIndex === -1) {

      setMessage(
        "Email not registered"
      );

      return;
    }

    users[userIndex].password =
      newPassword;

    localStorage.setItem(
      "users",
      JSON.stringify(users)
    );

    setMessage(
      "Password updated successfully!"
    );

    setTimeout(() => {
      navigate("/login");
    }, 1500);
  };

  return (

    <AuthLayout title="Reset Password">

      {/* STEP 1: EMAIL */}
      {step === "email" && (

        <>

          <div className="input-group">

            <label>Email</label>

            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) =>
                setEmail(
                  e.target.value
                )
              }
            />

          </div>

          <button
            className="auth-btn"
            onClick={handleSendOtp}
          >
            Send OTP
          </button>

        </>
      )}

      {/* STEP 2: OTP */}
      {step === "otp" && (

        <>

          <div className="input-group">

            <label>
              OTP
            </label>

            <input
              type="text"
              placeholder="Enter the OTP sent to your email"
              value={otp}
              onChange={(e) =>
                setOtp(
                  e.target.value
                )
              }
            />

          </div>

          <button
            className="auth-btn"
            onClick={handleVerifyOtp}
          >
            Verify OTP
          </button>

          <div className="login-section">

            <span>
              Didn't get the code?
            </span>

            <button
              type="button"
              className="login-link-btn"
              onClick={handleResendOtp}
            >
              Resend OTP
            </button>

          </div>

        </>
      )}

      {/* STEP 3: NEW PASSWORD */}
      {step === "reset" && (

        <>

          <div className="input-group">

            <label>
              New Password
            </label>

            <input
              type="password"
              placeholder="Enter new password"
              value={newPassword}
              onChange={(e) =>
                setNewPassword(
                  e.target.value
                )
              }
            />

          </div>

          <button
            className="auth-btn"
            onClick={handleReset}
          >
            Reset Password
          </button>

        </>
      )}

      <div className="login-section">

        <span>
          Remember your password?
        </span>

        <button
          type="button"
          className="login-link-btn"
          onClick={() => navigate("/login")}
        >
          Back to Login
        </button>

      </div>

      {message && (
        <p
          style={{
            textAlign: "center",
            marginTop: "0.9375rem",
            color:
              message.includes(
                "success"
              ) || message.includes("sent")
                ? "green"
                : "red",
          }}
        >
          {message}
        </p>
      )}

    </AuthLayout>
  );
}

export default ForgotPassword;