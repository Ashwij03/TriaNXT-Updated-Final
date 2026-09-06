/**
 * Bulk folder upload planning tests.
 *
 * The planner must reproduce the picked directory tree under the selected
 * subject folder using the explorer's own tree schema, and it must honour
 * the locked-ICF guarantee: a dropped folder named "ICF" (or files dropped
 * straight onto the existing locked ICF folder) merges into the subject's
 * single locked ICF folder and never creates a second, unlocked "ICF".
 */
import { describe, it, expect, beforeEach } from "vitest";

import FolderTreeService from "../folderTreeService";
import FileService from "../fileService";
import {
  buildFolderUploadPlan,
  collectFilesFromFileList,
  commitFolderUploadPlan,
  FOLDER_UPLOAD_LIMITS,
} from "../../subjects/folderUploadUtils";

const STUDY_ID = "STUDY-01";
const SUBJECT_ID = "SUB-101"; // deliberately outside legacy mock ids
const ICF_ID = `${SUBJECT_ID}/icf`;

/** Real explorer tree: the subject carries exactly one locked ICF folder. */
function seedTreeWithSubject() {
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
              id: ICF_ID,
              name: "ICF",
              type: "folder",
              locked: true,
              children: [],
              createdAt: "2026-01-01T00:00:00.000Z",
            },
          ],
        },
      ],
    })
  );
  return FolderTreeService.loadFolderTree(STUDY_ID);
}

function treeFromStorage() {
  return FolderTreeService.loadFolderTree(STUDY_ID);
}

function makeFile(name, size = 100) {
  return {
    name,
    size,
    type: name.toLowerCase().endsWith(".pdf")
      ? "application/pdf"
      : "text/plain",
    lastModified: 1700000000000,
  };
}

