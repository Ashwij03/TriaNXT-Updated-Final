import JSZip from "jszip";

function dataUrlToUint8Array(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") {
    return null;
  }

  const base64 = dataUrl.split(",")[1];

  if (!base64) {
    return null;
  }

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function addDocumentsToFolder(folderZip, folderId, getDocumentsForFolder) {
  const documents = getDocumentsForFolder(folderId) || [];

  for (const doc of documents) {
    const bytes = dataUrlToUint8Array(doc.dataUrl);

    if (bytes) {
      folderZip.file(sanitizeZipName(doc.name), bytes);
    } else {
      folderZip.file(
        `${sanitizeZipName(doc.name)}.txt`,
        `Placeholder for ${doc.name}\nUploaded: ${doc.uploadedAt || "unknown"}`
      );
    }
  }
}

async function addNodeToZip(parentZip, node, getDocumentsForFolder) {
  const folderZip = parentZip.folder(sanitizeZipName(node.name));

  if (!folderZip) {
    return;
  }

  await addDocumentsToFolder(folderZip, node.id, getDocumentsForFolder);

  for (const child of node.children || []) {
    await addNodeToZip(folderZip, child, getDocumentsForFolder);
  }
}

export async function buildFolderZip({
  rootName,
  rootNode,
  getDocumentsForFolder
}: any) {
  const zip = new JSZip();
  const rootFolder = zip.folder(sanitizeZipName(rootName)) || zip;

  await addDocumentsToFolder(rootFolder, rootNode.id, getDocumentsForFolder);

  for (const child of rootNode.children || []) {
    await addNodeToZip(rootFolder, child, getDocumentsForFolder);
  }

  return zip.generateAsync({ type: "blob" });
}

export function triggerBlobDownload(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}

export function sanitizeZipName(name) {
  return String(name || "folder").replace(/[\\/:*?"<>|]/g, "_");
}

export function parseUploadedFolderFiles(fileList) {
  const files = (Array.from(fileList || []) as File[]).filter(
    (file) => file.webkitRelativePath
  );

  const tree = { name: "", children: new Map(), files: [] };

  files.forEach((file) => {
    const parts = file.webkitRelativePath.split("/");

    if (parts.length === 1) {
      tree.files.push(file);
      return;
    }

    let current = tree;

    for (let index = 1; index < parts.length; index += 1) {
      const part = parts[index];
      const isFile = index === parts.length - 1;

      if (isFile) {
        if (!current.files) {
          current.files = [];
        }

        current.files.push(file);
        return;
      }

      if (!current.children.has(part)) {
        current.children.set(part, {
          name: part,
          children: new Map(),
          files: []
        });
      }

      current = current.children.get(part);
    }
  });

  return tree;
}

export function uploadedTreeToStructure(node) {
  return {
    name: node.name,
    files: node.files || [],
    children: Array.from(node.children?.values() || []).map(uploadedTreeToStructure)
  };
}
