import React from 'react';

import '../styles/DashboardFilter.css';

const DashboardFilters = ({
  selectedStudy,
  setSelectedStudy,
  selectedRegion,
  setSelectedRegion,
  selectedDate,
  setSelectedDate
}: any) => {

  const handleApplyFilters = () => {
	

  };

  const handleResetFilters = () => {

    setSelectedStudy(
      "All Studies"
    );

    setSelectedRegion(
      "All Regions"
    );

    setSelectedDate("");

  };

  return (

    <div className="dashboard-filters-container">

      <div className="filter-group">

        <label>
          Study
        </label>

        <select
          value={selectedStudy}
          onChange={(e) =>
            setSelectedStudy(
              e.target.value
            )
          }
        >
          <option>
            All Studies
          </option>

          <option>
            Study-001
          </option>

          <option>
            Study-002
          </option>

          <option>
            Study-003
          </option>

        </select>

      </div>

      <div className="filter-group">

        <label>
          Region
        </label>

        <select
          value={selectedRegion}
          onChange={(e) =>
            setSelectedRegion(
              e.target.value
            )
          }
        >
          <option>
            All Regions
          </option>

          <option>
            North America
          </option>

          <option>
            Europe
          </option>

          <option>
            Asia Pacific
          </option>

        </select>

      </div>

      <div className="filter-group">

        <label>
          Date
        </label>

        <input
          type="date"
          value={selectedDate}
          onChange={(e) =>
            setSelectedDate(
              e.target.value
            )
          }
        />

      </div>

      <div className="filter-buttons">

        <button
          className="apply-btn"
          onClick={handleApplyFilters}
        >
          Apply Filters
        </button>

        <button
          className="reset-btn"
          onClick={handleResetFilters}
        >
          Reset
        </button>

      </div>

    </div>

  );

};

export default DashboardFilters;