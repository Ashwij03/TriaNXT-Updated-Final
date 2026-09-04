import ROLES from "../../shared/constants/roles";
import EnterpriseNavbarBase from "../../shared/components/dashboard/shared/EnterpriseNavbarBase";

function PINavbar(props) {

  return (
    <EnterpriseNavbarBase
      {...props}
      layoutRole={ROLES.PI}
      liveChatPath="/pi-livechat"
      navbarClassName="pi-navbar enterprise-header--role-branded"
    />
  );
}

export default PINavbar;