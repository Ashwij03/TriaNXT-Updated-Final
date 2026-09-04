import "./DocumentViewer.css";
import StatusBadge from "./StatusBadge";

const EMPTY_VALUE = "-";

function displayValue(value) {
  if (value === null || value === undefined) return EMPTY_VALUE;
  const text = String(value).trim();
  return text ? text : EMPTY_VALUE;
}

function getPreviewUrl(document: any = {}) {
  return (
    document.previewUrl ||
    document.fileUrl ||
    document.url ||
    document.filePath ||
    ""
  );
}

/**
 * Split-view metadata + PDF preview panel.
 *
 * `inline` renders the viewer as the right-hand panel of the eISF split view
 * (metadata fixed at the top, PDF scrollable below). Without `inline` the
 * original modal presentation is preserved for any other consumer.
 */
export default function DocumentViewer({
  open,
  document,
  onClose,
  onDownload,
  inline = false,
  onHistory,
  onAudit,
}: any) {

  if (inline) {
    if (!document) {
      return (
        <div className="viewer-panel viewer-panel-empty">
          <span className="pdf-placeholder-icon">PDF</span>
          <h3>No document selected</h3>
          <p>Select a document from the list to preview it here.</p>
        </div>
      );
    }

    const previewUrl = getPreviewUrl(document);

    return (
      <div className="viewer-panel">

        <div className="viewer-panel-meta">

          <div className="viewer-panel-title">
            <span className="pdf-file-icon">PDF</span>

            <div className="viewer-panel-title-text">
              <h3 title={document.documentName}>{document.documentName}</h3>
              <span>{displayValue(document.fileName)}</span>
            </div>

            <div className="viewer-panel-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => onDownload?.(document)}>

                Download
              </button>

              {onHistory && (
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => onHistory(document)}>

                  Version History
                </button>
              )}

              {onAudit && (
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => onAudit(document)}>

                  Audit Trail
                </button>
              )}

              {onClose && (
                <button
                  type="button"
                  className="viewer-panel-close"
                  onClick={onClose}
                  aria-label="Close preview"
                  title="Close preview">

                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="viewer-panel-grid">
            <div>
              <label>Document Name</label>
              <span title={document.documentName}>{displayValue(document.documentName)}</span>
            </div>

            <div>
              <label>Document Type</label>
              <span>{displayValue(document.documentType || document.category)}</span>
            </div>

            <div>
              <label>Version</label>
              <span>{displayValue(document.version)}</span>
            </div>

            <div>
              <label>Status</label>
              <span className="viewer-panel-status">
                <StatusBadge status={document.status} />
              </span>
            </div>

            <div>
              <label>Uploaded By</label>
              <span>{displayValue(document.uploadedBy || document.owner)}</span>
            </div>

            <div>
              <label>Last Modified</label>
              <span>{displayValue(document.modifiedDate)}</span>
            </div>

            {document.effectiveDate && (
              <div>
                <label>Effective Date</label>
                <span>{displayValue(document.effectiveDate)}</span>
              </div>
            )}
          </div>

        </div>

        <div className="viewer-panel-preview">
          {previewUrl ? (
            <iframe
              className="viewer-panel-frame"
              src={previewUrl}
              title={`${document.documentName} preview`}
            />
          ) : (
            <div className="pdf-placeholder">
              <span className="pdf-placeholder-icon">PDF</span>
              <h3>PDF Preview</h3>
              <p>Mock preview is shown because backend file storage is not connected.</p>
            </div>
          )}
        </div>

      </div>
    );
  }

  if (!open || !document) return null;

  return (
    <div className="viewer-overlay">

      <div className="viewer-modal">

        <div className="viewer-header">

          <div>
            <h3>{document.documentName}</h3>
            <span>{document.fileName}</span>
          </div>

          <button
            type="button"
            className="viewer-close"
            onClick={onClose}>

            ✕
          </button>

        </div>

        <div className="viewer-info">

          <div>
            <label>Category</label>
            <span>{document.category}</span>
          </div>

          <div>
            <label>Status</label>
            <span>{document.status}</span>
          </div>

          <div>
            <label>Version</label>
            <span>{document.version}</span>
          </div>

          <div>
            <label>Uploaded By</label>
            <span>{document.uploadedBy}</span>
          </div>

          <div>
            <label>Modified</label>
            <span>{document.modifiedDate}</span>
          </div>

          <div>
            <label>File Size</label>
            <span>{document.fileSize}</span>
          </div>

          <div className="viewer-info-comments">
            <label>Comments</label>
            <span>{document.comments ? document.comments : "-"}</span>
          </div>

        </div>

        <div className="viewer-preview">

          <div className="pdf-placeholder">

              <span className="pdf-placeholder-icon">PDF</span>

              <h3>
                  PDF Preview
              </h3>

              <p>
                  Mock preview is shown because backend file storage is not connected.
              </p>

          </div>

        </div>

        <div className="viewer-footer">

          <button
            type="button"
            className="secondary-btn"
            onClick={() => onDownload?.(document)}>

            Download
          </button>

          <button
            type="button"
            className="primary-btn"
            onClick={onClose}>

            Close
          </button>

        </div>

      </div>

    </div>
  );
}
