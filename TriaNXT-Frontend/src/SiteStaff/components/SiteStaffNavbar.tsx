import ROLES from "../../shared/constants/roles";
import EnterpriseNavbarBase from "../../shared/components/dashboard/shared/EnterpriseNavbarBase";

function SiteStaffNavbar(props) {
  return (
    <EnterpriseNavbarBase
      {...props}
      layoutRole={ROLES.SITE_STAFF}
      liveChatPath="/site-staff-livechat"
      navbarClassName="site-staff-navbar enterprise-header--role-branded"
    />
  );
}

export default SiteStaffNavbar;
