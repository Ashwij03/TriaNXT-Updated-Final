import React from 'react';
import AppLayout from './AppLayout';
import '../styles/Queries.css';

const Queries = () => {

  const queries = [
    {
      id: 'Q-001',
      study: 'TRIA-001',
      priority: 'High',
      status: 'Open',
      assignedTo: 'Dr. Smith'
    },
    {
      id: 'Q-002',
      study: 'TRIA-002',
      priority: 'Medium',
      status: 'In Review',
      assignedTo: 'Dr. Adams'
    },
    {
      id: 'Q-003',
      study: 'TRIA-003',
      priority: 'Low',
      status: 'Closed',
      assignedTo: 'Dr. Brown'
    }
  ];

  return (

    <AppLayout>

      <div className="queries-page tnxt-compact">

        <h1>Queries</h1>

        <table className="queries-table ctms-standard-table">

          <thead>

            <tr>
              <th>Query ID</th>
              <th>Study</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Assigned To</th>
            </tr>

          </thead>

          <tbody>

            {
              queries.map((query) => (

                <tr key={query.id}>

                  <td>{query.id}</td>
                  <td>{query.study}</td>
                  <td>{query.priority}</td>
                  <td>{query.status}</td>
                  <td>{query.assignedTo}</td>

                </tr>

              ))
            }

          </tbody>

        </table>

      </div>

    </AppLayout>

  );

};

export default Queries;