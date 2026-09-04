import React, { useState } from 'react';
import {
  getPlanCatalog,
  getDefaultPlan,
} from '../../shared/services/planCatalogService';
import '../styles/SubscriptionEditModal.css';

// Status is subscription state, not catalog data — the three computed
// statuses are the license vocabulary (getSubscriptionStatus returns them).
const STATUS_OPTIONS = ['Active', 'Expired', 'Suspended'];

const SubscriptionEditModal = ({ subscription, onSave, onClose }: any) => {
  // Plan tiers are read live from the catalog so Admin-defined plans show
  // up here automatically — no hardcoded Basic/Professional/Enterprise list.
  const planCatalog = getPlanCatalog();
  const defaultPlan = getDefaultPlan();

  // Resolve the current selection: prefer the stored planId when it still
  // exists in the catalog; fall back to a name match (legacy subscriptions
  // store only the display name); finally fall back to the catalog's
  // default tier. A dangling planId (deleted tier) never survives.
  const initialPlanId =
    (subscription?.planId &&
    planCatalog.some((plan) => plan.id === subscription.planId)
      ? subscription.planId
      : planCatalog.find((plan) => plan.name === subscription?.plan)?.id) ||
    defaultPlan?.id ||
    '';

  const [formData, setFormData] = useState({
    planId: initialPlanId,
    plan: subscription?.plan || defaultPlan?.name || '',
    status: subscription?.status || 'Active',
    startDate: subscription?.startDate || '',
    endDate: subscription?.endDate || '',
    maxUsers: subscription?.maxUsers ?? '',
    maxStudies: subscription?.maxStudies ?? '',
    storageLimit: subscription?.storageLimit ?? '',
    autoRenewal: subscription?.autoRenewal ?? false,
    notes: subscription?.notes || '',
  });
  const [errors, setErrors] = useState<Record<string, any>>({});

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validate = () => {
    const newErrors: Record<string, any> = {};;

    if (!formData.planId) newErrors.plan = 'Plan is required';
    if (!formData.status) newErrors.status = 'Status is required';
    if (!formData.startDate) newErrors.startDate = 'Start date is required';
    if (!formData.endDate) newErrors.endDate = 'End date is required';

    if (formData.startDate && formData.endDate && formData.endDate < formData.startDate) {
      newErrors.endDate = 'End date must be on or after start date';
    }

    const maxUsers = Number(formData.maxUsers);
    if (formData.maxUsers === '' || formData.maxUsers === null || formData.maxUsers === undefined) {
      newErrors.maxUsers = 'Maximum users is required';
    } else if (Number.isNaN(maxUsers) || maxUsers <= 0) {
      newErrors.maxUsers = 'Maximum users must be greater than 0';
    }

    const maxStudies = Number(formData.maxStudies);
    if (formData.maxStudies === '' || formData.maxStudies === null || formData.maxStudies === undefined) {
      newErrors.maxStudies = 'Maximum studies is required';
    } else if (Number.isNaN(maxStudies) || maxStudies <= 0) {
      newErrors.maxStudies = 'Maximum studies must be greater than 0';
    }

    const storageLimit = Number(formData.storageLimit);
    if (formData.storageLimit === '' || formData.storageLimit === null || formData.storageLimit === undefined) {
      newErrors.storageLimit = 'Storage limit is required';
    } else if (Number.isNaN(storageLimit) || storageLimit <= 0) {
      newErrors.storageLimit = 'Storage limit must be greater than 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;

    // Persist the resolved tier: planId is the stable reference, and the
    // display name is kept in sync for backward-compatible consumers.
    const selectedPlan = planCatalog.find((plan) => plan.id === formData.planId);

    onSave({
      ...formData,
      planId: selectedPlan?.id || formData.planId,
      plan: selectedPlan?.name || formData.plan,
      maxUsers: Number(formData.maxUsers),
      maxStudies: Number(formData.maxStudies),
      storageLimit: Number(formData.storageLimit),
    });
  };

  const handleOverlayClick = () => {
    onClose();
  };

  const handleModalClick = (e) => {
    e.stopPropagation();
  };

  return (
    <div className="subscription-modal-overlay" onClick={handleOverlayClick}>
      <div className="subscription-modal" onClick={handleModalClick}>
        <div className="subscription-modal-header">
          <h3>Edit Subscription</h3>
        </div>

        <div className="subscription-modal-body">
          <div className="subscription-form-grid">
            <div className="subscription-form-group">
              <label>Plan *</label>
              <select
                value={formData.planId}
                onChange={(e) => handleChange('planId', e.target.value)}
              >
                {planCatalog.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
              {errors.plan && <span className="subscription-field-error">{errors.plan}</span>}
            </div>

            <div className="subscription-form-group">
              <label>Status *</label>
              <select
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value)}
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              {errors.status && <span className="subscription-field-error">{errors.status}</span>}
            </div>

            <div className="subscription-form-group">
              <label>Start Date *</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => handleChange('startDate', e.target.value)}
              />
              {errors.startDate && <span className="subscription-field-error">{errors.startDate}</span>}
            </div>

            <div className="subscription-form-group">
              <label>End Date *</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => handleChange('endDate', e.target.value)}
              />
              {errors.endDate && <span className="subscription-field-error">{errors.endDate}</span>}
            </div>

            <div className="subscription-form-group">
              <label>Maximum Users *</label>
              <input
                type="number"
                min="1"
                value={formData.maxUsers}
                onChange={(e) => handleChange('maxUsers', e.target.value)}
              />
              {errors.maxUsers && <span className="subscription-field-error">{errors.maxUsers}</span>}
            </div>

            <div className="subscription-form-group">
              <label>Maximum Studies *</label>
              <input
                type="number"
                min="1"
                value={formData.maxStudies}
                onChange={(e) => handleChange('maxStudies', e.target.value)}
              />
              {errors.maxStudies && <span className="subscription-field-error">{errors.maxStudies}</span>}
            </div>

            <div className="subscription-form-group">
              <label>Storage Limit (GB) *</label>
              <input
                type="number"
                min="1"
                value={formData.storageLimit}
                onChange={(e) => handleChange('storageLimit', e.target.value)}
              />
              {errors.storageLimit && <span className="subscription-field-error">{errors.storageLimit}</span>}
            </div>

            <div className="subscription-form-group subscription-form-group-checkbox">
  <label className="checkbox-label">
    <input
      type="checkbox"
      checked={!!formData.autoRenewal}
      onChange={(e) => handleChange('autoRenewal', e.target.checked)}
    />
    <span>Auto Renewal</span>
  </label>
</div>

            <div className="subscription-form-group subscription-form-group-wide">
              <label>Notes</label>
              <textarea
                rows={3}
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                placeholder="Add any notes about this subscription..."
              />
            </div>
          </div>
        </div>

        <div className="subscription-modal-footer">
          <button type="button" className="subscription-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="subscription-btn-save" onClick={handleSave}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionEditModal;