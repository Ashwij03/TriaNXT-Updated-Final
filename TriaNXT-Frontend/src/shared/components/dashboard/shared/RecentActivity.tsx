// newly added

import { resolveSiteDisplay } from "../../../utils/siteDisplay";

function RecentActivity({ activities = [] }: any) {

  return (

    <div className="activity-card">

      <h3>Recent Activity</h3>

      <ul>

        {activities.map((item) => (

          <li key={item.id}>

            <div className="activity-item">

              <strong>
                {item.title}
              </strong>

              <div className="activity-details">
                {resolveSiteDisplay(item.site)}
              </div>

            </div>

            <span className="activity-time">
              {item.time}
            </span>

          </li>

        ))}

      </ul>

    </div>

  );

}

export default RecentActivity;