import React, { useCallback, useRef, useState } from "react";
import { MdCloudUpload } from "react-icons/md";

import { FILE_ACCEPT_ATTR, SUPPORTED_EXTENSIONS_LABEL } from "./fileTypes";

/**
 * Subject Explorer - Drag & Drop upload zone (Phase 4, requirement 1).
 *
 * Also click/keyboard operable, so it is a complete alternative to the
 * upload button rather than a mouse-only shortcut.
 *
 * Drag-depth counter: `dragenter`/`dragleave` fire for every child element
 * the pointer crosses, so a naive boolean flickers. Counting enters minus
 * leaves keeps the highlight stable while dragging over inner content.
 *
 * Props
 *   onFiles   (FileList | File[]) => void
 *   disabled  blocks drop + click
 *   busy      shows the in-flight state
 *   compact   slim variant used above a populated table
 *   hint      optional line replacing the default helper copy
 */
function DragDropUpload({
  onFiles,
  disabled = false,
  busy = false,
  compact = false,
  hint,
}: any) {
  const [isDragging, setIsDragging] = useState(false);
  const dragDepth = useRef(0);
  const inputRef = useRef(null);

  const reset = useCallback(() => {
    dragDepth.current = 0;
    setIsDragging(false);
  }, []);

  const handleDragEnter = (event) => {
    event.preventDefault();
    if (disabled || busy) return;

    dragDepth.current += 1;
    setIsDragging(true);
  };

  const handleDragOver = (event) => {
    // Required: without preventDefault the browser navigates to the file.
    event.preventDefault();
    if (disabled || busy) return;
    event.dataTransfer.dropEffect = "copy";
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    if (disabled || busy) return;

    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragging(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    reset();

    if (disabled || busy) return;

    const dropped = event.dataTransfer?.files;
    if (dropped && dropped.length > 0) onFiles?.(dropped);
  };

  const openPicker = () => {
    if (disabled || busy) return;
    inputRef.current?.click();
  };

  const handleChange = (event) => {
    const { files } = event.target;
    if (files && files.length > 0) onFiles?.(files);
    event.target.value = "";
  };

  const className = [
    "sf-dropzone",
    compact ? "sf-dropzone--compact" : "",
    isDragging ? "is-dragging" : "",
    disabled ? "is-disabled" : "",
    busy ? "is-busy" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={className}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-label="Drag and drop files here, or browse to upload"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={openPicker}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openPicker();
        }
      }}
    >
      <span className="sf-dropzone-icon" aria-hidden="true">
        <MdCloudUpload size={compact ? 20 : 26} />
      </span>

      <div className="sf-dropzone-text">
        <strong>
          {busy
            ? "Uploading…"
            : isDragging
            ? "Drop files to upload"
            : "Drag & drop files here"}
        </strong>
        <span>
          {hint ||
            (disabled
              ? "Select a folder in the explorer to enable uploads."
              : `or click to browse · ${SUPPORTED_EXTENSIONS_LABEL}`)}
        </span>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={FILE_ACCEPT_ATTR}
        className="sf-file-input"
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleChange}
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  );
}

export default DragDropUpload;
