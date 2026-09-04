import "./TriaNXTLogo.css";
import trianxtLogo from "../assets/TriaNXT Logo - Minimalist Design with Globe (24).png";

function TriaNXTLogo({ className = "", onClick, size = "default" }: any) {
  return (
    <div
      className={`trianxt-logo trianxt-logo--${size} ${className}`.trim()}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <img src={trianxtLogo} alt="TriaNXT" className="trianxt-logo-img" />
    </div>
  );
}

export default TriaNXTLogo;
