import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function downloadPdfReport(documents) {

  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text("Essential Documents Checklist", 14, 20);

  autoTable(doc, {
    startY: 30,
    head: [["Document", "Category", "Version", "Status"]],
    body: documents.map((item) => [
      item.documentName,
      item.category,
      item.version,
      item.status
    ])
  });

  doc.save("EssentialDocuments.pdf");

}