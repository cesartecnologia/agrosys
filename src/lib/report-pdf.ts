type PdfMetric = {
  detail: string;
  label: string;
  value: string;
};

type CompanyPdfData = {
  details: string;
  legalName: string;
  name: string;
  secondaryDetails: string;
};

type ExportReportPdfInput = {
  company: CompanyPdfData;
  filterLabel: string;
  issuedAt: string;
  metrics: PdfMetric[];
  moduleTitle: string;
  periodLabel: string;
  tableHeaders: string[];
  tableRows: string[][];
};

function fileSafeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export async function exportReportPdf({
  company,
  filterLabel,
  issuedAt,
  metrics,
  moduleTitle,
  periodLabel,
  tableHeaders,
  tableRows
}: ExportReportPdfInput) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;
  const rowLimit = tableRows.length || 1;
  let y = margin;

  function addHeader() {
    doc.setFillColor(47, 111, 78);
    doc.rect(0, 0, pageWidth, 24, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(company.name, margin, 10);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    if (company.legalName && company.legalName !== company.name) doc.text(company.legalName, margin, 15);
    doc.text(company.details || "Dados da empresa não cadastrados", margin, 20);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`Relatório - ${moduleTitle}`, pageWidth - margin, 10, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Emitido em ${issuedAt}`, pageWidth - margin, 15, { align: "right" });
    doc.text(periodLabel, pageWidth - margin, 20, { align: "right" });

    y = 34;
  }

  function addPageIfNeeded(nextHeight: number) {
    if (y + nextHeight <= pageHeight - margin) return;
    doc.addPage();
    addHeader();
  }

  addHeader();

  doc.setTextColor(24, 32, 24);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(filterLabel, margin, y);
  if (company.secondaryDetails) doc.text(company.secondaryDetails, margin, y + 5);
  y += company.secondaryDetails ? 13 : 9;

  const metricGap = 4;
  const metricWidth = (contentWidth - metricGap * 3) / 4;
  const metricHeight = 22;
  metrics.slice(0, 4).forEach((metric, index) => {
    const x = margin + index * (metricWidth + metricGap);
    doc.setDrawColor(223, 231, 218);
    doc.setFillColor(248, 251, 246);
    doc.roundedRect(x, y, metricWidth, metricHeight, 2, 2, "FD");
    doc.setTextColor(101, 112, 97);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(metric.label, x + 4, y + 6);
    doc.setTextColor(24, 32, 24);
    doc.setFontSize(13);
    doc.text(metric.value, x + 4, y + 13);
    doc.setTextColor(101, 112, 97);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(metric.detail, x + 4, y + 19);
  });
  y += metricHeight + 9;

  doc.setFont("helvetica", "bold");
  doc.setTextColor(24, 32, 24);
  doc.setFontSize(10);
  doc.text(`${rowLimit.toLocaleString("pt-BR")} registros`, margin, y);
  y += 6;

  const columnCount = Math.max(tableHeaders.length, 1);
  const columnGap = 2;
  const columnWidth = (contentWidth - columnGap * (columnCount - 1)) / columnCount;

  function drawTableHeader() {
    addPageIfNeeded(12);
    doc.setFillColor(237, 242, 233);
    doc.rect(margin, y, contentWidth, 8, "F");
    doc.setTextColor(101, 112, 97);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.4);
    tableHeaders.forEach((header, index) => {
      const x = margin + index * (columnWidth + columnGap) + 2;
      doc.text(doc.splitTextToSize(header, columnWidth - 4).slice(0, 1), x, y + 5.3);
    });
    y += 8;
  }

  drawTableHeader();

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(24, 32, 24);

  const rows = tableRows.length ? tableRows : [["Nenhum registro encontrado."]];
  rows.forEach((row) => {
    const cells = tableHeaders.length ? row : [row[0]];
    const wrapped = cells.map((cell) => doc.splitTextToSize(String(cell || "-"), columnWidth - 4).slice(0, 3));
    const rowHeight = Math.max(8, Math.max(...wrapped.map((cell) => cell.length)) * 4 + 4);
    addPageIfNeeded(rowHeight + 2);
    if (y < 36) drawTableHeader();

    doc.setDrawColor(238, 242, 236);
    doc.line(margin, y, pageWidth - margin, y);
    wrapped.forEach((cell, index) => {
      const x = margin + index * (columnWidth + columnGap) + 2;
      doc.text(cell, x, y + 5);
    });
    y += rowHeight;
  });

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    doc.setTextColor(101, 112, 97);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(`Página ${page} de ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: "right" });
  }

  doc.save(`${fileSafeName(`relatorio-${moduleTitle}`) || "relatorio"}.pdf`);
}