function makeCollected(paths) {
  return paths.map((path) => {
    const parts = path.split("/");
    return { file: makeFile(parts[parts.length - 1]), path };
  });
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("buildFolderUploadPlan - nested structure", () => {
  it("recreates a nested folder spine under the subject node", () => {
    const tree = seedTreeWithSubject();
    const collected = makeCollected([
      "consent-pack/2026/rev-a.pdf",
      "consent-pack/2026/rev-b.pdf",
      "consent-pack/notes.txt",
    ]);

    const plan = buildFolderUploadPlan({
      tree,
      targetFolderId: SUBJECT_ID,
      collected,
    });

    expect(plan.entries).toHaveLength(3);
    expect(plan.foldersToCreate.map((f) => f.name)).toEqual([
      "consent-pack",
      "2026",
    ]);
    expect(plan.skipped).toHaveLength(0);
    // All files resolve to planned (or reused) folder ids - never the
    // subject node's own bucket.
    const folderIds = new Set(plan.entries.map((entry) => entry.folderId));
    expect(folderIds.has(SUBJECT_ID)).toBe(false);
  });

  it("skips hidden files and hidden folders", () => {
    const tree = seedTreeWithSubject();
    const collected = makeCollected([
      ".DS_Store",
      ".git/config",
      "consent-pack/.hidden/form.pdf",
      "consent-pack/visible.pdf",
    ]);

    const plan = buildFolderUploadPlan({
      tree,
      targetFolderId: SUBJECT_ID,
      collected,
    });

    expect(plan.entries).toHaveLength(1);
    expect(plan.entries[0].name).toBe("visible.pdf");
    expect(plan.skipped.map((s) => s.name).sort()).toEqual([
      ".DS_Store",
      ".git/config",
      "consent-pack/.hidden/form.pdf",
    ]);
  });

  it("reuses an existing same-named child instead of duplicating it", () => {
    const tree = seedTreeWithSubject();
    // Pre-create "consent-pack" directly under the subject.
    const created = FolderTreeService.createFolder(
      STUDY_ID,
      tree,
      SUBJECT_ID,
      "consent-pack"
    );
    expect(created.ok).toBe(true);

    const liveTree = treeFromStorage();
    const plan = buildFolderUploadPlan({
      tree: liveTree,
      targetFolderId: SUBJECT_ID,
      collected: makeCollected(["consent-pack/form.pdf"]),
    });

    expect(plan.foldersToCreate).toHaveLength(0);
    expect(plan.reusedFolderIds).toContain(created.node.id);
    expect(plan.entries[0].folderId).toBe(created.node.id);
  });
});

describe("buildFolderUploadPlan - locked ICF guarantees", () => {
  it("merges a folder named ICF into the existing locked ICF node (never a second ICF)", () => {
    const tree = seedTreeWithSubject();
    const plan = buildFolderUploadPlan({
      tree,
      targetFolderId: SUBJECT_ID,
      collected: makeCollected([
        "ICF/consent-v1.pdf",
        "ICF/consent-v2.pdf",
      ]),
    });

    expect(plan.mergeIntoIcf).toBe(true);
    // No folder called "ICF" is planned - contents target the locked node.
    expect(
      plan.foldersToCreate.some(
        (f) => f.name.toLowerCase() === "icf"
      )
    ).toBe(false);
    expect(plan.entries).toHaveLength(2);
    expect(new Set(plan.entries.map((e) => e.folderId))).toEqual(
      new Set([ICF_ID])
    );
  });

  it("merges files dropped directly onto the locked ICF folder into it", () => {
    const tree = seedTreeWithSubject();
    const plan = buildFolderUploadPlan({
      tree,
      targetFolderId: ICF_ID,
      collected: makeCollected([
        "ICF/signed-consent.pdf", // spine repeats the folder name
        "signed-consent-2.pdf", // direct file, no spine
      ]),
    });

    expect(plan.mergeIntoIcf).toBe(true);
    expect(plan.foldersToCreate).toHaveLength(0);
    expect(plan.entries).toHaveLength(2);
    expect(new Set(plan.entries.map((e) => e.folderId))).toEqual(
      new Set([ICF_ID])
    );
  });

  it("creates nested subfolders inside the ICF node when the drop has them", () => {
    const tree = seedTreeWithSubject();
    const plan = buildFolderUploadPlan({
      tree,
      targetFolderId: SUBJECT_ID,
      collected: makeCollected([
        "ICF/2026/rev-1.pdf",
        "ICF/2026/rev-2.pdf",
      ]),
    });

    expect(plan.foldersToCreate.map((f) => f.name)).toEqual(["2026"]);
    expect(plan.entries).toHaveLength(2);
    const icfChildrenIds = plan.entries.map((e) => e.folderId);
    // Files nest under the new "2026" folder - under the ICF node.
    expect(icfChildrenIds.every((id) => id !== ICF_ID)).toBe(true);
    expect(plan.foldersToCreate[0].parentId).toBe(ICF_ID);
  });
});

describe("commitFolderUploadPlan - persistence", () => {
  it("persists folders and files in one pass and keeps the tree's ICF locked", async () => {
    const tree = seedTreeWithSubject();
    const plan = buildFolderUploadPlan({
      tree,
      targetFolderId: SUBJECT_ID,
      collected: makeCollected([
        "consent-pack/2026/rev-a.pdf",
        "consent-pack/rev-b.pdf",
      ]),
    });

    const result = await commitFolderUploadPlan({
      studyId: STUDY_ID,
      tree,
      plan,
      uploadedBy: "Tester",
    });

    expect(result.ok).toBe(true);
    expect(result.foldersCreated).toBe(2);
    expect(result.filesAdded).toBe(2);

    const after = treeFromStorage();
    const subject = after.find((n) => n.id === SUBJECT_ID);
    const icf = subject.children.find((c) => c.id === ICF_ID);
    expect(icf.locked).toBe(true); // untouched by the bulk upload

    const consentPack = subject.children.find((c) => c.name === "consent-pack");
    expect(consentPack).toBeTruthy();
    const year = consentPack.children.find((c) => c.name === "2026");
    expect(year).toBeTruthy();

    const store = FileService.loadFileStore(STUDY_ID);
    expect(FileService.listFiles(store, year.id)).toHaveLength(1);
    expect(FileService.listFiles(store, consentPack.id)).toHaveLength(1);
  });

  it("rejects duplicate file names inside the same destination folder", async () => {
    const tree = seedTreeWithSubject();
    const plan = buildFolderUploadPlan({
      tree,
      targetFolderId: SUBJECT_ID,
      collected: makeCollected([
        "consent-pack/a.pdf",
        "consent-pack/a.pdf", // same name, same folder
      ]),
    });

    const result = await commitFolderUploadPlan({
      studyId: STUDY_ID,
      tree,
      plan,
      uploadedBy: "Tester",
    });

    // One row persisted; the duplicate is reported, not silently dropped.
    expect(result.filesAdded).toBe(1);
    expect(result.rejected.some((r) => r.error.includes("already exists"))).toBe(
      true
    );
  });
});

describe("collectFilesFromFileList", () => {
  it("reads webkitRelativePath-style paths from the file input contract", () => {
    const fileList = [
      Object.assign(makeFile("a.pdf"), {
        webkitRelativePath: "pack/2026/a.pdf",
      }),
      Object.assign(makeFile("b.pdf"), { webkitRelativePath: "pack/b.pdf" }),
    ];

    const collected = collectFilesFromFileList(fileList);
    expect(collected.map((c) => c.path)).toEqual([
      "pack/2026/a.pdf",
      "pack/b.pdf",
    ]);
  });
});
