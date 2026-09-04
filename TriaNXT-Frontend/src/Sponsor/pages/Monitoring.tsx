import React from 'react';

import '../styles/Monitoring.css';

import AppLayout from './AppLayout';

const Monitoring = () => {

  return (

    <AppLayout>

      <div className="monitoring-page">

        <div className="page-header">

          <h1>Monitoring Visits</h1>

        </div>

        <div className="monitoring-card">

          <p>
            Site monitoring and compliance tracking
          </p>

        </div>

      </div>

    </AppLayout>

  );

};

export default Monitoring;