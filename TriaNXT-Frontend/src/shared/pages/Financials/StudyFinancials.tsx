import React, { useEffect, useMemo, useRef, useState } from "react";
import "./StudyFinancials.css";
import {
  getStudyFinancials,
  saveStudyFinancials,
} from "../../services/financialService";
import {
  formatSiteOption,
  resolveSiteRecord,
  MISSING_SITE_DISPLAY,
} from "../../utils/siteDisplay";
import { readStorageArray } from "../../utils/storageHelpers";

const FINANCIALS_PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

const INITIAL_BUDGET_FORM = {
  name: "",
  category: "",
  costPerUnit: "",
  units: "",
  unitType: "Subjects",
  totalCost: "" as string | number,
  version: "V1",
  currency: "USD",
  startDate: "",
  endDate: "",
  status: "Active",
  description: "",
};

const INITIAL_PAYMENT_FORM = {
  milestone: "",
  amount: "",
  paidOn: "",
  status: "Pending",
  notes: "",
};

const INITIAL_RECEIVABLE_FORM = {
  payer: "",
  amount: "",
  dueDate: "",
  status: "Pending",
};

const INITIAL_INVOICE_FORM = {
  id: null as number | null,
  invoiceNo: "",
  payer: "",
  amount: "",
  issueDate: "",
  dueDate: "",
  status: "Pending",
};

