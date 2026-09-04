// newly added

import React from "react";
import { useNavigate } from "react-router-dom";

import "./QuickActions.css";

function QuickActions({
  title = "Quick Actions",
  actions = [],
}: any) {

  const navigate =
    useNavigate();

  return (

    <div className="quick-actions-card tnxt-shared-quick-actions">

      <div className="quick-actions-header">

        <h3>{title}</h3>

      </div>

      <div className="quick-actions-grid">

        {actions.map(
          (
            action,
            index
          ) => (

            <div
              key={index}
              className="quick-action-item"
              onClick={() =>
                navigate(
                  action.path
                )
              }
            >
              <div className="action-icon">

                {action.icon}

              </div>

              <div className="action-label">

                {action.label}

              </div>

            </div>

          )
        )}

      </div>

    </div>

  );
}

export default QuickActions;