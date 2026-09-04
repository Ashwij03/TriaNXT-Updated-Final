import AdminDashboardLayout from "../components/AdminDashboardLayout";
import ROLES from "../../shared/constants/roles";
import RoleLiveChatPage from "../../shared/components/RoleLiveChatPage";
import useLiveChatNavigation from "../../shared/hooks/useLiveChatNavigation";

function AdminLiveChat() {
  const { returnFromLiveChat, backLabel } = useLiveChatNavigation("/admin-livechat");

  return (
    <AdminDashboardLayout>
      <RoleLiveChatPage
        role={ROLES.ADMIN}
        onBack={returnFromLiveChat}
        backLabel={backLabel}
      />
    </AdminDashboardLayout>
  );
}

export default AdminLiveChat;
