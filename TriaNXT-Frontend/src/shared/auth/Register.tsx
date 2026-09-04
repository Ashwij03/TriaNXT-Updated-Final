import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthLayout from "./AuthLayout";
import "./Auth.css";
import { redeemReferralCode } from "../services/referralService";

// ===== START: Plan selection at signup — decision record =====
// DECISION (recorded per the Dynamic Subscription & Plan Catalog spec §5):
// plan selection is DEFERRED to first login — it is NOT part of registration.
//
// Rationale:
//   - Register.js is a single flat form, not a wizard; bolting a plan-picker
//     step on top would fight the existing UX for marginal value.
//   - A brand-new org has no billing identity yet, and the billing backend
//     assigns the default/free tier at account creation. Collecting a plan
//     choice here would either duplicate that (paid tiers would need a
//     PaymentModal mid-signup) or be ignored for the free tier.
//   - The intended flow: sign up -> land on the default/free tier (or
//     PENDING_PAYMENT) -> My License (route /my-license, every role sees it)
//     shows the Subscribe / Upgrade Plan CTA, which opens the shared
//     PlanPickerModal + PaymentModal. That flow already exists and is the
//     single path for both first-time subscriptions and upgrades.
// If product later wants plan selection at signup, reuse PlanPickerModal /
// PaymentModal from src/shared/components/subscription/ — do not build a
// third variant.
// ===== END: Plan selection at signup — decision record =====

