import AppLayout from "./AppLayout";
import ROLES from "../../shared/constants/roles";
import RoleLiveChatPage from "../../shared/components/RoleLiveChatPage";
import useLiveChatNavigation from "../../shared/hooks/useLiveChatNavigation";

function LiveChat() {
  const { returnFromLiveChat, backLabel } = useLiveChatNavigation("/live-chat");

  return (
    <AppLayout>
      <RoleLiveChatPage
        role={ROLES.SPONSOR}
        onBack={returnFromLiveChat}
        backLabel={backLabel}
      />
    </AppLayout>
  );
}

export default LiveChat;
