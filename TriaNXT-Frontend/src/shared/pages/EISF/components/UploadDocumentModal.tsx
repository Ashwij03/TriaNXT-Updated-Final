import { useEffect, useMemo, useRef, useState } from "react";
import { DOCUMENT_TYPE_OPTIONS } from "../Constants/documentTypes";
import { readFileWithProgress } from "../../../utils/fileReadProgress";
import ESignatureModal from "../../../components/ESignatureModal";
import "./UploadDocumentModal.css";

/**
 * Item 18 — Bulk File and Folder Upload.
 *
 * This modal is a backward-compatible extension of the existing single-file
 * upload UI. When the user selects a single file the behavior is unchanged
 * (one `onUpload(form)` invocation, one document created via the existing
 * documentService). When the user selects multiple files or a folder, the
 * modal iterates and invokes `onUpload(form)` once per file so the existing
 * upload service and document store continue to be the only source of
 * truth — no new upload system is introduced.
 *
 * Folder hierarchy is preserved by carrying the file's
 * `webkitRelativePath` (when the browser provides it) into the document
 * name so the folder path stays visible in the existing table.
 */
export default function UploadDocumentModal({
  open,
  onClose,
  onUpload,
  categoryOptions = [],
  defaultCategory = ""
}: any) {
  const [form, setForm] = useState({
    documentName: "",
    category: defaultCategory || "",
    version: "",
    comments: "",
    file: null
  });
  const [error, setError] = useState("");
  const [queue, setQueue] = useState<any[]>([]); // [{ id, file, relativePath, progress, status }]
  const [isUploading, setIsUploading] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  /* Single-file staged upload: after Upload is clicked the chosen file is
     read for real (progress 0-100%), and only after the whole file has been
     read does the footer switch to Save, which persists the document through
     the existing onUpload service call. { file, progress, done } */
  const [stage, setStage] = useState(null);
  /* Mandatory E-Signature gate: { entityName, queueSnapshot? } — while set,
     the E-Signature modal is shown and NOTHING is persisted until the user
     signs. Cancelling the signature cancels the upload entirely. */
  const [signing, setSigning] = useState(null);

  const folderInputRef = useRef(null);
  const filesInputRef = useRef(null);

  const categories = useMemo(() => {
    const options = Array.isArray(categoryOptions) ? categoryOptions : [];
    return options.length ? options : DOCUMENT_TYPE_OPTIONS;
  }, [categoryOptions]);

  useEffect(() => {
    if (open) {
      setForm((prev) => ({
        ...prev,
        category: defaultCategory || prev.category
      }));
      setError("");
    } else {
      // Reset transient state when the modal is closed.
      setQueue([]);
      setIsUploading(false);
      setBatchProgress(0);
      setIsDragging(false);
      setStage(null);
      setSigning(null);
    }
  }, [open, defaultCategory]);

  // Directory-selection attributes are non-standard, so set them via
  // the DOM to avoid React "unknown prop" warnings and to keep the
  // graceful degradation on browsers that ignore them.
  useEffect(() => {
    const el = folderInputRef.current;
    if (!el) return;
    try {
      el.setAttribute("webkitdirectory", "");
      el.setAttribute("directory", "");
      el.setAttribute("mozdirectory", "");
    } catch (err) {
      /* no-op: unsupported browsers just get a plain file picker */
    }
  }, [open]);

  if (!open) return null;

  const isMultiMode = queue.length > 0;

  const addFilesToQueue = (fileList) => {
    if (!fileList || fileList.length === 0) return;

    const now = Date.now();
    const items = (Array.from(fileList) as File[]).map((file, index) => ({
      id: `${now}-${index}-${file.name}`,
      file,
      relativePath: file.webkitRelativePath || file.name,
      progress: 0,
      status: "pending"
    }));

    setQueue((prev) => [...prev, ...items]);

    // If only one file has ever been added and no legacy single file is
    // set, keep the legacy `form.file` in sync so single-file behavior
    // remains identical when the user does not use bulk features.
    setForm((prev) => {
      if (prev.file || fileList.length !== 1) return prev;
      const only = fileList[0];
      return {
        ...prev,
        file: only,
        documentName: prev.documentName || only.name
      };
    });
  };

  const handleFilesChange = (event) => {
    addFilesToQueue(event.target.files);
    // Clear so selecting the same file again still fires onChange.
    event.target.value = "";
  };

  const handleFolderChange = (event) => {
    addFilesToQueue(event.target.files);
    event.target.value = "";
  };

  const handleLegacyFileChange = (event) => {
    const only = event.target.files && event.target.files[0];
    setForm((prev) => ({
      ...prev,
      file: only || null,
      documentName: prev.documentName || (only ? only.name : "")
    }));
  };

  const removeQueued = (id) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const clearQueue = () => {
    setQueue([]);
  };

  const onDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const onDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const onDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    const dropped = event.dataTransfer?.files;
    if (dropped && dropped.length > 0) {
      addFilesToQueue(dropped);
    }
  };

  const resetAll = () => {
    setForm({
      documentName: "",
      category: defaultCategory || "",
      version: "",
      comments: "",
      file: null
    });
    setQueue([]);
    setIsUploading(false);
    setBatchProgress(0);
    setError("");
    setStage(null);
    setSigning(null);
  };

  /**
   * Perform the REAL upload — only ever reached with a completed
   * E-Signature (runSignedUpload is wired to the modal's onSigned).
   * The signature is passed through onUpload so the caller binds it to
   * every created document record + audit trail.
   */
  const runSignedUpload = async (signature) => {
    // Multi-file / folder path — one E-Signature covers the whole batch.
    if (queue.length > 0) {
      setError("");
      setIsUploading(true);
      setBatchProgress(0);

      const total = queue.length;
      let completed = 0;

      // Reuse the existing single-file upload service by calling
      // `onUpload(form, signature)` once per queued file. This preserves
      // the existing document store and folder hierarchy.
      for (let i = 0; i < queue.length; i += 1) {
        const item = queue[i];

        setQueue((prev) =>
          prev.map((row) =>
            row.id === item.id ? { ...row, status: "uploading", progress: 25 } : row
          )
        );

        // Yield to the event loop so progress can render.
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, 0));

        try {
          onUpload(
            {
              documentName: item.relativePath || item.file.name,
              category: form.category,
              version: form.version,
              comments: form.comments,
              file: item.file,
              relativePath: item.relativePath
            },
            signature
          );

          setQueue((prev) =>
            prev.map((row) =>
              row.id === item.id ? { ...row, status: "done", progress: 100 } : row
            )
          );
        } catch (uploadError) {
          setQueue((prev) =>
            prev.map((row) =>
              row.id === item.id ? { ...row, status: "error", progress: 100 } : row
            )
          );
        }

        completed += 1;
        setBatchProgress(Math.round((completed / total) * 100));
      }

      setIsUploading(false);
      // Close after a short delay so the user can see the completed state.
      setTimeout(() => {
        resetAll();
        onClose();
      }, 300);
      return;
    }

    // Legacy single-file path.
    setError("");
    onUpload(form, signature);
    resetAll();
    onClose();
  };

  /** Open the mandatory E-Signature step — nothing is persisted until the
      user signs; cancelling the modal cancels the upload. */
  const openSignatureStep = (entityName) => {
    setError("");
    setSigning({ entityName: entityName || "document upload" });
  };

  const submit = async () => {
    // Multi-file / folder path.
    if (isMultiMode) {
      if (!form.category) {
        setError("Please choose a category before uploading.");
        return;
      }

      // Mandatory E-Signature BEFORE any queued file is persisted.
      const firstName = queue[0]?.file?.name || queue[0]?.relativePath || "";
      openSignatureStep(
        queue.length === 1
          ? firstName
          : `${queue.length} files — ${firstName || "folder upload"}${firstName ? " …" : ""}`
      );
      return;
    }

    // Legacy single-file path. Upload is now staged like the shared
    // document managers: the chosen file is read for real (progress to
    // 100%), and only then does Save persist it via the existing
    // onUpload service call.
    if (!form.documentName || !form.category || !form.file) {
      setError("Please fill all mandatory fields.");
      return;
    }

    // Save after the staged read completed at 100%.
    if (stage?.done) {
      // The user re-picked the file mid-stage (inputs are disabled while a
      // stage is active, but guard anyway): restart the stage rather than
      // persisting a file that was never read.
      if (stage.file !== form.file) {
        setStage(null);
        setIsUploading(false);
        setError("The selected file changed. Please upload it again.");
        return;
      }

      // Mandatory E-Signature before the upload persists.
      openSignatureStep(form.documentName || form.file.name || "document upload");
      return;
    }

    // Already reading this file - ignore repeated clicks.
    if (stage) return;

    setError("");
    setIsUploading(true);
    setStage({ file: form.file, progress: 0 });

    readFileWithProgress(form.file, (progress) => {
      setStage((current) =>
        current ? { ...current, progress } : current
      );
    })
      .then(() => {
        // Whole file read -> real 100%. Save appears only now.
        setStage((current) =>
          current ? { ...current, progress: 100, done: true } : current
        );
        setIsUploading(false);
      })
      .catch(() => {
        setStage(null);
        setIsUploading(false);
        setError(
          "The file could not be read. Please choose it again and retry."
        );
      });
    return;
  };

  return (
    <div className="upload-backdrop">
      <div className="upload-modal">
        <div className="upload-header">Upload Document</div>

        <div className="upload-body">
          {error && <div className="upload-error">{error}</div>}

          {!isMultiMode && (
            <>
              <label>Document Name *</label>
              <input
                value={form.documentName}
                onChange={(e) =>
                  setForm({ ...form, documentName: e.target.value })
                }
                disabled={Boolean(stage)}
              />
            </>
          )}

          <label>Category *</label>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            disabled={Boolean(stage)}
          >
            <option value="">Select</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>

          <label>Version</label>
          <input
            value={form.version}
            onChange={(e) => setForm({ ...form, version: e.target.value })}
            disabled={Boolean(stage)}
          />

          {!isMultiMode && (
            <>
              <label>Select File *</label>
              <input
                type="file"
                onChange={handleLegacyFileChange}
                disabled={Boolean(stage)}
              />
            </>
          )}

          <label>Bulk Upload — Files or Folder</label>
          <div
            className={`upload-dropzone${isDragging ? " dragging" : ""}`}
            onDragOver={onDragOver}
            onDragEnter={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}>

            <p className="upload-dropzone-text">
              Drag &amp; drop files or a folder here, or use the buttons below.
            </p>
            <div className="upload-dropzone-actions">
              <button
                type="button"
                className="cancel-btn"
                onClick={() => filesInputRef.current?.click()}
                disabled={isUploading || Boolean(stage)}
              >
                Add Files
              </button>
              <button
                type="button"
                className="cancel-btn"
                onClick={() => folderInputRef.current?.click()}
                disabled={isUploading || Boolean(stage)}
              >
                Add Folder
              </button>
              {isMultiMode && (
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={clearQueue}
                  disabled={isUploading}>

                  Clear
                </button>
              )}
            </div>

            <input
              ref={filesInputRef}
              type="file"
              multiple
              hidden
              onChange={handleFilesChange}
            />
            <input
              ref={folderInputRef}
              type="file"
              hidden
              onChange={handleFolderChange}
            />
          </div>

          {!isMultiMode && stage && (
            <div
              className="upload-progress-block"
              role="status"
              aria-live="polite"
            >
              <span className="upload-single-progress-label">
                {form.documentName || stage.file?.name || "Uploading…"} —{" "}
                {stage.progress}%
              </span>
              <div className="upload-progress-track" aria-hidden="true">
                <div
                  className={`upload-progress-fill ${
                    stage.done ? "status-done" : "status-uploading"
                  }`}
                  style={{ width: `${stage.progress}%` }}
                />
              </div>
            </div>
          )}

          {isMultiMode && (
            <div className="upload-queue">
              <div className="upload-queue-header">
                <span>{queue.length} file{queue.length === 1 ? "" : "s"} queued</span>
                {isUploading && (
                  <span className="upload-batch-progress">
                    Batch: {batchProgress}%
                  </span>
                )}
              </div>

              {isUploading && (
                <div className="upload-progress-track" aria-label="Batch progress">
                  <div
                    className="upload-progress-fill batch"
                    style={{ width: `${batchProgress}%` }}
                  />
                </div>
              )}

              <ul className="upload-queue-list">
                {queue.map((item) => (
                  <li key={item.id} className="upload-queue-item">
                    <div className="upload-queue-item-row">
                      <span className="upload-queue-name" title={item.relativePath}>
                        {item.relativePath}
                      </span>
                      <span className={`upload-queue-status status-${item.status}`}>
                        {item.status === "pending" && "Pending"}
                        {item.status === "uploading" && "Uploading…"}
                        {item.status === "done" && "Done"}
                        {item.status === "error" && "Error"}
                      </span>
                      {!isUploading && item.status !== "done" && (
                        <button
                          type="button"
                          className="upload-queue-remove"
                          onClick={() => removeQueued(item.id)}
                          aria-label={`Remove ${item.relativePath}`}>

                          ×
                        </button>
                      )}
                    </div>
                    <div className="upload-progress-track">
                      <div
                        className={`upload-progress-fill status-${item.status}`}
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <label>Comments</label>
          <textarea
            rows={3}
            value={form.comments}
            onChange={(e) => setForm({ ...form, comments: e.target.value })}
          />
        </div>

        <div className="upload-footer">
          <button
            type="button"
            className="cancel-btn"
            onClick={onClose}
            disabled={isUploading}>

            Cancel
          </button>
          <button
            type="button"
            className="save-btn"
            onClick={submit}
            disabled={isUploading || Boolean(signing)}
          >
            {isMultiMode
              ? `Upload ${queue.length} File${queue.length === 1 ? "" : "s"}`
              : stage?.done
              ? "Save"
              : isUploading
              ? "Uploading…"
              : "Upload"}
          </button>
        </div>
      </div>

      {/* Mandatory E-Signature gate — the upload only happens after the
          user completes the signature step. */}
      <ESignatureModal
        open={Boolean(signing)}
        mode="upload"
        entityType="document"
        entityName={signing?.entityName || "document upload"}
        scope={{ domain: "eisf", category: form.category }}
        onClose={() => setSigning(null)}
        onSigned={async (signature) => {
          const signingSnapshot = signing;
          setSigning(null);
          if (!signingSnapshot) return;
          await runSignedUpload(signature);
        }}
      />
    </div>
  );
}
