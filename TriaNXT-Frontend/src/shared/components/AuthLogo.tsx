import "./AuthLogo.css";
import authLogo from "../assets/TriaNXT Logo - Minimalist Design with Globe (23).png";

function AuthLogo({ className = "" }: any) {
  return (
    <img
      src={authLogo}
      alt="TriaNXT - Clinical Intelligence Accelerated"
      className={`auth-logo-img ${className}`.trim()}
    />
  );
}

export default AuthLogo;