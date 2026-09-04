import React, { useRef } from "react";
import { MdUploadFile } from "react-icons/md";

import { FILE_ACCEPT_ATTR } from "./fileTypes";

/**
 * Subject Explorer - Upload button (Phase 4, requirement 1).
 *
 * Thin wrapper around a hidden `<input type="file" multiple>`; single and
 * multiple selection use the same control. Purely presentational - the
 * caller owns validation and persistence via FileService.
 *
 * The input is reset after every selection so re-picking the same file
 * still fires `onChange` (browsers skip the event when the value is
 * unchanged), which matters when a first attempt was rejected.
 *
 * Props
 *   onFiles   (FileList | File[]) => void
 *   disabled  blocks selection (no folder selected / upload in flight)
 *   busy      shows the in-flight label
 *   label     button copy
 *   variant   "primary" | "ghost"
 */
function FileUploadButton({
  onFiles,
  disabled = false,
  busy = false,
  label = "Upload Files",
  variant = "primary",
}: any) {
  const inputRef = useRef(null);

  const handleChange = (event) => {
    const { files } = event.target;

    if (files && files.length > 0) onFiles?.(files);

    // Allow re-selecting the identical file.
    event.target.value = "";
  };

  return (
    <>
      <button
        type="button"
        className={`sf-btn sf-btn--${variant}`}
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
        title={
          disabled
            ? "Select a folder in the explorer to upload files"
            : "Upload one or more files into this folder"
        }
      >
        <MdUploadFile size={16} aria-hidden="true" />
        <span>{busy ? "Uploading…" : label}</span>
      </button>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={FILE_ACCEPT_ATTR}
        className="sf-file-input"
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleChange}
      />
    </>
  );
}

export default FileUploadButton;
