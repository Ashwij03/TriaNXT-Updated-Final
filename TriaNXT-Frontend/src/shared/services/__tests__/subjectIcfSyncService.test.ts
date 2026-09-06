/**
 * Subject ICF cross-surface reconciliation tests.
 *
 * Two surfaces keep their own localStorage stores for a subject's ICF files:
 * the document hub (folderService — `trianxtFolderTrees` /
 * `trianxtFolderDocuments` under `subjects::<contextKey>`) and the Subject
 * Explorer (folderTreeService / fileService — the locked ICF folder with the
 * deterministic id `<subjectId>/icf`). These tests pin the reconciliation:
 * idempotent mirrors both ways, no duplicate imports, explorer-origin files
 * survive a hub sync, and hub-uploaded records are never overwritten by an
 * explorer export.
 */
import { describe, it, expect, beforeEach } from "vitest";

import {
  syncHubIcfToExplorer,
  syncExplorerIcfToHub,
  listHubSubjectContextKeys,
  explorerIcfFolderId,
} from "../subjectIcfSyncService";
import FileService from "../../components/SubjectExplorer/fileService";
import FolderTreeService from "../../components/SubjectExplorer/folderTreeService";
import {
  FOLDER_TREE_KEY,
  FOLDER_DOCS_KEY,
  ICF_FOLDER_NAME,
} from "../folderService";

const STUDY_ID = "STUDY-01";
const SUBJECT_ID = "SUB-101"; // deliberately outside the legacy mock ids
const CONTEXT_KEY = `subject-${STUDY_ID}-${SUBJECT_ID}`;
const HUB_ICF_FOLDER_ID = "hub-icf-1";
const EXPLORER_ICF_ID = explorerIcfFolderId(SUBJECT_ID); // "SUB-101/icf"

function seedExplorerSubject(children = []) {
  const key = FolderTreeService.subjectExplorerTreeKey(STUDY_ID);
  window.localStorage.setItem(
    key,
    JSON.stringify({
      version: 1,
      tree: [
        {
          id: SUBJECT_ID,
          name: SUBJECT_ID,
          type: "subject",
          children: [
            {
              id: EXPLORER_ICF_ID,
              name: ICF_FOLDER_NAME,
              type: "folder",
              locked: true,
              children,
              createdAt: "2026-01-01T00:00:00.000Z",
            },
          ],
        },
      ],
    })
  );
}

function seedExplorerFiles(files) {
  const store = FileService.loadFileStore(STUDY_ID);
  FileService.saveFileStore(
    STUDY_ID,
    { ...store, [EXPLORER_ICF_ID]: files },
    "test-seed",
    EXPLORER_ICF_ID
  );
}

function seedHubSubject(docs, contextKey = CONTEXT_KEY) {
  const trees = JSON.parse(
    window.localStorage.getItem(FOLDER_TREE_KEY) || "{}"
  );
  trees[`subjects::${contextKey}`] = [
    {
      id: "root-1",
      name: "Subjects",
      children: [{ id: HUB_ICF_FOLDER_ID, name: ICF_FOLDER_NAME, children: [] }],
    },
  ];
  window.localStorage.setItem(FOLDER_TREE_KEY, JSON.stringify(trees));

  const allDocs = JSON.parse(
    window.localStorage.getItem(FOLDER_DOCS_KEY) || "{}"
  );
  allDocs[`subjects::${contextKey}`] = {
    [HUB_ICF_FOLDER_ID]: docs,
  };
  window.localStorage.setItem(FOLDER_DOCS_KEY, JSON.stringify(allDocs));
}

function findIcfHubFolderId(tree) {
  if (!Array.isArray(tree)) return null;
  for (const node of tree) {
    if (!node) continue;
    if (
      node.isICF ||
      String(node.name || "").trim().toLowerCase() ===
        ICF_FOLDER_NAME.toLowerCase()
    ) {
      return node.id;
    }
    const nested = findIcfHubFolderId(node.children);
    if (nested) return nested;
  }
  return null;
}

function hubIcfDocs(contextKey = CONTEXT_KEY) {
  const trees = JSON.parse(
    window.localStorage.getItem(FOLDER_TREE_KEY) || "{}"
  );
  const icfId =
    findIcfHubFolderId(trees[`subjects::${contextKey}`]) ||
    HUB_ICF_FOLDER_ID;

  const allDocs = JSON.parse(
    window.localStorage.getItem(FOLDER_DOCS_KEY) || "{}"
  );
  return allDocs[`subjects::${contextKey}`]?.[icfId] || [];
}

