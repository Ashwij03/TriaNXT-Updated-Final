import CROLayout from "./CROLayout";
import ROLES from "../../shared/constants/roles";
import RoleLiveChatPage from "../../shared/components/RoleLiveChatPage";
import useLiveChatNavigation from "../../shared/hooks/useLiveChatNavigation";

function CROLiveChat() {
  const { returnFromLiveChat, backLabel } = useLiveChatNavigation("/cro-livechat");

  return (
    <CROLayout>
      <RoleLiveChatPage
        role={ROLES.CRO}
        onBack={returnFromLiveChat}
        backLabel={backLabel}
      />
    </CROLayout>
  );
}

export default CROLiveChat;
