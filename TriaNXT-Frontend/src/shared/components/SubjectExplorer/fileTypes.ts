/**
 * Subject Explorer - SUPPORTED FILE TYPES (Phase 4)
 * =================================================
 *
 * Single source of truth for:
 *   - which extensions are accepted (requirement 8: unsupported types blocked)
 *   - the icon + colour shown per type (requirement 2)
 *   - the `accept` attribute handed to <input type="file">
 *
 * Keeping this in one module means adding a new format later is a one-line
 * change and every consumer (upload button, drag & drop, table, preview)
 * picks it up automatically.
 */

import {
  MdPictureAsPdf,
  MdDescription,
  MdTableChart,
  MdSlideshow,
  MdImage,
  MdFolderZip,
  MdArticle,
  MdInsertDriveFile,
} from "react-icons/md";

/**
 * Supported formats keyed by lower-case extension.
 *
 *   label  short type name shown in the "Type" column
 *   group  coarse family used for filtering/preview decisions
 *   Icon   react-icons component
 *   tone   CSS modifier suffix -> `.sf-file-icon--{tone}`
 *   mimes  accepted MIME types (browsers are inconsistent, so the
 *          extension check is authoritative and MIME is advisory only)
 */
export const FILE_TYPES = {
  pdf: {
    label: "PDF",
    group: "document",
    Icon: MdPictureAsPdf,
    tone: "pdf",
    mimes: ["application/pdf"],
  },
  doc: {
    label: "DOC",
    group: "document",
    Icon: MdDescription,
    tone: "doc",
    mimes: ["application/msword"],
  },
  docx: {
    label: "DOCX",
    group: "document",
    Icon: MdDescription,
    tone: "doc",
    mimes: [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
  },
  xls: {
    label: "XLS",
    group: "spreadsheet",
    Icon: MdTableChart,
    tone: "xls",
    mimes: ["application/vnd.ms-excel"],
  },
  xlsx: {
    label: "XLSX",
    group: "spreadsheet",
    Icon: MdTableChart,
    tone: "xls",
    mimes: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  },
  ppt: {
    label: "PPT",
    group: "presentation",
    Icon: MdSlideshow,
    tone: "ppt",
    mimes: ["application/vnd.ms-powerpoint"],
  },
  pptx: {
    label: "PPTX",
    group: "presentation",
    Icon: MdSlideshow,
    tone: "ppt",
    mimes: [
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
  },
  jpg: {
    label: "JPG",
    group: "image",
    Icon: MdImage,
    tone: "image",
    mimes: ["image/jpeg"],
  },
  jpeg: {
    label: "JPEG",
    group: "image",
    Icon: MdImage,
    tone: "image",
    mimes: ["image/jpeg"],
  },
  png: {
    label: "PNG",
    group: "image",
    Icon: MdImage,
    tone: "image",
    mimes: ["image/png"],
  },
  zip: {
    label: "ZIP",
    group: "archive",
    Icon: MdFolderZip,
    tone: "zip",
    mimes: ["application/zip", "application/x-zip-compressed"],
  },
  txt: {
    label: "TXT",
    group: "text",
    Icon: MdArticle,
    tone: "txt",
    mimes: ["text/plain"],
  },
};

/** Extensions in a stable display order (used in help text / filters). */
export const SUPPORTED_EXTENSIONS = Object.keys(FILE_TYPES);

/** Human-readable list for validation messages and hints. */
export const SUPPORTED_EXTENSIONS_LABEL = SUPPORTED_EXTENSIONS.map((ext) =>
  ext.toUpperCase()
).join(", ");

/** `accept` attribute value for file inputs (extensions + MIME types). */
export const FILE_ACCEPT_ATTR = [
  ...SUPPORTED_EXTENSIONS.map((ext) => `.${ext}`),
  ...Array.from(
    new Set<any>(Object.values(FILE_TYPES).flatMap((entry) => entry.mimes))
  ),
].join(",");

/** Distinct type labels for the table's type filter. */
export const FILE_TYPE_LABELS = Array.from(
  new Set<any>(Object.values(FILE_TYPES).map((entry) => entry.label))
);

/** Fallback used when a stored record has an unknown extension. */
const UNKNOWN_TYPE = {
  label: "FILE",
  group: "other",
  Icon: MdInsertDriveFile,
  tone: "default",
  mimes: [],
};

/**
 * Lower-case extension of a filename, without the dot.
 * Returns "" when there is no extension.
 */
export function getExtension(fileName) {
  const name = String(fileName ?? "");
  const dot = name.lastIndexOf(".");

  if (dot <= 0 || dot === name.length - 1) return "";

  return name.slice(dot + 1).toLowerCase();
}

/** Filename without its extension (used to prefill the rename field). */
export function getBaseName(fileName) {
  const name = String(fileName ?? "");
  const ext = getExtension(name);
  return ext ? name.slice(0, name.length - ext.length - 1) : name;
}

/** Is this extension one of the supported document formats? */
export function isSupportedExtension(extension) {
  return Object.prototype.hasOwnProperty.call(
    FILE_TYPES,
    String(extension ?? "").toLowerCase()
  );
}

/** Type descriptor for a filename, always non-null. */
export function getFileTypeMeta(fileName) {
  return FILE_TYPES[getExtension(fileName)] || UNKNOWN_TYPE;
}

/** Short label ("PDF", "XLSX", ...) for a filename. */
export function getFileTypeLabel(fileName) {
  return getFileTypeMeta(fileName).label;
}

/** True when the file can be rendered inline as an image preview. */
export function isPreviewableImage(fileName) {
  return getFileTypeMeta(fileName).group === "image";
}

const FileTypes = {
  FILE_TYPES,
  SUPPORTED_EXTENSIONS,
  SUPPORTED_EXTENSIONS_LABEL,
  FILE_ACCEPT_ATTR,
  FILE_TYPE_LABELS,
  getExtension,
  getBaseName,
  isSupportedExtension,
  getFileTypeMeta,
  getFileTypeLabel,
  isPreviewableImage,
};

export default FileTypes;
