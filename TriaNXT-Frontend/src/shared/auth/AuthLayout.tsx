import "./Auth.css";
import AuthLogo from "../components/AuthLogo";

const AUTH_FEATURES = [
  {
    icon: "🛡️",
    title: "Secure & Compliant",
    text: "Role-based access with enterprise-grade security.",
  },
  {
    icon: "📊",
    title: "Real-time Insights",
    text: "Dashboards and reporting for smarter decisions.",
  },
  {
    icon: "⚡",
    title: "Streamlined Operations",
    text: "Manage trials and sites efficiently.",
  },
  {
    icon: "🤝",
    title: "Collaborative by Design",
    text: "Work seamlessly across sponsors, sites and study teams.",
  },
];

export default function AuthLayout({ title, children, wide }: any) {
  return (
    <div className="auth-page">
      {/* LEFT PANEL — enterprise intro panel (right panel/form untouched) */}
      <div className="auth-left-panel">
        <div className="auth-left-content">
          <div className="auth-left-top">
            <div className="auth-left-logo">
              <AuthLogo />
              <span className="auth-left-logo-sub">
                Clinical Trial Management System
              </span>
            </div>

            <span className="auth-left-divider"></span>

            <h1 className="auth-left-headline">
              Empowering Clinical Research.
              <br />
              Ensuring Compliance.
            </h1>

            <p className="auth-left-description">
              A unified platform to manage clinical trials, sites, documents and
              compliance with confidence.
            </p>

            <ul className="auth-left-features">
              {AUTH_FEATURES.map((feature) => (
                <li key={feature.title}>
                  <span className="auth-feature-icon">{feature.icon}</span>
                  <div>
                    <h4>{feature.title}</h4>
                    <p>{feature.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL — existing form, unchanged */}
      <div className="auth-right-panel">
        <div className="overlay"></div>

        <div className={wide ? "auth-card auth-card--wide" : "auth-card"}>
          <AuthLogo />

          <h2 className="auth-title">{title}</h2>

          {children}
        </div>
      </div>
    </div>
  );
}
