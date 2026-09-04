import RoleCommentsView from "../../shared/components/RoleCommentsView";

// PIComments previously kept its own isolated "piCommentsData" localStorage
// store (via piDashboardService.getCommentsData/saveCommentsData), completely
// disconnected from the shared comment store used everywhere else. That meant:
//   - A comment a PI posted was never visible to Admin/Site Staff/CRO/Sponsor.
//   - CRO/Sponsor comments (posted through the shared commentService) were
//     never visible to the PI, violating B7's "Admin, Site Staff, and PI can
//     view CRO and Sponsor comments" requirement.
//   - It fell back to a hardcoded study ("747-303") whenever no study existed
//     yet in its own isolated storage, which could scope a PI's comment to a
//     study that doesn't correspond to real data.
//
// RoleCommentsView already implements the correct, shared-storage version of
// this exact UI (same layout/CSS, same filters, same sort behavior) and is
// already used by Admin (pages/Admin/Comments.js) and Sponsor
// (pages/Sponsor/Comments.js). PIComments now simply renders it, so PI reads
// and writes through the same "one shared comments storage source for all
// roles" as every other role, scoped by studyCode via commentService.js.
function PIComments({ embedded = false }: any) {
  return <RoleCommentsView embedded={embedded} />;
}

export default PIComments;