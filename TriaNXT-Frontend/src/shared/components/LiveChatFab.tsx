import { FiMessageSquare } from "react-icons/fi";
import { useLocation } from "react-router-dom";
import useLiveChatNavigation from "../hooks/useLiveChatNavigation";
import "../../PI/styles/PIDashboard.css";

const LIVE_CHAT_ROUTE_SUFFIXES = [
  "/pi-livechat",
  "/admin-livechat",
  "/site-staff-livechat",
  "/cro-livechat",
  "/live-chat",
];

function LiveChatFab({ liveChatPath }: any) {
  const location = useLocation();
  const { openLiveChat } = useLiveChatNavigation(liveChatPath);

  const isLiveChatRoute = LIVE_CHAT_ROUTE_SUFFIXES.some((suffix) =>
    location.pathname.endsWith(suffix)
  );

  if (!liveChatPath || isLiveChatRoute) {
    return null;
  }

  return (
    <button
      type="button"
      className="floating-chat-btn"
      onClick={openLiveChat}
      aria-label="Open live chat"
    >
      <FiMessageSquare size={40} />
    </button>
  );
}

export default LiveChatFab;