function explorerIcfFiles() {
  const store = FileService.loadFileStore(STUDY_ID);
  return FileService.listFiles(store, EXPLORER_ICF_ID);
}

function makeHubDoc(overrides = {}) {
  return {
    id: "doc-1",
    name: "consent-form.pdf",
    type: "application/pdf",
    size: 2048,
    uploadedAt: "2026-02-01T09:00:00.000Z",
    uploadedBy: "Dr. Investigator",
    status: "Pending Review",
    documentType: "ICF",
    studyCode: STUDY_ID,
    subjectId: SUBJECT_ID,
    fileUrl: "",
    ...overrides,
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("listHubSubjectContextKeys", () => {
  it("matches the composite subject context and the bare-subject legacy context", () => {
    const trees = {
      [`subjects::${CONTEXT_KEY}`]: [],
      [`subjects::${SUBJECT_ID}`]: [],
      "subjects::some-other-subject": [],
      "studyFolder::default": [],
      [`subjects::subject-OTHER-STUDY-${SUBJECT_ID}`]: [], // same subject, another study's hub context
    };
    window.localStorage.setItem(FOLDER_TREE_KEY, JSON.stringify(trees));

    const keys = listHubSubjectContextKeys(SUBJECT_ID);
    expect(keys).toContain(`subjects::${CONTEXT_KEY}`);
    expect(keys).toContain(`subjects::${SUBJECT_ID}`);
    expect(keys).toContain(`subjects::subject-OTHER-STUDY-${SUBJECT_ID}`);
    expect(keys).not.toContain("subjects::some-other-subject");
    expect(keys).not.toContain("studyFolder::default");
  });
});

describe("syncHubIcfToExplorer (hub -> explorer)", () => {
  it("imports hub ICF documents into the subject's locked explorer ICF folder", () => {
    seedExplorerSubject();
    seedHubSubject([makeHubDoc()]);

    const result = syncHubIcfToExplorer({
      studyId: STUDY_ID,
      subjectId: SUBJECT_ID,
    });

    expect(result.changed).toBe(true);
    expect(result.added).toBe(1);

    const files = explorerIcfFiles();
    expect(files).toHaveLength(1);
    expect(files[0].name).toBe("consent-form.pdf");
    expect(files[0].size).toBe(2048);
    expect(files[0].status).toBe("Pending Review");
    expect(files[0].folderId).toBe(EXPLORER_ICF_ID);
    expect(files[0].hubIcfKey).toContain(HUB_ICF_FOLDER_ID);
  });

  it("is idempotent — a second run imports nothing new", () => {
    seedExplorerSubject();
    seedHubSubject([makeHubDoc()]);

    syncHubIcfToExplorer({ studyId: STUDY_ID, subjectId: SUBJECT_ID });
    const second = syncHubIcfToExplorer({
      studyId: STUDY_ID,
      subjectId: SUBJECT_ID,
    });

    expect(second.changed).toBe(false);
    expect(second.added).toBe(0);
    expect(explorerIcfFiles()).toHaveLength(1);
  });

  it("patches mirrored records when the hub document is renamed or replaced", () => {
    seedExplorerSubject();
    seedHubSubject([makeHubDoc()]);
    syncHubIcfToExplorer({ studyId: STUDY_ID, subjectId: SUBJECT_ID });

    seedHubSubject([makeHubDoc({ id: "doc-1", name: "consent-v2.pdf", size: 4096 })]);
    const result = syncHubIcfToExplorer({
      studyId: STUDY_ID,
      subjectId: SUBJECT_ID,
    });

    expect(result.updated).toBe(1);
    const files = explorerIcfFiles();
    expect(files).toHaveLength(1);
    expect(files[0].name).toBe("consent-v2.pdf");
    expect(files[0].size).toBe(4096);
  });

  it("prunes explorer mirrors whose hub document was deleted", () => {
    seedExplorerSubject();
    seedHubSubject([makeHubDoc(), makeHubDoc({ id: "doc-2", name: "a.pdf" })]);
    syncHubIcfToExplorer({ studyId: STUDY_ID, subjectId: SUBJECT_ID });
    expect(explorerIcfFiles()).toHaveLength(2);

    seedHubSubject([makeHubDoc({ id: "doc-2", name: "a.pdf" })]);
    const result = syncHubIcfToExplorer({
      studyId: STUDY_ID,
      subjectId: SUBJECT_ID,
    });

    expect(result.removed).toBe(1);
    const files = explorerIcfFiles();
    expect(files).toHaveLength(1);
    expect(files[0].id).toBe("doc-2");
  });

  it("never deletes explorer-origin uploads while reconciling", () => {
    seedExplorerSubject();
    seedHubSubject([makeHubDoc()]);
    seedExplorerFiles([
      {
        id: "file-9",
        folderId: EXPLORER_ICF_ID,
        name: "signed-copy.pdf",
        size: 100,
        uploadedAt: "2026-03-01T00:00:00.000Z",
        uploadedBy: "Site Coordinator",
        status: "Final",
      },
    ]);

    const result = syncHubIcfToExplorer({
      studyId: STUDY_ID,
      subjectId: SUBJECT_ID,
    });

    expect(result.added).toBe(1); // only the hub doc was imported
    const files = explorerIcfFiles();
    expect(files).toHaveLength(2);
    expect(files.some((f) => f.id === "file-9")).toBe(true);
    expect(files.some((f) => f.id === "doc-1")).toBe(true);
  });

  it("does nothing when the subject has no explorer node (not on the roster)", () => {
    seedHubSubject([makeHubDoc()]); // no explorer tree seeded

    const result = syncHubIcfToExplorer({
      studyId: STUDY_ID,
      subjectId: SUBJECT_ID,
    });

    expect(result.changed).toBe(false);
    expect(explorerIcfFiles()).toHaveLength(0);
  });
});

describe("syncExplorerIcfToHub (explorer -> hub)", () => {
  it("creates the canonical hub context when none exists and pushes explorer uploads", () => {
    seedExplorerSubject();
    seedExplorerFiles([
      {
        id: "file-9",
        folderId: EXPLORER_ICF_ID,
        name: "signed-copy.pdf",
        size: 100,
        uploadedAt: "2026-03-01T00:00:00.000Z",
        uploadedBy: "Site Coordinator",
        status: "Final",
      },
    ]);

    const result = syncExplorerIcfToHub({
      studyId: STUDY_ID,
      subjectId: SUBJECT_ID,
    });

    expect(result.changed).toBe(true);
    expect(result.added).toBe(1);

    const docs = hubIcfDocs();
    expect(docs).toHaveLength(1);
    expect(docs[0].id).toBe("file-9");
    expect(docs[0].name).toBe("signed-copy.pdf");
    expect(docs[0].subjectId).toBe(SUBJECT_ID);
    expect(docs[0].studyCode).toBe(STUDY_ID);
    expect(docs[0].sourceExplorer).toBe(true);
  });

  it("is idempotent — pushes nothing on a second run", () => {
    seedExplorerSubject();
    seedExplorerFiles([
      {
        id: "file-9",
        folderId: EXPLORER_ICF_ID,
        name: "signed-copy.pdf",
        size: 100,
        uploadedAt: "2026-03-01T00:00:00.000Z",
        uploadedBy: "Site Coordinator",
        status: "Final",
      },
    ]);

    syncExplorerIcfToHub({ studyId: STUDY_ID, subjectId: SUBJECT_ID });
    const second = syncExplorerIcfToHub({
      studyId: STUDY_ID,
      subjectId: SUBJECT_ID,
    });

    expect(second.changed).toBe(false);
    expect(hubIcfDocs()).toHaveLength(1);
  });

  it("merges into an existing hub ICF folder without touching genuine hub uploads", () => {
    seedExplorerSubject();
    seedHubSubject([
      makeHubDoc({ id: "doc-1" }), // uploaded on the hub itself
    ]);
    seedExplorerFiles([
      {
        id: "file-9",
        folderId: EXPLORER_ICF_ID,
        name: "signed-copy.pdf",
        size: 100,
        uploadedAt: "2026-03-01T00:00:00.000Z",
        uploadedBy: "Site Coordinator",
        status: "Final",
      },
    ]);

    const result = syncExplorerIcfToHub({
      studyId: STUDY_ID,
      subjectId: SUBJECT_ID,
    });

    expect(result.added).toBe(1);
    const docs = hubIcfDocs();
    expect(docs).toHaveLength(2);
    expect(docs.some((d) => d.id === "doc-1")).toBe(true);
    expect(docs.some((d) => d.id === "file-9")).toBe(true);
  });

  it("does not push hub-mirrored records back to the hub (no duplicates)", () => {
    seedExplorerSubject();
    seedHubSubject([makeHubDoc()]);
    syncHubIcfToExplorer({ studyId: STUDY_ID, subjectId: SUBJECT_ID });
    expect(explorerIcfFiles()).toHaveLength(1);

    const result = syncExplorerIcfToHub({
      studyId: STUDY_ID,
      subjectId: SUBJECT_ID,
    });

    expect(result.changed).toBe(false);
    expect(hubIcfDocs()).toHaveLength(1);
  });
});
