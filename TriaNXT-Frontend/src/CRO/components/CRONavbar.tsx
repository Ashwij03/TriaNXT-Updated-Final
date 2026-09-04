import ROLES from "../../shared/constants/roles";
import EnterpriseNavbarBase from "../../shared/components/dashboard/shared/EnterpriseNavbarBase";


function CRONavbar(props) {
  return (
    <EnterpriseNavbarBase
      {...props}
      layoutRole={ROLES.CRO}
      liveChatPath="/cro-livechat"
      navbarClassName="cro-navbar enterprise-header--role-branded"
    />
  );
}

export default CRONavbar;
