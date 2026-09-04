import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthLayout from "./AuthLayout";
import { initializeUserSession } from "../services/sessionService";

import { settleLicenseEntitlementOnLogin } from "../services/referralService";
import {
  setPIPreviewRole,
  setAdminPreviewRole
} from "../services/roleService";

import { useAuth } from "../context/AuthContext";
function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [usernameError, setUsernameError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  // 🔥 STRICT EMAIL RULE
  const emailRegex = /^(?=.*\d)[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // ✅ EMAIL VALIDATION
  const validateUsername = (value) => {
    if (!value.trim()) {
      setUsernameError("Email is required");
      return false;
    } else if (!emailRegex.test(value)) {
      setUsernameError("Enter a valid email address.");
      return false;
    } else {
      setUsernameError("");
      return true;
    }
  };

  // ✅ PASSWORD VALIDATION
  const validatePassword = (value) => {
    if (!value) {
      setPasswordError("Password is required");
      return false;
    } else if (value.length < 6) {
      setPasswordError("Password must be at least 6 characters long");
      return false;
    } else if (!/[A-Z]/.test(value)) {
      setPasswordError("Password must include at least one uppercase letter");
      return false;
    } else if (!/[a-z]/.test(value)) {
      setPasswordError("Password must include at least one lowercase letter");
      return false;
    } else if (!/[0-9]/.test(value)) {
      setPasswordError("Password must include at least one number");
      return false;
    } else if (!/[!@#$%^&*]/.test(value)) {
      setPasswordError("Password must include at least one special character");
      return false;
    } else {
      setPasswordError("");
      return true;
    }
  };

  // 🚀 LOGIN HANDLER (UPDATED)
  const handleLogin = (e) => {
    e.preventDefault();

    const isEmailValid = validateUsername(username);
	
    const isPasswordValid = validatePassword(password);

    if (!isEmailValid || !isPasswordValid) return;

    // 🔥 GET ALL USERS (ARRAY)
    const users =
      JSON.parse(localStorage.getItem("users")) || [];

    // 🔍 FIND MATCHING USER
    const user = users.find(
      (u) => u.email === username && u.password === password
    );

	if (user) {
    // newly added
    if (
      user.role !== "Admin" &&
      user.approvalStatus !== "Approved"
    ) {

      setPasswordError(
        "Your account is waiting for Admin approval."
      );

      return;
    }
    // newly added till here
	  // 🔐 LOGIN SUCCESS
	  localStorage.setItem("isLoggedIn", "true");

	  // 🔥 STORE NAME FOR DASHBOARD
	  localStorage.setItem("userFullName", user.name);

    localStorage.removeItem("adminPreviewRole");

	  // ✅ ADD THIS LINE (THIS IS YOUR STEP-1 FIX)
	  localStorage.setItem("currentUser", JSON.stringify(user));
    // Sync AuthContext state with localStorage so useAuth() resolves
    // correctly throughout the session (fixes "Unknown user" in audit trails).
    login(user);
    initializeUserSession(user);

    // Task 6 (Ashwij): settle any expired referral license bonus as soon as
    // the session starts. Synchronous, side-effect-free beyond a normal
    // read, and fails soft — never blocks login.
    settleLicenseEntitlementOnLogin(user.id);
    setPIPreviewRole(null);
setAdminPreviewRole(null);

localStorage.removeItem("piPreviewRole");
localStorage.removeItem("adminPreviewRole");
    
    
  

    // newly added

	  if (user.role === "Admin") {

      navigate(
        "/studies",
        { replace: true }
      );
    
    } else if (
      user.role === "SiteStaff"
    ) {
    
      navigate(
        "/studies",
        { replace: true }
      );
    
    } else if (
      user.role === "PI"
    ) {
    
      navigate(
        "/studies",
        { replace: true }
      );
    
    } else if (
      user.role === "CRO"
    ) {
    
      navigate(
        "/studies",
        { replace: true }
      );
    
    } else if (
      user.role === "Sponsor"
    ) {
    
      navigate(
        "/studies",
        { replace: true }
      );
    
    } else {
    
      setPasswordError(
        "Your account role is not recognized. Please contact your administrator."
      );
      return;
    } // newly added till here
	} else {
      setPasswordError("Invalid email or password");
    }
  };

  return (
    <AuthLayout title="Welcome Back">
      <form onSubmit={handleLogin}>

        {/* SIGNUP LINK */}
        <p style={{ marginTop: "0.9375rem", fontSize: "0.875rem", textAlign: "center" }}>
          Don’t have an account?{" "}
          <span
            style={{
              color: "#007bff",
              cursor: "pointer",
              fontWeight: "500"
            }}
            onClick={() => navigate("/register")}>

            Sign Up
          </span>
        </p>

        {/* EMAIL */}
        <div className="input-group">
          <label>Email</label>
          <input
            type="text"
            placeholder="Enter your email"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              validateUsername(e.target.value);
            }}
          />

          {usernameError && (
            <p style={{ color: "red", fontSize: "0.75rem" }}>
              {usernameError}
            </p>
          )}
        </div>

        {/* PASSWORD */}
        <div className="input-group">
                
          <label>Password</label>
                
          <div className="password-box">
                
            <input
              type={
                showPassword
                  ? "text"
                  : "password"
              }
              placeholder="Enter your password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                validatePassword(
                  e.target.value
                );
              }}
              onPaste={(e) =>
                e.preventDefault()
              }
              onCopy={(e) =>
                e.preventDefault()
              }
              onCut={(e) =>
                e.preventDefault()
              }
              onContextMenu={(e) =>
                e.preventDefault()
              }
            />
        
            <span
              className="toggle-text"
              onClick={() =>
                setShowPassword(
                  !showPassword
                )
              }>

              {showPassword
                ? "Hide"
                : "Show"}
            </span>
              
          </div>
              
          <p
            className="forgot-password"
            onClick={() =>
              navigate("/forgot-password")
            }>

            Forgot Password?
          </p>
          
          {passwordError && (
            <p
              style={{
                color: "red",
                fontSize: "0.75rem",
              }}>

              {passwordError}
            </p>
          )}
        
        </div>

        <button type="submit" className="auth-btn">
          Login
        </button>

        {/* DIVIDER — UI only */}
        <div className="auth-divider">
          <span>OR</span>
        </div>

        {/* GOOGLE SIGN-IN — UI only. No Google OAuth is configured in
            this project yet, so this is a placeholder handler and does
            not touch the existing email/password login flow above. */}
        <button
          type="button"
          className="google-btn"
          onClick={() => {
            // TODO: wire up Google OAuth once it's configured for this project
          }}>

          <svg className="google-icon" viewBox="0 0 48 48" aria-hidden="true">
            <path
              fill="#FFC107"
              d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12
              c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24
              c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"
            />
            <path
              fill="#FF3D00"
              d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039
              l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"
            />
            <path
              fill="#4CAF50"
              d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36
              c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"
            />
            <path
              fill="#1976D2"
              d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571
              c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24
              C44,22.659,43.862,21.35,43.611,20.083z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>

        <div className="security-card">

          <div className="security-icon">
            🔐
          </div>

          <div>

            <h4>Secure Login</h4>

            <p>
              Your credentials are protected
              using encrypted authentication
              and secure access controls.
            </p>

          </div>

        </div>

        </form>
    </AuthLayout>
  );
}

export default Login;