const INITIAL_SUBJECT_COST_FORM = {
  subjectId: "",
  visit: "",
  procedure: "",
  cost: "",
  quantity: "",
  status: "Pending",
};
const getStatusClassName = (status) => {
  const normalizedStatus = String(status || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");

  const statusMap = {
    active: "financial-status-active",
    paid: "financial-status-paid",
    pending: "financial-status-pending",
    upcoming: "financial-status-upcoming",
    received: "financial-status-paid",
    overdue: "financial-status-pending",
    draft: "financial-status-upcoming",
    closed: "financial-status-pending",
  };

  return statusMap[normalizedStatus] || "financial-status-upcoming";
};

const formatCurrency = (value, currency = "USD") => {
  const symbol =
    currency === "INR"
      ? "₹"
      : currency === "EUR"
      ? "€"
      : "$";

  return `${symbol}${safeNumber(value).toLocaleString("en-US")}`;
};

/**
 * Item 19: safe numeric coercion. Any non-finite value (undefined, null,
 * NaN, "", "abc") collapses to 0 so downstream totals never render NaN.
 */
const safeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Item 19: Budget Category options for the New Budget form.
 * The following categories were removed by requirement:
 *   - Clinical Operations
 *   - Regulatory
 *   - Monitoring
 *   - Data Management
 * Historical records that still reference these categories are preserved
 * (they continue to render in the budget table and in preview modals).
 */
const REMOVED_BUDGET_CATEGORIES = [
  "Clinical Operations",
  "Regulatory",
  "Monitoring",
  "Data Management",
];
const BUDGET_CATEGORY_OPTIONS = [
  "Site Management",
  "Patient Recruitment",
  "Laboratory",
  "Pharmacy",
].filter((option) => !REMOVED_BUDGET_CATEGORIES.includes(option));

// Resolves the study's site against the global sites registry so the real
// Site Number can be shown alongside Site Name — study records only store
// a site name/location, not a number (same lookup used by Studies.js and
// studyService.js's deriveStudySiteRelationship).
function getStudySiteFinancialDisplay(study, sites) {
  const siteReference = {
    siteName:
      (study && (study.siteName || study.site || study.location)) || "",
    siteNumber: (study && (study.siteNumber || study.siteNo)) || "",
  };

  const matchedSite = resolveSiteRecord(siteReference, sites);

  return (
    formatSiteOption(matchedSite || siteReference) || MISSING_SITE_DISPLAY
  );
}

function StudyFinancials({ study }: any = {}) {
  const studyKey =
    (study && (study.studyId || study.id || study.code || study.studyName)) ||
    "default";

  const initialFinancials = useMemo(
    () => getStudyFinancials(studyKey),
    [studyKey],
  );

  const siteRecords = useMemo(() => readStorageArray("sites"), []);

  const [selectedFilter, setSelectedFilter] = useState("All");
  const [showAllData, setShowAllData] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState("");
  const [sortDirection, setSortDirection] = useState("asc");
  const [activeTab, setActiveTab] = useState("budget");

  const [budgets, setBudgets] = useState(initialFinancials.budgets);

  const [paymentList, setPaymentList] = useState(initialFinancials.payments);
  const [receivableList, setReceivableList] = useState(
    initialFinancials.receivables,
  );
  const [invoiceList, setInvoiceList] = useState(initialFinancials.invoices);
  const [subjectCostForm, setSubjectCostForm] = useState(
  INITIAL_SUBJECT_COST_FORM
);

const [subjectCosts, setSubjectCosts] = useState(
  initialFinancials.subjectCosts,
);
const [showSubjectCostModal, setShowSubjectCostModal] = useState(false);
const [editSubjectCostId, setEditSubjectCostId] = useState(null);

  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReceivableModal, setShowReceivableModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showBudgetPreview, setShowBudgetPreview] = useState(false);
const [selectedBudget, setSelectedBudget] = useState(null);

  const [budgetForm, setBudgetForm] = useState(INITIAL_BUDGET_FORM);
  const [paymentForm, setPaymentForm] = useState(INITIAL_PAYMENT_FORM);
  const [receivableForm, setReceivableForm] = useState(
    INITIAL_RECEIVABLE_FORM,
  );
  const [invoiceForm, setInvoiceForm] = useState(INITIAL_INVOICE_FORM);

  const [editBudgetId, setEditBudgetId] = useState(null);
  const [editPaymentId, setEditPaymentId] = useState(null);
  const [editReceivableId, setEditReceivableId] = useState(null);
  const [isEditingInvoice, setIsEditingInvoice] = useState(false);

  const [deleteReason, setDeleteReason] = useState("");
  const [deleteType, setDeleteType] = useState("");
  const [deleteId, setDeleteId] = useState(null);

  const [rowsPerPage, setRowsPerPage] = useState(5);

  /*
    Reload state whenever the active study changes so each study has its
    own persisted financial records.
  */
  const currentStudyKeyRef = useRef(studyKey);
  useEffect(() => {
    if (currentStudyKeyRef.current === studyKey) {
      return;
    }
    currentStudyKeyRef.current = studyKey;

    const next = getStudyFinancials(studyKey);
    setBudgets(next.budgets);
    setPaymentList(next.payments);
    setReceivableList(next.receivables);
    setInvoiceList(next.invoices);
    setSubjectCosts(next.subjectCosts);
  }, [studyKey]);

  /*
    Persist per-study financial records to localStorage whenever any
    section changes.
  */
 // Load financial data whenever the selected study changes.
  useEffect(() => {
    saveStudyFinancials(studyKey, {
      budgets,
      payments: paymentList,
      receivables: receivableList,
      invoices: invoiceList,
      subjectCosts,
    });
  }, [
    studyKey,
    budgets,
    paymentList,
    receivableList,
    invoiceList,
    subjectCosts,
  ]);

  /*
    Item 19 — Auto-refresh from the existing financial service when records
    change elsewhere (other tabs, sibling views, or programmatic updates).
    We reuse the "financials-updated" event that financialService dispatches;
    no new event bus or store is introduced.
  */
  useEffect(() => {
    const refreshFromStore = () => {
      const next = getStudyFinancials(studyKey);
      setBudgets((prev) => (prev === next.budgets ? prev : next.budgets));
      setPaymentList((prev) =>
        prev === next.payments ? prev : next.payments,
      );
      setReceivableList((prev) =>
        prev === next.receivables ? prev : next.receivables,
      );
      setInvoiceList((prev) =>
        prev === next.invoices ? prev : next.invoices,
      );
      setSubjectCosts((prev) =>
        prev === next.subjectCosts ? prev : next.subjectCosts,
      );
    };

    window.addEventListener("financials-updated", refreshFromStore);
    return () => {
      window.removeEventListener("financials-updated", refreshFromStore);
    };
  }, [studyKey]);

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();

  const filteredPaymentList = useMemo(() => {
    return paymentList.filter((payment) => {
      const matchesSearch = String(payment.milestone || "")
        .toLowerCase()
        .includes(normalizedSearchTerm);

      const matchesStatus =
        selectedFilter === "All" || payment.status === selectedFilter;

      return matchesSearch && matchesStatus;
    });
  }, [paymentList, normalizedSearchTerm, selectedFilter]);

  const filteredReceivableList = useMemo(() => {
    return receivableList.filter((receivable) => {
      return (
        String(receivable.payer || "")
          .toLowerCase()
          .includes(normalizedSearchTerm) ||
        String(receivable.status || "")
          .toLowerCase()
          .includes(normalizedSearchTerm)
      );
    });
  }, [receivableList, normalizedSearchTerm]);

  const filteredInvoiceList = useMemo(() => {
    return invoiceList.filter((invoice) => {
      return (
        String(invoice.invoiceNo || "")
          .toLowerCase()
          .includes(normalizedSearchTerm) ||
        String(invoice.payer || "")
          .toLowerCase()
          .includes(normalizedSearchTerm) ||
        String(invoice.status || "")
          .toLowerCase()
          .includes(normalizedSearchTerm)
      );
    });
  }, [invoiceList, normalizedSearchTerm]);

  const filteredBudgets = useMemo(() => {
    return budgets.filter((budget) => {
      return (
        String(budget.name || "")
          .toLowerCase()
          .includes(normalizedSearchTerm) ||
        String(budget.category || "")
          .toLowerCase()
          .includes(normalizedSearchTerm) ||
        String(budget.status || "")
          .toLowerCase()
          .includes(normalizedSearchTerm)
      );
    });
  }, [budgets, normalizedSearchTerm]);

  const sortedBudgets = useMemo(() => {
    const items = [...filteredBudgets];

    if (!sortField) {
      return items;
    }

    return items.sort((firstItem, secondItem) => {
      const firstValue = firstItem[sortField];
      const secondValue = secondItem[sortField];

      if (typeof firstValue === "number" && typeof secondValue === "number") {
        return sortDirection === "asc"
          ? firstValue - secondValue
          : secondValue - firstValue;
      }

      const comparison = String(firstValue || "").localeCompare(
        String(secondValue || ""),
      );

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [filteredBudgets, sortDirection, sortField]);

  const totalPages = Math.max(1, Math.ceil(sortedBudgets.length / rowsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const firstIndex = (safeCurrentPage - 1) * rowsPerPage;
  const currentBudgets = sortedBudgets.slice(
    firstIndex,
    firstIndex + rowsPerPage,
  );

// Item 19 — Total Budget = sum of budget records (dynamic).
const totalBudget = useMemo(
  () =>
    budgets.reduce((sum, item) => sum + safeNumber(item.totalCost), 0),
  [budgets]
);

  // Item 19 — Total Spend = sum of expense (payment) records (dynamic).
  const totalPayments = useMemo(
    () =>
      paymentList.reduce((sum, item) => sum + safeNumber(item.amount), 0),
    [paymentList],
  );
  const totalSpend = totalPayments;

  // Item 19 — subject-cost aggregate with NaN-safe multiplication.
  const grandTotal = useMemo(
  () =>
    subjectCosts.reduce(
      (sum, item) => sum + safeNumber(item.cost) * safeNumber(item.quantity),
      0
    ),
  [subjectCosts]
);

  // Item 19 — Remaining Budget = Total Budget - Total Spend.
  const remainingBudget = totalBudget - totalSpend;
  const netBudgetCost = totalBudget - totalSpend - grandTotal;
  const utilizedPercentage =
    totalBudget > 0
      ? Math.min((totalSpend / totalBudget) * 100, 100)
      : 0;

  // Item 19 — dynamic per-category breakdown for the summary chart.
  const budgetByCategory = useMemo(() => {
    const map = new Map();
    budgets.forEach((item) => {
      const key = String(item.category || "Uncategorized");
      map.set(key, safeNumber(map.get(key)) + safeNumber(item.totalCost));
    });
    return Array.from(map.entries()).map(([category, amount]) => ({
      category,
      amount,
    }));
  }, [budgets]);

  const resetBudgetModal = () => {
    setBudgetForm(INITIAL_BUDGET_FORM);
    setEditBudgetId(null);
    setShowBudgetModal(false);
  };

  const resetPaymentModal = () => {
    setPaymentForm(INITIAL_PAYMENT_FORM);
    setEditPaymentId(null);
    setShowPaymentModal(false);
  };

  const resetReceivableModal = () => {
    setReceivableForm(INITIAL_RECEIVABLE_FORM);
    setEditReceivableId(null);
    setShowReceivableModal(false);
  };

  const resetInvoiceModal = () => {
    setInvoiceForm(INITIAL_INVOICE_FORM);
    setIsEditingInvoice(false);
    setShowInvoiceModal(false);
  };

  const openNewBudgetModal = () => {
    setBudgetForm(INITIAL_BUDGET_FORM);
    setEditBudgetId(null);
    setShowBudgetModal(true);
  };
  const handleBudgetPreview = (budget) => {
  setSelectedBudget(budget);
  setShowBudgetPreview(true);
};

  const openNewPaymentModal = () => {
    setPaymentForm(INITIAL_PAYMENT_FORM);
    setEditPaymentId(null);
    setShowPaymentModal(true);
  };

  const openNewReceivableModal = () => {
    setReceivableForm(INITIAL_RECEIVABLE_FORM);
    setEditReceivableId(null);
    setShowReceivableModal(true);
  };

  const openNewInvoiceModal = () => {
    setInvoiceForm(INITIAL_INVOICE_FORM);
    setIsEditingInvoice(false);
    setShowInvoiceModal(true);
  };

  const handleEditBudget = (budget) => {
  setBudgetForm({
    name: budget.name || "",
    category: budget.category || "",
    costPerUnit: budget.costPerUnit || "",
    units: budget.units || "",
    unitType: budget.unitType || "Subjects",
    totalCost: budget.totalCost || "",
    version: budget.version || "V1",
    currency: budget.currency || "USD",
    startDate: budget.startDate || "",
    endDate: budget.endDate || "",
    status: budget.status || "Active",
    description: budget.description || "",
  });

  setEditBudgetId(budget.id);
  setShowBudgetModal(true);
};
const updateBudgetField = (name, value) => {

  const updatedForm = {
    ...budgetForm,
    [name]: value,
  };

  const cost = Number(
    name === "costPerUnit"
      ? value
      : updatedForm.costPerUnit
  );

  const units = Number(
    name === "units"
      ? value
      : updatedForm.units
  );

  updatedForm.totalCost = cost * units;

  setBudgetForm(updatedForm);
};
const resetSubjectCostModal = () => {
  setSubjectCostForm(INITIAL_SUBJECT_COST_FORM);
  setShowSubjectCostModal(false);
};
  const handleSaveBudget = () => {
  if (
  !budgetForm.name.trim() ||
  !budgetForm.category.trim() ||
  !budgetForm.costPerUnit ||
  !budgetForm.units ||
  !budgetForm.startDate ||
  !budgetForm.endDate
) {
  alert("Please fill all required budget fields.");
  return;
}

if (
  Number(budgetForm.endDate.replace(/-/g, "")) <
  Number(budgetForm.startDate.replace(/-/g, ""))
) {
  alert("End Date should be after Start Date");
  return;
}
let version = budgetForm.version;

if (editBudgetId !== null) {
  const currentVersion = Number(
    budgetForm.version.replace("V", "")
  );
  

  version = `V${currentVersion + 1}`;
}
   const preparedBudget = {
  ...budgetForm,

  studyName:
    (study && (study.studyName || study.name || study.code)) || "",

  name: budgetForm.name.trim(),
  category: budgetForm.category.trim(),
  costPerUnit: Number(budgetForm.costPerUnit),
  units: Number(budgetForm.units),
  unitType: budgetForm.unitType,
  totalCost: Number(budgetForm.totalCost),
  version,
  currency: budgetForm.currency,
  startDate: budgetForm.startDate,
  endDate: budgetForm.endDate,
  status: budgetForm.status,
  description: budgetForm.description.trim(),
};

    if (editBudgetId !== null) {
      setBudgets((currentBudgets) =>
        currentBudgets.map((budget) =>
          budget.id === editBudgetId
            ? { ...budget, ...preparedBudget }
            : budget,
        ),
      );
    } else {
      setBudgets((currentBudgets) => [
        ...currentBudgets,
        {
          id: Date.now(),
          ...preparedBudget,
        },
      ]);
    }

    resetBudgetModal();
  };

  const handleEditPayment = (payment) => {
    setPaymentForm({
      milestone: payment.milestone || "",
      amount: payment.amount || "",
      paidOn: payment.paidOn || "",
      status: payment.status || "Pending",
      notes: payment.notes || "",
    });

    setEditPaymentId(payment.id);
    setShowPaymentModal(true);
  };

  const handleSavePayment = () => {
    if (
      !paymentForm.milestone.trim() ||
      !paymentForm.amount ||
      !paymentForm.paidOn
    ) {
      alert("Please fill all required payment fields.");
      return;
    }
    if (Number(paymentForm.amount) <= 0) {
  alert("Amount should be greater than zero");
  return;
}

    const preparedPayment = {
      milestone: paymentForm.milestone.trim(),
      amount: Number(paymentForm.amount),
      paidOn: paymentForm.paidOn,
      status: paymentForm.status,
      notes: paymentForm.notes.trim(),
    };

    if (editPaymentId !== null) {
      setPaymentList((currentPayments) =>
        currentPayments.map((payment) =>
          payment.id === editPaymentId
            ? { ...payment, ...preparedPayment }
            : payment,
        ),
      );
    } else {
      setPaymentList((currentPayments) => [
        ...currentPayments,
        {
          id: Date.now(),
          ...preparedPayment,
        },
      ]);
    }

    resetPaymentModal();
  };

  const handleEditReceivable = (receivable) => {
    setReceivableForm({
      payer: receivable.payer || "",
      amount: receivable.amount || "",
      dueDate: receivable.dueDate || "",
      status: receivable.status || "Pending",
    });

    setEditReceivableId(receivable.id);
    setShowReceivableModal(true);
  };

  const handleSaveReceivable = () => {
    if (
      !receivableForm.payer.trim() ||
      !receivableForm.amount ||
      !receivableForm.dueDate
    ) {
      alert("Please fill all required receivable fields.");
      return;
    }

    const preparedReceivable = {
      payer: receivableForm.payer.trim(),
      amount: Number(receivableForm.amount),
      dueDate: receivableForm.dueDate,
      status: receivableForm.status,
    };

    if (editReceivableId !== null) {
      setReceivableList((currentReceivables) =>
        currentReceivables.map((receivable) =>
          receivable.id === editReceivableId
            ? { ...receivable, ...preparedReceivable }
            : receivable,
        ),
      );
    } else {
      setReceivableList((currentReceivables) => [
        ...currentReceivables,
        {
          id: Date.now(),
          ...preparedReceivable,
        },
      ]);
    }

    resetReceivableModal();
  };

  const handleEditInvoice = (invoice) => {
    setInvoiceForm({
      id: invoice.id,
      invoiceNo: invoice.invoiceNo || "",
      payer: invoice.payer || "",
      amount: invoice.amount || "",
      issueDate: invoice.issueDate || "",
      dueDate: invoice.dueDate || "",
      status: invoice.status || "Pending",
    });

    setIsEditingInvoice(true);
    setShowInvoiceModal(true);
  };

  const handleSaveSubjectCost = () => {
  if (
    !subjectCostForm.subjectId ||
    !subjectCostForm.visit ||
    !subjectCostForm.procedure ||
    !subjectCostForm.cost ||
    !subjectCostForm.quantity
  ) {
    alert("Please fill all required fields.");
    return;
  }

  const newCost = {
  id: editSubjectCostId ?? Date.now(),
  subject: subjectCostForm.subjectId,
  visit: subjectCostForm.visit,
  procedure: subjectCostForm.procedure,
  cost: Number(subjectCostForm.cost),
  quantity: Number(subjectCostForm.quantity),
  status: subjectCostForm.status,
};

if (editSubjectCostId !== null) {
  setSubjectCosts((prev) =>
    prev.map((item) =>
      item.id === editSubjectCostId ? newCost : item
    )
  );
} else {
  setSubjectCosts((prev) => [...prev, newCost]);
}

setEditSubjectCostId(null);
resetSubjectCostModal();
};
const handleEditSubjectCost = (item) => {
  setEditSubjectCostId(item.id);

  setSubjectCostForm({
    subjectId: item.subject,
    visit: item.visit,
    procedure: item.procedure,
    cost: item.cost,
    quantity: item.quantity,
    status: item.status,
  });

  setShowSubjectCostModal(true);
};
const handleDeleteSubjectCost = (id) => {
  openDeleteModal("subjectCost", id);
};

  const handleSaveInvoice = () => {
    if (
      !invoiceForm.invoiceNo.trim() ||
      !invoiceForm.payer.trim() ||
      !invoiceForm.amount ||
      !invoiceForm.issueDate ||
      !invoiceForm.dueDate
    ) {
      alert("Please fill all required invoice fields.");
      return;
    }

   

    const preparedInvoice = {
      invoiceNo: invoiceForm.invoiceNo.trim(),
      payer: invoiceForm.payer.trim(),
      amount: Number(invoiceForm.amount),
      issueDate: invoiceForm.issueDate,
      dueDate: invoiceForm.dueDate,
      status: invoiceForm.status,
    };

    if (isEditingInvoice) {
      setInvoiceList((currentInvoices) =>
        currentInvoices.map((invoice) =>
          invoice.id === invoiceForm.id
            ? { ...invoice, ...preparedInvoice }
            : invoice,
        ),
      );
    } else {
      setInvoiceList((currentInvoices) => [
        ...currentInvoices,
        {
          id: Date.now(),
          ...preparedInvoice,
        },
      ]);
    }

    resetInvoiceModal();
  };

  const openDeleteModal = (type, id) => {
    setDeleteType(type);
    setDeleteId(id);
    setDeleteReason("");
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setDeleteReason("");
    setDeleteId(null);
    setDeleteType("");
    setShowDeleteModal(false);
  };

  const confirmDelete = () => {
    if (!deleteReason.trim()) {
      alert("Please enter the reason for deletion.");
      return;
    }

    if (deleteType === "budget") {
      setBudgets((currentBudgets) =>
        currentBudgets.filter((budget) => budget.id !== deleteId),
      );
    }

    if (deleteType === "payment") {
      setPaymentList((currentPayments) =>
        currentPayments.filter((payment) => payment.id !== deleteId),
      );
    }

    if (deleteType === "receivable") {
      setReceivableList((currentReceivables) =>
        currentReceivables.filter((receivable) => receivable.id !== deleteId),
      );
    }

    if (deleteType === "invoice") {
      setInvoiceList((currentInvoices) =>
        currentInvoices.filter((invoice) => invoice.id !== deleteId),
      );
    }
    if (deleteType === "subjectCost") {
  setSubjectCosts((current) =>
    current.filter((item) => item.id !== deleteId)
  );
}

    closeDeleteModal();
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection((currentDirection) =>
        currentDirection === "asc" ? "desc" : "asc",
      );
      return;
    }

    setSortField(field);
    setSortDirection("asc");
  };

  const getSortIndicator = (field) => {
    if (sortField !== field) {
      return "";
    }

    return sortDirection === "asc" ? " ↑" : " ↓";
  };

  const escapeCsvValue = (value) => {
    const text = String(value ?? "");

    if (text.includes(",") || text.includes('"') || text.includes("\n")) {
      return `"${text.replace(/"/g, '""')}"`;
    }

    return text;
  };

  const exportToCSV = () => {
    const rows = [
      ["Study Budgets"],
      [
  "Budget Name",
  "Category",
  "Cost Per Unit",
  "Units",
  "Unit Type",
  "Total Cost",
  "Version",
  "Currency",
  "Status",
  "Start Date",
  "End Date",
],
     ...filteredBudgets.map((budget) => [
  budget.name,
  budget.category,
  budget.costPerUnit,
  budget.units,
  budget.unitType,
  budget.totalCost,
  budget.version,
  budget.currency,
  budget.status,
  budget.startDate,
  budget.endDate,
]),
      [],
      ["Payments"],
      ["Milestone", "Amount", "Paid On", "Status", "Notes"],
      ...filteredPaymentList.map((payment) => [
        payment.milestone,
        payment.amount,
        payment.paidOn,
        payment.status,
        payment.notes || "",
      ]),
    ];

    const csv = rows
      .map((row) => row.map(escapeCsvValue).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "study-financials.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="financial-page tnxt-compact">
      <div className="financial-header">
        <div>
          <h2>Study Financials</h2>
          <p>Manage study budgets, payments, receivables, and invoices.</p>

          <input
            type="search"
            placeholder="Search budgets, payments, receivables..."
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setCurrentPage(1);
            }}
            className="financial-search"
          />
        </div>

        <div className="financial-filter">
          <label htmlFor="financial-status-filter">Payment status</label>

          <select
            id="financial-status-filter"
            value={selectedFilter}
            onChange={(event) => setSelectedFilter(event.target.value)}>

            <option value="All">All</option>
            <option value="Paid">Paid</option>
            <option value="Pending">Pending</option>
            <option value="Upcoming">Upcoming</option>
          </select>
        </div>
      </div>
 <h3 className="financial-section-title">
  Budget Overview
</h3> 
      <div className="financial-cards">
        <div className="financial-card">
          <h4>Total Budget</h4>
          <h2>
{formatCurrency(
   totalBudget,
   budgets[0]?.currency
)}
</h2>
        </div>

        <div className="financial-card">
          <h4>Budget Utilized</h4>
          <h2>{formatCurrency(totalPayments)}</h2>
          <p>{utilizedPercentage.toFixed(1)}% of total budget</p>
        </div>

        <div className="financial-card">
          <h4>Remaining Budget</h4>
          <h2>{formatCurrency(remainingBudget)}</h2>
        </div>

        <div className="financial-card">
          <h4>Budget Status</h4>
          <span
            className={`financial-status ${
              remainingBudget >= 0
                ? "financial-status-active"
                : "financial-status-pending"
            }`}>

            {remainingBudget >= 0 ? "Healthy" : "Exceeded"}
          </span>
          <p>Budgets created: {budgets.length}</p>
        </div>
      </div>

     <div className="budget-info-card">
  <h3>Budget Information</h3>

  <div className="budget-info-grid">
    <div>
      <span>Study</span>
      <strong>
        {(study && (study.studyName || study.name)) || "—"}
      </strong>
    </div>

    <div>
      <span>Protocol</span>
      <strong>
        {(study && (study.protocol || study.studyId || study.code)) || "—"}
      </strong>
    </div>

    <div>
      <span>Sponsor</span>
      <strong>{(study && study.sponsor) || "—"}</strong>
    </div>

    <div>
      <span>Principal Investigator</span>
      <strong>
        {(study && (study.principalInvestigator || study.pi)) || "—"}
      </strong>
    </div>

    <div>
      <span>Site</span>
      <strong>{getStudySiteFinancialDisplay(study, siteRecords)}</strong>
    </div>

    <div>
      <span>Currency</span>
      <strong>
        {(budgets[0] && budgets[0].currency) ||
          (study && study.currency) ||
          "USD"}
      </strong>
    </div>
  </div>
</div>

      <div className="financial-actions">
        <button type="button" onClick={openNewBudgetModal}>
          + New Budget
        </button>

        <button type="button" onClick={openNewPaymentModal}>
          + New Payment
        </button>

        <button type="button" onClick={openNewReceivableModal}>
          + New Receivable
        </button>

        <button type="button" onClick={openNewInvoiceModal}>
          + New Invoice
        </button>

        <button
  type="button"
  onClick={() => {
    setSubjectCostForm(INITIAL_SUBJECT_COST_FORM);
    setShowSubjectCostModal(true);
  }}>

  + New Subject Cost
</button>

        <button
          type="button"
          onClick={() => setShowAllData((currentValue) => !currentValue)}>

          {showAllData ? "Hide Summary" : "View Summary"}
        </button>

        <button type="button" onClick={exportToCSV}>
          Export CSV
        </button>
      </div>
     <div className="financial-tabs">

<button onClick={() => setActiveTab("budget")}>
          Budget Info
        </button>

<button onClick={() => setActiveTab("grants")}>

Investigator Grants
</button>

<button onClick={() => setActiveTab("site")}>
          Site Management
        </button>

<button onClick={() => setActiveTab("subjects")}>
          Subject Costs
        </button>

</div>

      {showAllData && (
  <section className="financial-summary">

    <h2>Financial Summary</h2>

    <div className="financial-summary-grid">

      <div className="summary-box">
        <span>Total Budget</span>
        <h3>{formatCurrency(totalBudget)}</h3>
      </div>

      <div className="summary-box">
        <span>Total Spend</span>
        <h3>{formatCurrency(totalSpend)}</h3>
      </div>

      <div className="summary-box">
        <span>Remaining Budget</span>
        <h3>{formatCurrency(remainingBudget)}</h3>
      </div>

      <div className="summary-box">
        <span>Subject Cost</span>
        <h3>{formatCurrency(grandTotal)}</h3>
      </div>

      <div className="summary-box">
        <span>Net Budget</span>
        <h3>{formatCurrency(netBudgetCost)}</h3>
      </div>

      <div className="summary-box">
        <span>Total Budgets</span>
        <h3>{budgets.length}</h3>
      </div>

      <div className="summary-box">
        <span>Total Payments</span>
        <h3>{paymentList.length}</h3>
      </div>

      <div className="summary-box">
        <span>Budget Utilized</span>
        <h3>{utilizedPercentage.toFixed(1)}%</h3>
      </div>

    </div>

    {/* Item 19 — Dynamic charts driven entirely by the current
        budgets / payments state. Values are NaN-safe and update
        automatically when any financial record changes. */}
    <div className="financial-charts">
      <div className="financial-chart-card">
        <h3>Budget vs Spend</h3>
        {totalBudget === 0 && totalSpend === 0 ? (
          <p className="financial-chart-empty">
            No budget or spend data yet.
          </p>
        ) : (
          <div className="financial-chart-bars">
            {(() => {
              const scaleMax = Math.max(totalBudget, totalSpend, 1);
              const budgetPct = (totalBudget / scaleMax) * 100;
              const spendPct = (totalSpend / scaleMax) * 100;
              const remainPct =
                remainingBudget > 0
                  ? (remainingBudget / scaleMax) * 100
                  : 0;
              return (
                <>
                  <div className="financial-chart-row">
                    <span className="financial-chart-label">Budget</span>
                    <div className="financial-chart-track">
                      <div
                        className="financial-chart-fill budget"
                        style={{ width: `${budgetPct}%` }}
                      />
                    </div>
                    <span className="financial-chart-value">
                      {formatCurrency(totalBudget)}
                    </span>
                  </div>
                  <div className="financial-chart-row">
                    <span className="financial-chart-label">Spend</span>
                    <div className="financial-chart-track">
                      <div
                        className="financial-chart-fill spend"
                        style={{ width: `${spendPct}%` }}
                      />
                    </div>
                    <span className="financial-chart-value">
                      {formatCurrency(totalSpend)}
                    </span>
                  </div>
                  <div className="financial-chart-row">
                    <span className="financial-chart-label">Remaining</span>
                    <div className="financial-chart-track">
                      <div
                        className="financial-chart-fill remaining"
                        style={{ width: `${remainPct}%` }}
                      />
                    </div>
                    <span className="financial-chart-value">
                      {formatCurrency(remainingBudget)}
                    </span>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>

      <div className="financial-chart-card">
        <h3>Budget by Category</h3>
        {budgetByCategory.length === 0 ? (
          <p className="financial-chart-empty">
            No budget categories yet.
          </p>
        ) : (
          <div className="financial-chart-bars">
            {(() => {
              const scaleMax =
                budgetByCategory.reduce(
                  (m, row) => Math.max(m, row.amount),
                  0,
                ) || 1;
              return budgetByCategory.map((row) => (
                <div
                  key={row.category}
                  className="financial-chart-row">

                  <span className="financial-chart-label">
                    {row.category}
                  </span>
                  <div className="financial-chart-track">
                    <div
                      className="financial-chart-fill category"
                      style={{
                        width: `${(row.amount / scaleMax) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="financial-chart-value">
                    {formatCurrency(row.amount)}
                  </span>
                </div>
              ));
            })()}
          </div>
        )}
      </div>
    </div>

  </section>
)}
      
      {activeTab === "budget" && (
  <>
      <section className="budget-list">
        <h3>Study Budgets</h3>
      </section>

      <div className="budget-table">
        <table className="ctms-standard-table">
          <thead>
  <tr>
    <th onClick={() => handleSort("name")}>
      Budget Name{getSortIndicator("name")}
    </th>

    <th onClick={() => handleSort("category")}>
      Category{getSortIndicator("category")}
    </th>

    <th onClick={() => handleSort("totalCost")}>
      Total Cost{getSortIndicator("totalCost")}
    </th>

    <th onClick={() => handleSort("costPerUnit")}>
  Cost / Unit{getSortIndicator("costPerUnit")}
</th>

<th onClick={() => handleSort("units")}>
   Units{getSortIndicator("units")}
</th>

<th onClick={() => handleSort("unitType")}>
  Unit{getSortIndicator("unitType")}
</th>

    <th onClick={() => handleSort("status")}>
      Status{getSortIndicator("status")}
    </th>

    <th onClick={() => handleSort("startDate")}>
      Start Date{getSortIndicator("startDate")}
    </th>

    <th onClick={() => handleSort("endDate")}>
      End Date{getSortIndicator("endDate")}
    </th>

    <th>Actions</th>

    <th>Version</th>
  </tr>
</thead>

          <tbody>
            {currentBudgets.length === 0 ? (
              <tr>
                <td colSpan={11}>No budgets found for this study.</td>
              </tr>
            ) : (
              currentBudgets.map((budget) => (
                <tr key={budget.id}>
                  <td>{budget.name}</td>

<td>{budget.category}</td>

<td>
  {formatCurrency(
    budget.totalCost,
    budget.currency
  )}
</td>

<td>
  {formatCurrency(
    budget.costPerUnit,
    budget.currency
  )}
</td>

<td>{budget.units}</td>

<td>{budget.unitType}</td>
                  <td>
                    <span
                      className={`financial-status ${getStatusClassName(
                        budget.status,
                      )}`}>

                      {budget.status}
                    </span>
                  </td>
                  <td>{budget.startDate}</td>
<td>{budget.endDate}</td>

<td>
  <button
    type="button"
    className="financial-action-btn"
    onClick={() => handleEditBudget(budget)}>

    Edit
  </button>

  <button
    type="button"
    className="financial-action-btn"
    onClick={() => handleBudgetPreview(budget)}>

    Preview
  </button>

  <button
  type="button"
  className="financial-delete-btn"
  onClick={() => openDeleteModal("budget", budget.id)}>

  Delete
</button>
</td>

<td>{budget.version}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      

      <div className="financial-pagination">
        <label className="financial-page-size">
          Rows
          <select
            value={rowsPerPage}
            onChange={(event) => {
              setRowsPerPage(Number(event.target.value));
              setCurrentPage(1);
            }}
            aria-label="Rows per page">

            {FINANCIALS_PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          disabled={safeCurrentPage === 1}
          onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}>

          Previous
        </button>

        <span>
          Page {safeCurrentPage} of {totalPages}
        </span>

        <button
          type="button"
          disabled={safeCurrentPage === totalPages}
          onClick={() =>
            setCurrentPage((page) => Math.min(page + 1, totalPages))
          }>

          Next
        </button>
      </div>
      </>
      )}
      {activeTab==="grants" && (
<section className="payment-table">

<h3>Investigator Grants</h3>

<table className="ctms-standard-table">

<thead>
<tr>
<th>Investigator</th>
<th>Grant Type</th>
<th>Amount</th>
<th>Status</th>
</tr>
</thead>

<tbody>
<tr>
<td colSpan={4}>No investigator grants recorded for this study.</td>
</tr>
</tbody>

</table>

</section>
)}
        {activeTab==="site" && (
<section className="payment-table">

  <h3>Site Management</h3>

  <table className="ctms-standard-table">
    <thead>
      <tr>
        <th>Site</th>
        <th>Budget</th>
        <th>Spent</th>
        <th>Remaining</th>
        <th>Status</th>
      </tr>
    </thead>

    <tbody>
      {totalBudget === 0 && totalPayments === 0 ? (
        <tr>
          <td colSpan={5}>No site management records for this study.</td>
        </tr>
      ) : (
        <tr>
          <td>{getStudySiteFinancialDisplay(study, siteRecords)}</td>
          <td>
            {formatCurrency(totalBudget, budgets[0]?.currency)}
          </td>
          <td>
            {formatCurrency(totalPayments, budgets[0]?.currency)}
          </td>
          <td>
            {formatCurrency(remainingBudget, budgets[0]?.currency)}
          </td>
          <td>{remainingBudget >= 0 ? "Healthy" : "Exceeded"}</td>
        </tr>
      )}
    </tbody>
  </table>

</section>
)}
{activeTab === "subjects" && (
  <section className="payment-table">

    <h3>Subject Costs</h3>

    <table className="ctms-standard-table">
      <thead>
        <tr>
          <th>Subject</th>
          <th>Visit</th>
          <th>Procedure</th>
          <th>Cost</th>
          <th>Quantity</th>
          <th>Total Cost</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>

      <tbody>
        {subjectCosts.length === 0 ? (
          <tr>
            <td colSpan={8}>No subject costs recorded for this study.</td>
          </tr>
        ) : (
          subjectCosts.map((item) => (
            <tr key={item.id}>
              <td>{item.subject}</td>
              <td>{item.visit}</td>
              <td>{item.procedure}</td>

              <td>{formatCurrency(item.cost)}</td>

              <td>{item.quantity}</td>

              <td>
                {formatCurrency(item.cost * item.quantity)}
              </td>

              <td>{item.status}</td>
              <td>
                <button
                  className="financial-action-btn"
                  onClick={() => handleEditSubjectCost(item)}>

                  Edit
                </button>

                <button
                  className="financial-delete-btn"
                  onClick={() => handleDeleteSubjectCost(item.id)}>

                  Delete
                </button>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </section>
)}

      <section className="payment-table">
        <h3>Study Payments</h3>

        <table className="ctms-standard-table">
          <thead>
            <tr>
              <th>Milestone</th>
              <th>Amount</th>
              <th>Paid On</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredPaymentList.length === 0 ? (
              <tr>
                <td colSpan={5}>No payments recorded for this study.</td>
              </tr>
            ) : (
              filteredPaymentList.map((payment) => (
                <tr key={payment.id}>
                  <td>{payment.milestone}</td>
                  <td>{formatCurrency(
  payment.amount,
  budgets[0]?.currency
)}</td>
                  <td>{payment.paidOn}</td>
                  <td>
                    <span
                      className={`financial-status ${getStatusClassName(
                        payment.status,
                      )}`}>

                      {payment.status}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="financial-action-btn"
                      onClick={() => handleEditPayment(payment)}>

                      Edit
                    </button>

                    <button
                      type="button"
                      className="financial-delete-btn"
                      onClick={() => openDeleteModal("payment", payment.id)}>

                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="financial-receivable-table">
        <h3>Study Receivables</h3>

        <table className="ctms-standard-table">
          <thead>
            <tr>
              <th>Payer</th>
              <th>Amount</th>
              <th>Due Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredReceivableList.length === 0 ? (
              <tr>
                <td colSpan={5}>No receivables recorded for this study.</td>
              </tr>
            ) : (
              filteredReceivableList.map((receivable) => (
                <tr key={receivable.id}>
                  <td>{receivable.payer}</td>
                  <td>{formatCurrency(
  receivable.amount,
  budgets[0]?.currency
)}</td>
                  <td>{receivable.dueDate}</td>
                  <td>
                    <span
                      className={`financial-status ${getStatusClassName(
                        receivable.status,
                      )}`}>

                      {receivable.status}
                    </span>
                  </td>
                  <td>
                    <div className="financial-receivable-action-buttons">
                      <button
                        type="button"
                        className="financial-receivable-edit-btn"
                        onClick={() => handleEditReceivable(receivable)}>

                        Edit
                      </button>

                      <button
                        type="button"
                        className="financial-receivable-delete-btn"
                        onClick={() =>
                          openDeleteModal("receivable", receivable.id)
                        }>

                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="financial-receivable-table">
        <h3>Study Invoices</h3>

        <table className="ctms-standard-table">
          <thead>
            <tr>
              <th>Invoice No</th>
              <th>Payer</th>
              <th>Amount</th>
              <th>Issue Date</th>
              <th>Due Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredInvoiceList.length === 0 ? (
              <tr>
                <td colSpan={7}>No invoices recorded for this study.</td>
              </tr>
            ) : (
              filteredInvoiceList.map((invoice) => (
                <tr key={invoice.id}>
                  <td>{invoice.invoiceNo}</td>
                  <td>{invoice.payer}</td>
                  <td>{formatCurrency(
  invoice.amount,
  budgets[0]?.currency
)}</td>
                  <td>{invoice.issueDate}</td>
                  <td>{invoice.dueDate}</td>
                  <td>
                    <span
                      className={`financial-status ${getStatusClassName(
                        invoice.status,
                      )}`}>

                      {invoice.status}
                    </span>
                  </td>
                  <td>
                    <div className="financial-receivable-action-buttons">
                      <button
                        type="button"
                        className="financial-receivable-edit-btn"
                        onClick={() => handleEditInvoice(invoice)}>

                        Edit
                      </button>

                      <button
                        type="button"
                        className="financial-receivable-delete-btn"
                        onClick={() => openDeleteModal("invoice", invoice.id)}>

                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {showBudgetModal && (
        <div className="financial-modal-overlay">
          <div className="financial-modal" role="dialog" aria-modal="true">
            <h2>
              {editBudgetId !== null
                ? "Edit Study Budget"
                : "New Study Budget"}
            </h2>

            <div className="financial-form">
              <label className="financial-form-label">Budget Name</label>
              <input
                type="text"
                value={budgetForm.name}
                onChange={(event) =>
                  setBudgetForm((currentForm) => ({
                    ...currentForm,
                    name: event.target.value,
                  }))
                }
              />

              <label className="financial-form-label">Budget Category</label>
              {/*
                Item 19 — Budget Categories are sourced from a single
                constant. The following categories are intentionally
                excluded from selection:
                Clinical Operations, Regulatory, Monitoring, Data Management.
                Historical records that already use a removed category are
                preserved (rendered as a disabled option so the edit form
                does not silently overwrite the stored value).
              */}
              <select
                value={budgetForm.category}
                onChange={(event) =>
                  updateBudgetField("category", event.target.value)
                }>

                <option value="">Select Category</option>
                {BUDGET_CATEGORY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
                {budgetForm.category &&
                  !BUDGET_CATEGORY_OPTIONS.includes(budgetForm.category) && (
                    <option value={budgetForm.category} disabled>
                      {budgetForm.category} (legacy)
                    </option>
                  )}
              </select>

             <label className="financial-form-label">Cost Per Unit</label>

<input
  type="number"
  min="0"
  value={budgetForm.costPerUnit}
  onChange={(event) =>
    setBudgetForm((currentForm) => ({
      ...currentForm,
      costPerUnit: event.target.value,
      totalCost:
        Number(event.target.value || 0) *
        Number(currentForm.units || 0),
    }))
  }
/>

<label className="financial-form-label">Units</label>

<input
  type="number"
  min="1"
  value={budgetForm.units}
  onChange={(event) =>
    setBudgetForm((currentForm) => ({
      ...currentForm,
      units: event.target.value,
      totalCost:
        Number(currentForm.costPerUnit || 0) *
        Number(event.target.value || 0),
    }))
  }
/>

<label className="financial-form-label">Unit Type</label>

<select
  value={budgetForm.unitType}
  onChange={(event) =>
    setBudgetForm((currentForm) => ({
      ...currentForm,
      unitType: event.target.value,
    }))
  }>

  <option value="Subjects">Subjects</option>
  <option value="Visits">Visits</option>
  <option value="Sites">Sites</option>
  <option value="Months">Months</option>
</select>

<label className="financial-form-label">
Total Cost
</label>

<input
   type="number"
   value={budgetForm.totalCost}
   readOnly
/>
<label className="financial-form-label">
Currency
</label>

<select
   value={budgetForm.currency}
   onChange={(event)=>
      updateBudgetField(
         "currency",
         event.target.value
      )
   }>

<option>USD</option>

<option>INR</option>

<option>EUR</option>

</select>

<label className="financial-form-label">
Version
</label>

<input
   type="text"
   value={budgetForm.version}
   readOnly
/>
              <label className="financial-form-label">Start Date</label>
             <input
   type="date"
   value={budgetForm.startDate}
   onChange={(event)=>
      updateBudgetField(
         "startDate",
         event.target.value
      )
   }
/>

              <label className="financial-form-label">End Date</label>
              <input
   type="date"
   value={budgetForm.endDate}
   onChange={(event)=>
      updateBudgetField(
         "endDate",
         event.target.value
      )
   }
/>

              <label className="financial-form-label">Budget Status</label>
              <select
   value={budgetForm.status}
   onChange={(event)=>
      updateBudgetField(
         "status",
         event.target.value
      )
   }>

                <option value="Active">Active</option>
                <option value="Draft">Draft</option>
                <option value="Closed">Closed</option>
              </select>

              <label className="financial-form-label">
                Budget Description
              </label>
              <textarea
   rows={4}
   value={budgetForm.description}
   onChange={(event)=>
      updateBudgetField(
         "description",
         event.target.value
      )
   }
/>
            </div>

            <div className="financial-modal-actions">
              <button type="button" onClick={resetBudgetModal}>
                Cancel
              </button>

              <button type="button" onClick={handleSaveBudget}>
                {editBudgetId !== null ? "Update Budget" : "Save Budget"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPaymentModal && (
        <div className="financial-modal-overlay">
          <div className="financial-modal" role="dialog" aria-modal="true">
            <h2>
              {editPaymentId !== null ? "Edit Payment" : "New Payment"}
            </h2>

            <div className="financial-form">
              <label className="financial-form-label">Milestone</label>
              <input
                type="text"
                value={paymentForm.milestone}
                onChange={(event) =>
                  setPaymentForm((currentForm) => ({
                    ...currentForm,
                    milestone: event.target.value,
                  }))
                }
              />

              <label className="financial-form-label">Amount</label>
              <input
                type="number"
                min="0"
                value={paymentForm.amount}
                onChange={(event) =>
                  setPaymentForm((currentForm) => ({
                    ...currentForm,
                    amount: event.target.value,
                  }))
                }
              />

              <label className="financial-form-label">Payment Date</label>
              <input
                type="date"
                value={paymentForm.paidOn}
                onChange={(event) =>
                  setPaymentForm((currentForm) => ({
                    ...currentForm,
                    paidOn: event.target.value,
                  }))
                }
              />

              <label className="financial-form-label">Payment Status</label>
              <select
                value={paymentForm.status}
                onChange={(event) =>
                  setPaymentForm((currentForm) => ({
                    ...currentForm,
                    status: event.target.value,
                  }))
                }>

                <option value="Paid">Paid</option>
                <option value="Pending">Pending</option>
                <option value="Upcoming">Upcoming</option>
              </select>

              <label className="financial-form-label">Notes</label>
              <textarea
                rows={4}
                value={paymentForm.notes}
                onChange={(event) =>
                  setPaymentForm((currentForm) => ({
                    ...currentForm,
                    notes: event.target.value,
                  }))
                }
              />
            </div>

            <div className="financial-modal-actions">
              <button type="button" onClick={resetPaymentModal}>
                Cancel
              </button>

              <button type="button" onClick={handleSavePayment}>
                {editPaymentId !== null ? "Update Payment" : "Save Payment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showReceivableModal && (
        <div className="financial-modal-overlay">
          <div className="financial-modal" role="dialog" aria-modal="true">
            <h2>
              {editReceivableId !== null
                ? "Edit Receivable"
                : "New Receivable"}
            </h2>

            <div className="financial-form">
              <label className="financial-form-label">Payer</label>
              <input
                type="text"
                value={receivableForm.payer}
                onChange={(event) =>
                  setReceivableForm((currentForm) => ({
                    ...currentForm,
                    payer: event.target.value,
                  }))
                }
              />

              <label className="financial-form-label">Amount</label>
              <input
                type="number"
                min="0"
                value={receivableForm.amount}
                onChange={(event) =>
                  setReceivableForm((currentForm) => ({
                    ...currentForm,
                    amount: event.target.value,
                  }))
                }
              />

              <label className="financial-form-label">Due Date</label>
              <input
                type="date"
                value={receivableForm.dueDate}
                onChange={(event) =>
                  setReceivableForm((currentForm) => ({
                    ...currentForm,
                    dueDate: event.target.value,
                  }))
                }
              />

              <label className="financial-form-label">
                Receivable Status
              </label>
              <select
                value={receivableForm.status}
                onChange={(event) =>
                  setReceivableForm((currentForm) => ({
                    ...currentForm,
                    status: event.target.value,
                  }))
                }>

                <option value="Pending">Pending</option>
                <option value="Received">Received</option>
                <option value="Overdue">Overdue</option>
              </select>
            </div>

            <div className="financial-modal-actions">
              <button type="button" onClick={resetReceivableModal}>
                Cancel
              </button>

              <button type="button" onClick={handleSaveReceivable}>
                {editReceivableId !== null
                  ? "Update Receivable"
                  : "Save Receivable"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showInvoiceModal && (
        <div className="financial-modal-overlay">
          <div className="financial-modal" role="dialog" aria-modal="true">
            <h2>{isEditingInvoice ? "Edit Invoice" : "New Invoice"}</h2>

            <div className="financial-form">
              <label className="financial-form-label">Invoice Number</label>
              <input
                type="text"
                value={invoiceForm.invoiceNo}
                onChange={(event) =>
                  setInvoiceForm((currentForm) => ({
                    ...currentForm,
                    invoiceNo: event.target.value,
                  }))
                }
              />

              <label className="financial-form-label">Payer</label>
              <input
                type="text"
                value={invoiceForm.payer}
                onChange={(event) =>
                  setInvoiceForm((currentForm) => ({
                    ...currentForm,
                    payer: event.target.value,
                  }))
                }
              />

              <label className="financial-form-label">Amount</label>
              <input
                type="number"
                min="0"
                value={invoiceForm.amount}
                onChange={(event) =>
                  setInvoiceForm((currentForm) => ({
                    ...currentForm,
                    amount: event.target.value,
                  }))
                }
              />

              <label className="financial-form-label">Issue Date</label>
              <input
                type="date"
                value={invoiceForm.issueDate}
                onChange={(event) =>
                  setInvoiceForm((currentForm) => ({
                    ...currentForm,
                    issueDate: event.target.value,
                  }))
                }
              />

              <label className="financial-form-label">Due Date</label>
              <input
                type="date"
                value={invoiceForm.dueDate}
                onChange={(event) =>
                  setInvoiceForm((currentForm) => ({
                    ...currentForm,
                    dueDate: event.target.value,
                  }))
                }
              />

              <label className="financial-form-label">Invoice Status</label>
              <select
                value={invoiceForm.status}
                onChange={(event) =>
                  setInvoiceForm((currentForm) => ({
                    ...currentForm,
                    status: event.target.value,
                  }))
                }>

                <option value="Pending">Pending</option>
                <option value="Paid">Paid</option>
                <option value="Overdue">Overdue</option>
              </select>
            </div>

            <div className="financial-modal-actions">
              <button type="button" onClick={resetInvoiceModal}>
                Cancel
              </button>

              <button type="button" onClick={handleSaveInvoice}>
                {isEditingInvoice ? "Update Invoice" : "Save Invoice"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSubjectCostModal && (
  <div className="financial-modal-overlay">
    <div className="financial-modal">

      <h2>New Subject Cost</h2>

      <div className="financial-form">

        <label>Subject ID</label>
        <input
          type="text"
          value={subjectCostForm.subjectId}
          onChange={(e)=>
            setSubjectCostForm({
              ...subjectCostForm,
              subjectId:e.target.value
            })
          }
        />

        <label>Visit</label>
        <input
          type="text"
          value={subjectCostForm.visit}
          onChange={(e)=>
            setSubjectCostForm({
              ...subjectCostForm,
              visit:e.target.value
            })
          }
        />

        <label>Procedure</label>
        <input
          type="text"
          value={subjectCostForm.procedure}
          onChange={(e)=>
            setSubjectCostForm({
              ...subjectCostForm,
              procedure:e.target.value
            })
          }
        />

        <label>Cost</label>
        <input
          type="number"
          value={subjectCostForm.cost}
          onChange={(e)=>
            setSubjectCostForm({
              ...subjectCostForm,
              cost:e.target.value
            })
          }
        />

        <label>Quantity</label>
        <input
          type="number"
          value={subjectCostForm.quantity}
          onChange={(e)=>
            setSubjectCostForm({
              ...subjectCostForm,
              quantity:e.target.value
            })
          }
        />

        <label>Total</label>

<input
  readOnly
  value={
    Number(subjectCostForm.cost || 0) *
    Number(subjectCostForm.quantity || 0)
  }
/>

        <label>Status</label>
        <select
          value={subjectCostForm.status}
          onChange={(e)=>
            setSubjectCostForm({
              ...subjectCostForm,
              status:e.target.value
            })
          }>

          <option>Pending</option>
          <option>Completed</option>
        </select>

      </div>

      <div className="financial-modal-actions">

        <button
          onClick={resetSubjectCostModal}>

          Cancel
        </button>

       <button
  onClick={handleSaveSubjectCost}>

  Save
</button>

      </div>

    </div>
  </div>
)}

      {showDeleteModal && (
        <div className="financial-modal-overlay">
          <div className="financial-modal" role="dialog" aria-modal="true">
            <h2>Delete Confirmation</h2>

            <p>Are you sure you want to delete this {deleteType}?</p>

            <div className="financial-form">
              <label className="financial-form-label">
                Reason for Delete *
              </label>

              <textarea
                rows={4}
                value={deleteReason}
                onChange={(event) => setDeleteReason(event.target.value)}
                placeholder="Enter reason..."
              />
            </div>

            <div className="financial-modal-actions">
              <button type="button" onClick={closeDeleteModal}>
                Cancel
              </button>

              <button
                type="button"
                className="financial-receivable-delete-btn"
                onClick={confirmDelete}>

                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      
      {showBudgetPreview && selectedBudget && (
  <div className="financial-modal-overlay">
    <div className="financial-modal">
      <h2>Budget Preview</h2>

      <p><b>Budget Name:</b> {selectedBudget.name}</p>
      <p><b>Version:</b> {selectedBudget.version}</p>
      <p><b>Status:</b> {selectedBudget.status}</p>
      <p><b>Study Name:</b> {selectedBudget.studyName}</p>
      <p><b>Category:</b> {selectedBudget.category}</p>

<p><b>Cost Per Unit:</b> {formatCurrency(selectedBudget.costPerUnit)}</p>

<p><b>Units:</b> {selectedBudget.units}</p>

<p><b>Total Cost:</b> {formatCurrency(selectedBudget.totalCost)}</p>

<p><b>Currency:</b> {selectedBudget.currency}</p>

<p><b>Start Date:</b> {selectedBudget.startDate}</p>

<p><b>End Date:</b> {selectedBudget.endDate}</p>

<p><b>Description:</b> {selectedBudget.description}</p>

      <div className="financial-modal-actions">
        <button
          type="button"
          onClick={() => setShowBudgetPreview(false)}>

          Close
        </button>
      </div>
    </div>
  </div>
)}
    </div>
    
  );
}

export default StudyFinancials;