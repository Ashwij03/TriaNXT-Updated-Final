
// newly added

import "./dashboard.css";

function RecentSubjectsWidget({
  subjects = [],
  studyId
}: any) {

  return (

    <div className="dashboard-widget">

      <h3>
        Recent Subjects
      </h3>

      <table
        className="dashboard-table"
      >
        <thead>

          <tr>

            <th>
              Subject ID
            </th>

            <th>
              Study
            </th>

            <th>
              Status
            </th>

          </tr>

        </thead>

        <tbody>

          {
            subjects.map(
              (
                subject
              ) => (

                <tr
                  key={
                    subject.id
                  }
                >
                  <td>
                    {
                      subject.id
                    }
                  </td>

                  <td>
                    {
                      studyId
                        ?? subject.studyId
                        ?? subject.studyCode
                        ?? subject.study?.studyId
                        ?? subject.study?.code
                        ?? "—"
                    }
                  </td>

                  <td>
                    {
                      subject.status
                    }
                  </td>

                </tr>

              )
            )
          }

        </tbody>

      </table>

    </div>

  );
}

export default RecentSubjectsWidget;