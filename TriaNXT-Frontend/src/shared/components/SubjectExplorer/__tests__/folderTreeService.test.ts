/**
 * Cross-study integration tests for folderTreeService
 * ====================================================
 *
 * Verifies that:
 * 1. Two different studies have completely independent folder trees
 * 2. Creating, renaming, or deleting a subject/folder in Study A never
 *    appears in, or affects, Study B
 * 3. The reconciliation cleans up phantom subjects not in subjectsByStudy
 * 4. Brand-new studies show an empty tree (no phantom mock subjects)
 */

// Use Jest's built-in jsdom localStorage (no custom mock needed).
// The invalid-study-id test deliberately exercises the runtime guard.
beforeEach(() => {
  window.localStorage.clear();
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  console.warn.mockRestore();
  console.error.mockRestore();
});

const {
  loadFolderTree,
  saveFolderTree,
  createSubject,
  renameSubject,
  deleteSubject,
  createFolder,
  renameFolder,
  deleteFolder,
  findNodeById,
  subjectExplorerTreeKey,
} = require("../folderTreeService");

describe("Study-scoped storage keys", () => {
  test("each study gets its own unique localStorage key", () => {
    const keyA = subjectExplorerTreeKey("STUDY-A");
    const keyB = subjectExplorerTreeKey("STUDY-B");
    expect(keyA).not.toBe(keyB);
    expect(keyA).toBe("trianxtSubjectExplorerTree:STUDY-A");
    expect(keyB).toBe("trianxtSubjectExplorerTree:STUDY-B");
  });

  test("empty studyId falls back to 'global'", () => {
    expect(subjectExplorerTreeKey("")).toBe("trianxtSubjectExplorerTree:global");
  });
});

describe("Brand-new study shows empty tree", () => {
  test("a study with no data starts with an empty tree", () => {
    const tree = loadFolderTree("NEW-STUDY");
    expect(tree).toEqual([]);
  });

  test("no phantom SUB-001..SUB-006 subjects appear", () => {
    const tree = loadFolderTree("FRESH-STUDY");
    const subjectIds = tree.map((s) => s.id);
    ["SUB-001", "SUB-002", "SUB-003", "SUB-004", "SUB-005", "SUB-006"].forEach(
      (id) => expect(subjectIds).not.toContain(id)
    );
  });
});

describe("Cross-study isolation", () => {
  test("creating a subject in Study A does not affect Study B", () => {
    const resultA = createSubject("STUDY-A", [], "Test Subject A");
    expect(resultA.ok).toBe(true);

    const treeB = loadFolderTree("STUDY-B");
    expect(treeB).toEqual([]);
  });

  test("deleting a subject in Study A does not affect Study B", () => {
    const resultA = createSubject("STUDY-A", [], "Subject A1");
    const resultB = createSubject("STUDY-B", [], "Subject B1");

    const deleteResult = deleteSubject("STUDY-A", resultA.tree, resultA.node.id);
    expect(deleteResult.ok).toBe(true);

    const treeB = loadFolderTree("STUDY-B");
    expect(treeB).toHaveLength(1);
    expect(treeB[0].id).toBe(resultB.node.id);
  });

  test("renaming a subject in Study A does not affect Study B", () => {
    const resultA = createSubject("STUDY-A", [], "Subject A1");
    const resultB = createSubject("STUDY-B", [], "Subject B1");

    const renameResult = renameSubject(
      "STUDY-A",
      resultA.tree,
      resultA.node.id,
      "Renamed A1"
    );
    expect(renameResult.ok).toBe(true);

    const treeB = loadFolderTree("STUDY-B");
    expect(treeB[0].name).toBe("Subject B1");
  });

  test("creating a folder in Study A does not appear in Study B", () => {
    const resultA = createSubject("STUDY-A", [], "Subject A1");
    createSubject("STUDY-B", [], "Subject B1");

    const folderResult = createFolder(
      "STUDY-A",
      resultA.tree,
      resultA.node.id,
      "Test Folder"
    );
    expect(folderResult.ok).toBe(true);

    const treeB = loadFolderTree("STUDY-B");
    const subjectB = treeB[0];
    // Study B subject should have only ICF
    expect(subjectB.children).toHaveLength(1);
    expect(subjectB.children[0].name).toBe("ICF");
  });

  test("completely independent trees after multiple operations", () => {
    // Study A: create subjects with folders
    let treeA = [];
    const sA1 = createSubject("STUDY-A", treeA, "A-Subject-1");
    treeA = sA1.tree;
    const sA2 = createSubject("STUDY-A", treeA, "A-Subject-2");
    treeA = sA2.tree;
    createFolder("STUDY-A", treeA, sA1.node.id, "Visit 1");
    createFolder("STUDY-A", treeA, sA1.node.id, "Visit 2");

    // Study B: create subjects with different folders
    let treeB = [];
    const sB1 = createSubject("STUDY-B", treeB, "B-Subject-1");
    treeB = sB1.tree;
    const sB2 = createSubject("STUDY-B", treeB, "B-Subject-2");
    treeB = sB2.tree;
    createFolder("STUDY-B", treeB, sB1.node.id, "Screening");

    // Verify Study A
    const finalTreeA = loadFolderTree("STUDY-A");
    const aNames = finalTreeA.map((s) => s.name);
    expect(aNames).toContain("A-Subject-1");
    expect(aNames).toContain("A-Subject-2");
    expect(aNames).not.toContain("B-Subject-1");

    // Verify Study B
    const finalTreeB = loadFolderTree("STUDY-B");
    const bNames = finalTreeB.map((s) => s.name);
    expect(bNames).toContain("B-Subject-1");
    expect(bNames).toContain("B-Subject-2");
    expect(bNames).not.toContain("A-Subject-1");
  });
});

