/**
 * Subject Explorer - tree helpers
 *
 * Pure functions only, so the tree logic stays testable and the
 * components remain presentational.
 */

/** Case-insensitive "name contains term". */
const matches = (node, term) =>
  node.name.toLowerCase().includes(term.toLowerCase());

/**
 * Filter the tree by a search term.
 *
 * Rules:
 *  - A node is kept when it matches the term itself, OR when any
 *    descendant matches (so parents of a hit stay reachable).
 *  - When a node matches directly, its whole subtree is kept so the
 *    user can still browse into it.
 *
 * Returns a new array - the input tree is never mutated.
 */
export function filterTree(nodes, term) {
  const query = term.trim();
  if (!query) return nodes;

  const walk = (list) =>
    list.reduce((acc, node) => {
      const selfMatch = matches(node, query);
      const children = node.children ? walk(node.children) : [];

      if (selfMatch) {
        // keep the full subtree of a direct hit
        acc.push(node);
      } else if (children.length > 0) {
        // keep this node only as a path to matching descendants
        acc.push({ ...node, children });
      }
      return acc;
    }, []);

  return walk(nodes);
}

/** Collect the ids of every node that has children (used to expand-all). */
export function collectExpandableIds(nodes) {
  const ids = [];
  const walk = (list) => {
    list.forEach((node) => {
      if (node.children && node.children.length > 0) {
        ids.push(node.id);
        walk(node.children);
      }
    });
  };
  walk(nodes);
  return ids;
}

/** Total number of nodes in the tree (subjects + folders). */
export function countNodes(nodes) {
  return nodes.reduce(
    (total, node) =>
      total + 1 + (node.children ? countNodes(node.children) : 0),
    0
  );
}

/** Number of top-level subjects. */
export function countSubjects(nodes) {
  return nodes.filter((node) => node.type === "subject").length;
}