function Register() {

  const navigate = useNavigate();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");

  // Task 6 (Ashwij): optional referral code entered at signup. Purely
  // additive — leaving this blank never blocks registration.
  const [referralCodeInput, setReferralCodeInput] = useState("");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");

  const [password, setPassword] = useState("");

  // UPDATED: Organization Type dropdown replaced with a free-text
  // Organization Name field (application can have unlimited orgs).
  const [organizationName, setOrganizationName] = useState("");
  const [organizationNameError, setOrganizationNameError] = useState("");

  // Pincode — required for every role, no exceptions. Captures the
  // organization's location, which feeds the referral anti-abuse rule.
  const [pincode, setPincode] = useState("");
  const [pincodeError, setPincodeError] = useState("");

  const [role, setRole] = useState("");

  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmError, setConfirmError] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [acceptedPolicy, setAcceptedPolicy] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);

  // newly added: field-level required-validation state for every
  // mandatory field (First Name, Last Name, Username, Role, Policy)
  const [firstNameError, setFirstNameError] = useState("");
  const [lastNameError, setLastNameError] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [roleError, setRoleError] = useState("");
  const [policyError, setPolicyError] = useState("");

  // ROLE OPTIONS //newly added
  // UPDATED: Organization-based role list replaced with the fixed,
  // application-wide role list. NOTE: the stored "value" for Principal
  // Investigator is intentionally kept as "PI" (not "Principal
  // Investigator") because every other part of the app - Login routing,
  // roleService, adminService, RBAC/site-matching, dashboards, etc. -
  // checks user.role === "PI". Only the visible dropdown label is
  // updated to "Principal Investigator" so existing login/permission
  // logic is never broken.
  // Task 7 — Registration Changes: "Admin" removed from the selectable
  // role list. Admin is never created through self-registration; a
  // default Admin account is seeded automatically by adminService
  // (see src/config/defaultAdmin.js), and additional Admins can only be
  // created by an existing Admin from User Management.
  const ROLE_OPTIONS = [
    { value: "SiteStaff", label: "SiteStaff" },
    { value: "PI", label: "Principal Investigator" },
    { value: "CRO", label: "CRO" },
    { value: "Sponsor", label: "Sponsor" }
  ]; // newly added till here

  // Kept (always false now that "Admin" isn't selectable) so the
  // Organization Name requirement/validation logic below - which was
  // already written to key off this flag - doesn't need to change.
  const isAdminRole = role === "Admin";

  const generateUsername = (fname, lname) => {

    if (fname && lname) {

      setUsername(
        fname.charAt(0).toLowerCase() +
        lname.toLowerCase() +
        "01"
      );
    }
  };

  const capitalize = (value) =>
    value.charAt(0).toUpperCase() +
    value.slice(1);

  const validateFirstName = (rawValue) => {

    const val = capitalize(rawValue);

    setFirstName(val);

    generateUsername(val, lastName);

    if (!val.trim()) {

      setFirstNameError("First name is required");

    } else {

      setFirstNameError("");
    }

    setUsernameError("");
  };

  const validateLastName = (rawValue) => {

    const val = capitalize(rawValue);

    setLastName(val);

    generateUsername(firstName, val);

    if (!val.trim()) {

      setLastNameError("Last name is required");

    } else {

      setLastNameError("");
    }

    setUsernameError("");
  };

  const validateEmail = (value) => {

    setEmail(value);

    const regex =
      /^(?=.*\d)[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!value.trim()) {

      setEmailError("Email is required");

    } else if (!regex.test(value)) {

      setEmailError(
        "Enter a valid email address"
      );

    } else {

      setEmailError("");
    }
  };

  const validatePassword = (pwd) => {

    setPassword(pwd);

    const regex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;

    if (!pwd.trim()) {

      setPasswordError("Password is required");

    } else if (!regex.test(pwd)) {

      setPasswordError(
        "Min 8 chars, upper, lower, number & special char"
      );

    } else {

      setPasswordError("");
    }

    if (
      confirmPassword &&
      pwd !== confirmPassword
    ) {

      setConfirmError(
        "Passwords do not match"
      );

    } else if (confirmPassword) {

      setConfirmError("");
    }
  };

  const validateConfirmPassword = (value) => {

    setConfirmPassword(value);

    if (!value.trim()) {

      setConfirmError("Please confirm your password");

    } else {

      setConfirmError(
        value !== password
          ? "Passwords do not match"
          : ""
      );
    }
  };

  // UPDATED: Organization Name validation - required unless the
  // selected role is Admin. Reruns automatically whenever Role changes
  // so the field becomes/stops being mandatory without a page refresh.
  const validateOrganizationName = (value, currentRole) => {

    setOrganizationName(value);

    if (currentRole === "Admin") {

      setOrganizationNameError("");
      return;
    }

    if (!value.trim()) {

      setOrganizationNameError("Organization name is required");

    } else {

      setOrganizationNameError("");
    }
  };

  // Pincode — required for every role, no exceptions (unlike Organization
  // Name, which is skipped for Admin): the point of capturing it is to know
  // the location of every account that could plausibly refer or be referred.
  const validatePincode = (value) => {

    setPincode(value);

    const regex = /^\d{4,10}$/;

    if (!value.trim()) {

      setPincodeError("Pincode is required");

    } else if (!regex.test(value.trim())) {

      setPincodeError(
        "Enter a valid pincode (numbers only)"
      );

    } else {

      setPincodeError("");
    }
  };

  // UPDATED: Role change now dynamically toggles whether Organization
  // Name is required, with no page refresh.
  const handleRoleChange = (value) => {

    setRole(value);

    if (!value) {

      setRoleError("Role is required");

    } else {

      setRoleError("");
    }

    if (value === "Admin") {

      setOrganizationNameError("");

    } else if (!organizationName.trim()) {

      setOrganizationNameError("Organization name is required");

    } else {

      setOrganizationNameError("");
    }
  };

  const handleSignup = (e) => {

    e.preventDefault();

    // newly added: run full mandatory-field validation on submit
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedUsername = username.trim();
    const trimmedOrganizationName = organizationName.trim();
    const trimmedPincode = pincode.trim();

    const nextFirstNameError = trimmedFirstName
      ? ""
      : "First name is required";

    const nextLastNameError = trimmedLastName
      ? ""
      : "Last name is required";

    const nextUsernameError = trimmedUsername
      ? ""
      : "Username is required. Please enter your first and last name.";

    const nextEmailError = !email.trim()
      ? "Email is required"
      : emailError;

    const nextPasswordError = !password.trim()
      ? "Password is required"
      : passwordError;

    const nextConfirmError = !confirmPassword.trim()
      ? "Please confirm your password"
      : confirmError;

    const nextRoleError = role
      ? ""
      : "Role is required";

    const nextOrganizationNameError =
      role === "Admin"
        ? ""
        : (trimmedOrganizationName
          ? ""
          : "Organization name is required");

    const nextPincodeError = !trimmedPincode
      ? "Pincode is required"
      : pincodeError;

    const nextPolicyError = acceptedPolicy
      ? ""
      : "Please accept the Privacy Policy to continue";

    setFirstNameError(nextFirstNameError);
    setLastNameError(nextLastNameError);
    setUsernameError(nextUsernameError);
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    setConfirmError(nextConfirmError);
    setRoleError(nextRoleError);
    setOrganizationNameError(nextOrganizationNameError);
    setPincodeError(nextPincodeError);
    setPolicyError(nextPolicyError);

    if (
      nextFirstNameError ||
      nextLastNameError ||
      nextUsernameError ||
      nextEmailError ||
      nextPasswordError ||
      nextConfirmError ||
      nextRoleError ||
      nextOrganizationNameError ||
      nextPincodeError ||
      nextPolicyError
    ) {

      alert("Please fix errors");

      return;
    }

    // Task 7 — Registration Changes: defensive guard. Admin is not in
    // ROLE_OPTIONS so this can't be reached through the UI, but this
    // stops self-registration as Admin outright even if "role" were
    // ever set some other way.
    if (role === "Admin") {

      setRoleError(
        "Admin accounts cannot be created through registration."
      );

      return;
    }

    let users = [];

    try {

      const storedUsers =
        localStorage.getItem("users");

      users = storedUsers
        ? JSON.parse(storedUsers)
        : [];

    } catch (error) {

      users = [];
    }

    const exists = users.some(
      (u) => u.email === email
    );

    if (exists) {

      setEmailError(
        "You are already registered. Please login."
      );

      return;
    }

    // UPDATED: Organization Name is saved exactly as entered (trimmed
    // of leading/trailing whitespace only). Admin accounts are allowed
    // to register with no organization at all.
    const savedOrganizationName =
      role === "Admin"
        ? ""
        : trimmedOrganizationName;

 // newly added Create new user object

    const newUser = {
      id: Date.now(),

      email,

      password,

      name: firstName + " " + lastName,

      username: trimmedUsername,

      // UPDATED: organizationName now holds the exact free-text value
      // the user typed in. orgType/assignedSite are kept in sync with
      // the same value so existing site-based RBAC/filtering logic
      // (roleService, adminService, auditService, comments, etc.)
      // that already reads user.orgType / user.assignedSite keeps
      // working unchanged.
      organizationName: savedOrganizationName,
      orgType: savedOrganizationName,

      role,

      // UPDATED: persist assigned site for site-scoped RBAC
      assignedSite: savedOrganizationName,

      // Pincode — organization's location. Required for every role (see
      // validatePincode); read back out by id via adminService.getUsers()
      // for the referral same-organization/same-location anti-abuse rule.
      pincode: trimmedPincode,

      approvalStatus:
        role === "Admin"
          ? "Approved"
          : "Pending",
      
      accountStatus:
        role === "Admin"
          ? "Active"
          : "Inactive",

      permissions:
        role === "Admin"
          ? ["*"]
          : [],

      requestedPermissions: [],

        permissionRequestDate:
          null,
            
        lastPermissionUpdate:
          null
    };  // newly added till here

    users.push(newUser);

    localStorage.setItem(
      "users",
      JSON.stringify(users)
    );

    // Task 6 (Ashwij): optional referral code redemption. Runs AFTER the
    // new account is already saved, so a bad/invalid code can never block
    // registration itself — it only silently fails to grant the bonus.
    if (referralCodeInput.trim()) {
      redeemReferralCode(newUser.id, referralCodeInput.trim());
    }

    alert("Registration successful!");

    navigate("/login", {
      replace: true
    });
  };

  return (

    <AuthLayout title="Create Account" wide>

      <form onSubmit={handleSignup} className="auth-form-compact">

        <div className="form-row">

        {/* FIRST NAME */}
        <div className="input-group">

          <label>
            First Name
            <span style={{ color: "#d32f2f", marginLeft: "0.25rem" }}>*</span>
          </label>

          <input
            value={firstName}
            placeholder="Enter your first name"
            onChange={(e) =>
              validateFirstName(e.target.value)
            }
            required
          />

          {
            firstNameError && (

              <p className="error">
                {firstNameError}
              </p>
            )
          }

        </div>

        {/* LAST NAME */}
        <div className="input-group">

          <label>
            Last Name
            <span style={{ color: "#d32f2f", marginLeft: "0.25rem" }}>*</span>
          </label>

          <input
            value={lastName}
            placeholder="Enter your last name"
            onChange={(e) =>
              validateLastName(e.target.value)
            }
            required
          />

          {
            lastNameError && (

              <p className="error">
                {lastNameError}
              </p>
            )
          }

        </div>

        </div>

        <div className="form-row">

        {/* USERNAME */}
        <div className="input-group">

          <label>
            Username
            <span style={{ color: "#d32f2f", marginLeft: "0.25rem" }}>*</span>
          </label>

          <input
            value={username}
            placeholder="Enter your username"
            readOnly
          />

          {
            usernameError && (

              <p className="error">
                {usernameError}
              </p>
            )
          }

        </div>

        {/* EMAIL */}
        <div className="input-group">

          <label>
            Email
            <span style={{ color: "#d32f2f", marginLeft: "0.25rem" }}>*</span>
          </label>

          <input
            value={email}
            placeholder="Enter your email"
            onChange={(e) =>
              validateEmail(
                e.target.value
              )
            }
            onPaste={(e) =>
              e.preventDefault()
            }
            onCopy={(e) =>
              e.preventDefault()
            }
            required
          />

          {
            emailError && (

              <p className="error">
                {emailError}
              </p>
            )
          }

        </div>

        </div>

        <div className="form-row">

        {/* PASSWORD */}
        <div className="input-group">

          <label>
            Password
            <span style={{ color: "#d32f2f", marginLeft: "0.25rem" }}>*</span>
          </label>

          <div className="password-box">

            <input
              type={
                showPassword
                  ? "text"
                  : "password"
              }
              value={password}
              placeholder="Enter your password"
              onChange={(e) =>
                validatePassword(
                  e.target.value
                )
              }
              required
            />

            <span
              className="toggle-text"
              onClick={() =>
                setShowPassword(
                  !showPassword
                )
              }>

              {
                showPassword
                  ? "Hide"
                  : "Show"
              }
            </span>

          </div>

          {
            passwordError && (

              <p className="error">
                {passwordError}
              </p>
            )
          }

        </div>

        {/* CONFIRM PASSWORD */}
        <div className="input-group">

          <label>
            Confirm Password
            <span style={{ color: "#d32f2f", marginLeft: "0.25rem" }}>*</span>
          </label>

          <div className="password-box">

            <input
              type={
                showConfirmPassword
                  ? "text"
                  : "password"
              }
              value={confirmPassword}
              placeholder="Confirm your password"
              onChange={(e) =>
                validateConfirmPassword(
                  e.target.value
                )
              }
              required
            />

            <span
              className="toggle-text"
              onClick={() =>
                setShowConfirmPassword(
                  !showConfirmPassword
                )
              }>

              {
                showConfirmPassword
                  ? "Hide"
                  : "Show"
              }
            </span>

          </div>

          {
            confirmError && (

              <p className="error">
                {confirmError}
              </p>
            )
          }

        </div>

        </div>

        <div className="form-row">

        {/* ORGANIZATION NAME */}
        {/* UPDATED: replaced the Organization Type dropdown with a
            free-text Organization Name input. Required for every role
            except Admin. */}
        <div className="input-group">

          <label>
            Organization Name
            {
              !isAdminRole && (
                <span style={{ color: "#d32f2f", marginLeft: "0.25rem" }}>*</span>
              )
            }
          </label>

          <input
            value={organizationName}
            placeholder="Enter organization name"
            onChange={(e) =>
              validateOrganizationName(e.target.value, role)
            }
            required={!isAdminRole}
          />

          {
            organizationNameError && (

              <p className="error">
                {organizationNameError}
              </p>
            )
          }

        </div>

        {/* ROLE */}
        <div className="input-group">

          <label>
            Role
            <span style={{ color: "#d32f2f", marginLeft: "0.25rem" }}>*</span>
          </label>

          <select
            value={role}
            onChange={(e) =>
              handleRoleChange(e.target.value)
            }
            required>

            <option value="">
              Select role
            </option>

            {
              ROLE_OPTIONS.map((option) => (

                <option
                  key={option.value}
                  value={option.value}>

                  {option.label}
                </option>
              ))
            }

          </select>

          {
            roleError && (

              <p className="error">
                {roleError}
              </p>
            )
          }

        </div>

        </div>

        {/* PINCODE + REFERRAL CODE — same row.
            Pincode captures the organization's location for this user and
            is required for every role, no exceptions. Referral Code
            (Task 6 — Ashwij) is optional and never blocks signup. */}
        <div className="form-row">

        <div className="input-group">

          <label>
            Pincode
            <span style={{ color: "#d32f2f", marginLeft: "0.25rem" }}>*</span>
          </label>

          <input
            value={pincode}
            placeholder="Enter your organization's location pincode"
            onChange={(e) =>
              validatePincode(e.target.value)
            }
            required
          />

          {
            pincodeError && (

              <p className="error">
                {pincodeError}
              </p>
            )
          }

        </div>

        <div className="input-group">

          <label>
            Referral Code (optional)
          </label>

          <input
            value={referralCodeInput}
            placeholder="Have a referral code? Enter it here"
            onChange={(e) =>
              setReferralCodeInput(e.target.value)
            }
          />

        </div>

        </div>

        {/* PRIVACY POLICY — full width, kept as its own row (structural
            fix only: previously nested inside the Role field's div) */}
        <div className="policy-container">

          <input
            type="checkbox"
            id="policy"
            checked={acceptedPolicy}
            onChange={() => {

              setAcceptedPolicy(!acceptedPolicy);

              setPolicyError(
                !acceptedPolicy
                  ? ""
                  : "Please accept the Privacy Policy to continue"
              );
            }}
          />

          <label htmlFor="policy">
            I agree to the{" "}
            <span
              className="policy-link"
              onClick={(e) => {
                e.preventDefault();
                setShowPolicy(true);
              }}>

              Privacy Policy
            </span>
            <span style={{ color: "#d32f2f", marginLeft: "0.25rem" }}>*</span>
          </label>
            
        </div>

        {
          policyError && (

            <p className="error">
              {policyError}
            </p>
          )
        }

        {/* BUTTON */}
        <button
          type="submit"
          className="auth-btn"
          disabled={
            !!(emailError || passwordError || confirmError || !acceptedPolicy)
          }>

          SIGN UP
        </button>

        <div className="login-section">

          <span>
            Already have an account?
          </span>

          <button
            type="button"
            className="login-link-btn"
            onClick={() => navigate("/login")}>

            Login
          </button>

        </div>

        <div className="security-card">

          <div className="security-icon">
            🔒
          </div>

          <div>

            <h4>
              Secure Registration
            </h4>

            <p>
              Your information is encrypted
              and protected using
              industry-standard security
              practices.
            </p>

          </div>

        </div>

      </form>

      {showPolicy && (

        <div className="policy-modal">
        
          <div className="policy-content">
            
            <h2>
              TriaNXT Privacy Policy
            </h2>
            
            <p>
              TriaNXT collects user
              information such as
              name, email address,
              organization and role
              for authentication and
              platform access.
            </p>
            
            <p>
              We never sell or share
              personal information
              with unauthorized
              third parties.
            </p>
            
            <p>
              Access to study data,
              dashboards and reports
              is controlled through
              role-based permissions.
            </p>
            
            <p>
              All information is stored
              securely using modern
              encryption standards.
            </p>
            
            <button
              className="close-policy"
              onClick={() =>
                setShowPolicy(false)
              }>

              Close
            </button>
            
          </div>
            
        </div>
      
      )}

    </AuthLayout>
  );
}

export default Register;