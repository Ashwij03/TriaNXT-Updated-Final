import { useParams } from "react-router-dom";
import { useState } from "react";
import DocumentFolderManager from "../../components/DocumentFolderManager";
import useCanEditStudyContent from "../../hooks/useCanEditStudyContent";


function StudyDocuments() {
  const { id } = useParams();
  const [searchText, setSearchText] = useState("");
  // Vastav — Task 5: a CRO/Sponsor user whose Access level is "Read"
  // must not be able to upload, rename, or delete study files. This
  // reuses the same edit-access check already used for Study Overview
  // (role-based Edit access OR an approved Edit Permission request).
  const canEdit = useCanEditStudyContent("Study Folder", id);
  return (
  <div className="module-card">
    <h2>Study Folder</h2>

    {/* ===== START F3 CHANGES ===== */}
    <div className="study-files-search">
      <label htmlFor="study-file-search">
        <strong>Search Files</strong>
      </label>

      <input
        id="study-file-search"
        type="text"
        placeholder="Search files..."
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
      />
    </div>
    {/* ===== END F3 CHANGES ===== */}

    <DocumentFolderManager
      sectionId="studyFolder"
      contextKey={id || "default"}
      title="Study Folder"
      studyCode={id}
      layout="vertical"
      readOnly={!canEdit}
    />
  </div>
);

}

export default StudyDocuments;
