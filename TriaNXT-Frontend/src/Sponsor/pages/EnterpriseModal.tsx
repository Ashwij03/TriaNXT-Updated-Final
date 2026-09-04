import React from 'react';
import '../styles/SponsorShared.css';

const EnterpriseModal = ({ title, children, onClose, onSave, saveLabel = 'Save' }: any) => (
  <div className="sponsor-modal-overlay" onClick={onClose}>
    <div className="sponsor-modal" onClick={(e) => e.stopPropagation()}>
      <h2>{title}</h2>
      {children}
      <div className="sponsor-modal-actions">
        <button type="button" className="sponsor-btn-secondary" onClick={onClose}>
          Cancel
        </button>
        {onSave && (
          <button type="button" className="sponsor-btn-primary" onClick={onSave}>
            {saveLabel}
          </button>
        )}
      </div>
    </div>
  </div>
);

export default EnterpriseModal;
