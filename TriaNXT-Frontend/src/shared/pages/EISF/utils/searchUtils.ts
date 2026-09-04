/**
 * Generic document search.
 */
export const searchDocuments = (documents: any = [],
  keyword = "",
  searchableFields = [
    "documentName",
    "name",
    "status",
    "category",
    "documentType",
    "description",
    "createdBy",
    "uploadedBy",
    "approvedBy",
    "fileName",
    "section",
    "sectionId",
    "version",
  ]
) => {
  const query = keyword.trim().toLowerCase();

  if (!query) {
    return documents;
  }

  return documents.filter((document) =>
    searchableFields.some((field) => {
      const value = document[field];

      if (value === null || value === undefined) {
        return false;
      }

      return value.toString().toLowerCase().includes(query);
    })
  );
};

/**
 * Generic document filter.
 */
export const filterDocuments = (documents: any = [],filters: any = {}) => {
  if (!Object.keys(filters).length) {
    return documents;
  }

  return documents.filter((document) =>
    Object.entries(filters).every(([key, value]) => {
      if (
        value === undefined ||
        value === null ||
        value === ""
      ) {
        return true;
      }

      return document[key] === value;
    })
  );
};

/**
 * Generic document sort.
 */
export const sortDocuments = (documents: any = [],
  field = "documentName",
  direction = "asc"
) => {
  return [...documents].sort((a, b) => {
    const valueA = a[field];
    const valueB = b[field];

    if (valueA == null) return 1;
    if (valueB == null) return -1;

    const shouldCompareAsDate =
      field.toLowerCase().includes("date") &&
      valueA !== "-" &&
      valueB !== "-";
    const dateA = shouldCompareAsDate ? new Date(valueA) : null;
    const dateB = shouldCompareAsDate ? new Date(valueB) : null;

    if (dateA && dateB && !Number.isNaN(dateA.valueOf()) && !Number.isNaN(dateB.valueOf())) {
      return direction === "asc"
        ? dateA.valueOf() - dateB.valueOf()
        : dateB.valueOf() - dateA.valueOf();
    }

    if (
      typeof valueA === "string" &&
      typeof valueB === "string"
    ) {
      return direction === "asc"
        ? valueA.localeCompare(valueB)
        : valueB.localeCompare(valueA);
    }

    return direction === "asc"
      ? valueA - valueB
      : valueB - valueA;
  });
};

/**
 * Search + Filter + Sort.
 */
export const processDocuments = (documents: any = [],
  {
    keyword = "",
    filters = {},
    searchableFields,
    sortField = "documentName",
    sortDirection = "asc",
  }: {
    keyword?: string;
    filters?: Record<string, unknown>;
    searchableFields?: string[];
    sortField?: string;
    sortDirection?: string;
  } = {}
) => {
  let result = searchDocuments(
    documents,
    keyword,
    searchableFields
  );

  result = filterDocuments(result, filters);

  result = sortDocuments(
    result,
    sortField,
    sortDirection
  );

  return result;
};

/**
 * Returns unique values for a field.
 */
export const getUniqueFieldValues = (documents: any = [],
  field
) => {
  return [...new Set<any>(documents.map((doc) => doc[field]))]
    .filter(Boolean)
    .sort();
};

/**
 * Groups documents by any field.
 */
export const groupDocumentsByField = (documents: any = [],
  field
) => {
  return documents.reduce((groups, document) => {
    const key = document[field] || "Unknown";

    if (!groups[key]) {
      groups[key] = [];
    }

    groups[key].push(document);

    return groups;
  }, {});
};

/**
 * Returns total matching documents.
 */
export const getSearchResultCount = (documents: any = [],
  keyword = "",
  searchableFields
) => {
  return searchDocuments(
    documents,
    keyword,
    searchableFields
  ).length;
};
