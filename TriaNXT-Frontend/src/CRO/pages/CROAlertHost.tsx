import React from "react";
import { useCROData } from "./CRODATAContext";
import { CROAlertModal } from "./CROModal";

function CROAlertHost() {
  const { alertModal, closeAlert } = useCROData();

  return (
    <CROAlertModal
      isOpen={alertModal.open}
      onClose={closeAlert}
      title={alertModal.title}
      message={alertModal.message}
    />
  );
}

export default CROAlertHost;
