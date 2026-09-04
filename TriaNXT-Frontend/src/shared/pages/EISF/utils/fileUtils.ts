/**
 * Returns readable file size
 */
export const formatFileSize = (bytes = 0) => {
  if (!bytes) return "0 Bytes";

  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));

  return `${(bytes / Math.pow(1024, index)).toFixed(2)} ${sizes[index]}`;
};

/**
 * Returns file extension
 */
export const getFileExtension = (fileName = "") => {
  return fileName.includes(".")
    ? fileName.split(".").pop().toLowerCase()
    : "";
};

/**
 * Returns filename without extension
 */
export const getFileName = (fileName = "") => {
  const extension = getFileExtension(fileName);

  if (!extension) return fileName;

  return fileName.slice(0, -(extension.length + 1));
};

/**
 * Returns file icon key
 */
export const getFileType = (fileName = "") => {
  const extension = getFileExtension(fileName);

  const mapping = {
    pdf: "pdf",
    doc: "word",
    docx: "word",
    xls: "excel",
    xlsx: "excel",
    csv: "excel",
    ppt: "powerpoint",
    pptx: "powerpoint",
    png: "image",
    jpg: "image",
    jpeg: "image",
    gif: "image",
    svg: "image",
    txt: "text",
    zip: "archive",
    rar: "archive",
  };

  return mapping[extension] || "file";
};

/**
 * Checks preview support
 */
export const isPreviewSupported = (fileName = "") => {
  return [
    "pdf",
    "png",
    "jpg",
    "jpeg",
    "gif",
    "svg",
    "txt",
  ].includes(getFileExtension(fileName));
};

/**
 * Checks image file
 */
export const isImageFile = (fileName = "") =>
  ["png", "jpg", "jpeg", "gif", "svg"].includes(
    getFileExtension(fileName)
  );

/**
 * Checks PDF file
 */
export const isPdfFile = (fileName = "") =>
  getFileExtension(fileName) === "pdf";

/**
 * Checks Word file
 */
export const isWordFile = (fileName = "") =>
  ["doc", "docx"].includes(getFileExtension(fileName));

/**
 * Checks Excel file
 */
export const isExcelFile = (fileName = "") =>
  ["xls", "xlsx", "csv"].includes(getFileExtension(fileName));

/**
 * Checks Archive file
 */
export const isArchiveFile = (fileName = "") =>
  ["zip", "rar"].includes(getFileExtension(fileName));

/**
 * Generates download filename
 */
export const buildDownloadFileName = (
  fileName,
  version = "",
  date = ""
) => {
  const name = getFileName(fileName);
  const extension = getFileExtension(fileName);

  const parts = [name];

  if (version) parts.push(`v${version}`);
  if (date) parts.push(date);

  return `${parts.join("_")}.${extension}`;
};

/**
 * Validate upload size
 */
export const isValidFileSize = (
  file,
  maxSize = 50 * 1024 * 1024
) => {
  return !!file && file.size <= maxSize;
};

/**
 * Validate upload type
 */
export const isValidFileType = (
  file,allowedTypes: any = []) => {
  if (!file) return false;

  if (!allowedTypes.length) return true;

  return allowedTypes.includes(
    getFileExtension(file.name)
  );
};

/**
 * Returns formatted upload details
 */
export const getFileDetails = (file: any = {}) => ({
  name: file.name || "",
  extension: getFileExtension(file.name || ""),
  size: file.size || 0,
  formattedSize: formatFileSize(file.size || 0),
  type: getFileType(file.name || ""),
});

/**
 * Checks if filename exists
 */
export const hasFileName = (file: any = {}) =>
  Boolean(file?.name);

/**
 * Compares two files
 */
export const isSameFile = (fileA: any = {},fileB: any = {}) => {
  return (
    fileA.name === fileB.name &&
    fileA.size === fileB.size
  );
};