describe("Reconciliation with subjectsByStudy", () => {
  test("subjects in subjectsByStudy but missing from tree get auto-created", () => {
    const subjectsByStudy = {
      "STUDY-C": [
        { id: "SUB-C01", studyId: "STUDY-C", status: "Active" },
        { id: "SUB-C02", studyId: "STUDY-C", status: "Screened" },
      ],
    };
    window.localStorage.setItem("subjectsByStudy", JSON.stringify(subjectsByStudy));

    const tree = loadFolderTree("STUDY-C");
    expect(tree).toHaveLength(2);
    expect(tree.map((s) => s.id).sort()).toEqual(["SUB-C01", "SUB-C02"].sort());

    // Each should have an ICF folder
    tree.forEach((subject) => {
      const icf = subject.children.find((c) => c.name === "ICF" && c.locked);
      expect(icf).toBeTruthy();
    });
  });

  test("tree subjects not in subjectsByStudy get removed when records exist", () => {
    // Set up a tree with phantom subjects
    const phantomTree = [
      {
        id: "SUB-001", name: "SUB-001", type: "subject",
        children: [{ id: "SUB-001/icf", name: "ICF", type: "folder", locked: true, children: [] }],
      },
      {
        id: "SUB-002", name: "SUB-002", type: "subject",
        children: [{ id: "SUB-002/icf", name: "ICF", type: "folder", locked: true, children: [] }],
      },
    ];
    window.localStorage.setItem(
      subjectExplorerTreeKey("STUDY-D"),
      JSON.stringify({ version: 1, tree: phantomTree })
    );

    const subjectsByStudy = {
      "STUDY-D": [{ id: "REAL-SUBJECT", studyId: "STUDY-D", status: "Active" }],
    };
    window.localStorage.setItem("subjectsByStudy", JSON.stringify(subjectsByStudy));

    const tree = loadFolderTree("STUDY-D");
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("REAL-SUBJECT");
  });

  test("empty subjectsByStudy array removes all tree subjects", () => {
    const existingTree = [
      {
        id: "SUB-001", name: "SUB-001", type: "subject",
        children: [{ id: "SUB-001/icf", name: "ICF", type: "folder", locked: true, children: [] }],
      },
    ];
    window.localStorage.setItem(
      subjectExplorerTreeKey("STUDY-E"),
      JSON.stringify({ version: 1, tree: existingTree })
    );

    window.localStorage.setItem("subjectsByStudy", JSON.stringify({ "STUDY-E": [] }));

    const tree = loadFolderTree("STUDY-E");
    expect(tree).toHaveLength(0);
  });

  test("no subjectsByStudy key preserves existing tree", () => {
    const existingTree = [
      {
        id: "SUB-01", name: "SUB-01", type: "subject",
        children: [{ id: "SUB-01/icf", name: "ICF", type: "folder", locked: true, children: [] }],
      },
    ];
    window.localStorage.setItem(
      subjectExplorerTreeKey("STUDY-F"),
      JSON.stringify({ version: 1, tree: existingTree })
    );

    // No subjectsByStudy set at all
    const tree = loadFolderTree("STUDY-F");
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("SUB-01");
  });

  test("legacy mock subject ids (SUB-001..SUB-006) are stripped on load", () => {
    const legacyTree = [
      {
        id: "SUB-001", name: "SUB-001", type: "subject",
        children: [{ id: "SUB-001/icf", name: "ICF", type: "folder", locked: true, children: [] }],
      },
      {
        id: "SUB-02", name: "SUB-02", type: "subject",
        children: [{ id: "SUB-02/icf", name: "ICF", type: "folder", locked: true, children: [] }],
      },
    ];
    window.localStorage.setItem(
      subjectExplorerTreeKey("STUDY-G"),
      JSON.stringify({ version: 1, tree: legacyTree })
    );

    const tree = loadFolderTree("STUDY-G");
    // SUB-001 (legacy mock) should be stripped; SUB-02 (user-created) should remain
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("SUB-02");
  });

  test("new subjects use 2-digit IDs (SUB-01, SUB-02, not SUB-001)", () => {
    const result = createSubject("STUDY-H", [], "Test Subject");
    expect(result.ok).toBe(true);
    // Should be SUB-01 (2-digit), not SUB-001 (3-digit)
    expect(result.node.id).toMatch(/^SUB-\d{2}$/);
  });
});
