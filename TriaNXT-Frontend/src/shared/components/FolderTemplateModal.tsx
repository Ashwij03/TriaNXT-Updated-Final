import { useEffect, useState } from "react";
import {
  FOLDER_TEMPLATES_EVENT,
  applyFolderTemplate,
  deleteFolderTemplate,
  getFolderTemplates,
  saveCurrentFolderAsTemplate,
  saveFolderTemplate
} from "../services/folderService";
import "./FolderTemplateModal.css";

const DEFAULT_STRUCTURE = `Clinical Trial Documents
  Regulatory
    FDA
    Ethics
  Monitoring
    Visit 1
    Visit 2
  Site Files
    Contracts
    Financial`;

function parseStructureText(text) {
  const lines = String(text || "")
    .split("\n")
    .map((line) => line.replace(/\t/g, "  "))
    .filter((line) => line.trim());

  if (!lines.length) {
    return null;
  }

  const root = { name: lines[0].trim(), children: [] };
  const stack = [{ depth: 0, node: root }];

  for (let index = 1; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const depth = rawLine.search(/\S/);
    const name = rawLine.trim();

    if (!name) {
      continue;
    }

    const node = { name, children: [] };

    while (stack.length && stack[stack.length - 1].depth >= depth) {
      stack.pop();
    }

    const parent = stack[stack.length - 1]?.node || root;
    parent.children.push(node);
    stack.push({ depth, node });
  }

  return root;
}

export default function FolderTemplateModal({
  sectionId,
  contextKey,
  selectedFolderId,
  onClose,
  onApplied
}: any) {
  const [templates, setTemplates] = useState(() => getFolderTemplates());
  const [templateName, setTemplateName] = useState("");
  const [structureText, setStructureText] = useState(DEFAULT_STRUCTURE);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const refresh = () => setTemplates(getFolderTemplates());
    window.addEventListener(FOLDER_TEMPLATES_EVENT, refresh);
    return () => window.removeEventListener(FOLDER_TEMPLATES_EVENT, refresh);
  }, []);

  const handleSaveTemplate = () => {
    const structure = parseStructureText(structureText);

    if (!templateName.trim() || !structure) {
      setMessage("Enter a template name and folder structure.");
      return;
    }

    saveFolderTemplate(templateName.trim(), structure);
    setTemplateName("");
    setMessage("Template saved.");
  };

  const handleSaveCurrentStructure = () => {
    if (!selectedFolderId) {
      setMessage("Select a folder before saving its structure.");
      return;
    }

    if (!templateName.trim()) {
      setMessage("Enter a template name.");
      return;
    }

    const saved = saveCurrentFolderAsTemplate(
      sectionId,
      contextKey,
      selectedFolderId,
      templateName.trim()
    );

    setMessage(saved ? "Current folder structure saved as template." : "Unable to save template.");
  };

  const handleApplyTemplate = (templateId) => {
    if (!selectedFolderId) {
      setMessage("Select a destination folder first.");
      return;
    }

    const applied = applyFolderTemplate(
      sectionId,
      contextKey,
      selectedFolderId,
      templateId
    );

    if (applied) {
      onApplied?.();
      setMessage("Template applied. Nested folders were created.");
    } else {
      setMessage("Unable to apply template.");
    }
  };

  const handleDeleteTemplate = (templateId) => {
    if (window.confirm("Delete this folder template?")) {
      deleteFolderTemplate(templateId);
      setMessage("Template deleted.");
    }
  };

  return (
    <div className="folder-template-overlay" onClick={onClose}>
      <div
        className="folder-template-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="folder-template-header">
          <h3>Create Custom Folder Structure</h3>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <p className="folder-template-help">
          Save folder templates during this session and apply them to create nested folders automatically.
        </p>

        {message && <p className="folder-template-message">{message}</p>}

        <div className="folder-template-form">
          <label>
            Template Name
            <input
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
              placeholder="Clinical Trial Documents"
            />
          </label>

          <label>
            Folder Structure
            <textarea
              rows={10}
              value={structureText}
              onChange={(event) => setStructureText(event.target.value)}
              placeholder="Use indentation for nested folders"
            />
          </label>

          <div className="folder-template-actions">
            <button type="button" onClick={handleSaveTemplate}>
              Save Template
            </button>
            <button type="button" onClick={handleSaveCurrentStructure}>
              Save Current Folder Structure
            </button>
          </div>
        </div>

        <div className="folder-template-list">
          <h4>Saved Templates</h4>

          {templates.length === 0 && (
            <p className="folder-template-empty">No templates saved yet.</p>
          )}

          {templates.map((template) => (
            <div key={template.id} className="folder-template-item">
              <div>
                <strong>{template.name}</strong>
                <small>
                  Saved {new Date(template.createdAt).toLocaleString()}
                </small>
              </div>
              <div className="folder-template-item-actions">
                <button
                  type="button"
                  onClick={() => handleApplyTemplate(template.id)}
                >
                  Apply
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => handleDeleteTemplate(template.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
