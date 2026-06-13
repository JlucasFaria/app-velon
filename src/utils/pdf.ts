// PDF rendering utilities — service-order PDF and all-orders report PDF.
// Built with PDFKit (no headless browser): light in Docker/CI, identical output
// everywhere. All renderers are pure: they take already-resolved data and return
// a Buffer, leaving querying to the service layer.

import PDFDocument from "pdfkit";
import path from "node:path";
import { existsSync } from "node:fs";
import type {
  OrderStatus,
  PaymentStatus,
  ClientType,
} from "../../generated/prisma";
import { UPLOADS_DIR, UPLOADS_URL_PREFIX } from "../config/constants";

export interface OrderPdfItem {
  description: string;
  category: string | null;
  unitValue: string;
  quantity: number;
  subtotal: string;
}

export interface OrderPdfCompany {
  name: string;
  document: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  logoUrl: string | null;
  footerNote: string | null;
}

export interface OrderPdfClient {
  name: string;
  document: string;
  clientType: ClientType;
}

export interface OrderPdfData {
  orderNumber: string;
  description: string;
  value: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentNote: string | null;
  createdAt: Date;
  completedAt: Date | null;
  items: OrderPdfItem[];
  client: OrderPdfClient;
  company: OrderPdfCompany;
}

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Pendente",
  IN_PROGRESS: "Em andamento",
  AWAITING_CLIENT: "Aguardando cliente",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
};

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  UNPAID: "Não pago",
  PAID_PIX: "Pago — Pix",
  PAID_CREDIT: "Pago — Cartão de crédito",
  PAID_DEBIT: "Pago — Cartão de débito",
  PAID_CASH: "Pago — Dinheiro",
  PAID_TRANSFER: "Pago — Transferência",
  PAID_OTHER: "Pago — Outro",
};

const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  COUNTER: "Balcão",
  PARTNER: "Parceiro",
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

function formatCurrency(decimal: string): string {
  return currencyFormatter.format(Number(decimal));
}

function formatDate(date: Date): string {
  return dateFormatter.format(date);
}

// The stored logoUrl is a public path (e.g. /api/uploads/logos/company-1.png);
// map it back to the on-disk file so PDFKit can embed it. Returns null when the
// company has no logo or the file is missing, so rendering never throws over it.
function resolveLogoPath(logoUrl: string | null): string | null {
  if (!logoUrl || !logoUrl.startsWith(`${UPLOADS_URL_PREFIX}/`)) return null;
  const relative = logoUrl.slice(UPLOADS_URL_PREFIX.length).replace(/^\/+/, "");
  const filePath = path.join(UPLOADS_DIR, relative);
  return existsSync(filePath) ? filePath : null;
}

// Page geometry (A4 with a 50pt margin).
const MARGIN = 50;
const PAGE_WIDTH = 595.28;
const CONTENT_LEFT = MARGIN;
const CONTENT_RIGHT = PAGE_WIDTH - MARGIN;
const CONTENT_WIDTH = CONTENT_RIGHT - CONTENT_LEFT;

const GRAY = "#666666";
const DARK = "#111111";
const LINE = "#dddddd";

// Items-table column layout (x offsets and widths), ending flush at CONTENT_RIGHT.
const COL = {
  desc: { x: CONTENT_LEFT, w: 200 },
  category: { x: CONTENT_LEFT + 205, w: 95 },
  qty: { x: CONTENT_LEFT + 305, w: 40 },
  unit: { x: CONTENT_LEFT + 350, w: 70 },
  subtotal: { x: CONTENT_LEFT + 425, w: 70 },
} as const;

type Doc = InstanceType<typeof PDFDocument>;

function drawDivider(doc: Doc, y: number): void {
  doc
    .moveTo(CONTENT_LEFT, y)
    .lineTo(CONTENT_RIGHT, y)
    .strokeColor(LINE)
    .lineWidth(1)
    .stroke();
}

function drawHeader(doc: Doc, company: OrderPdfCompany): number {
  const logoPath = resolveLogoPath(company.logoUrl);
  const textX = logoPath ? CONTENT_LEFT + 85 : CONTENT_LEFT;
  const textWidth = CONTENT_RIGHT - textX;

  if (logoPath) {
    doc.image(logoPath, CONTENT_LEFT, MARGIN, { fit: [70, 70] });
  }

  doc
    .fillColor(DARK)
    .font("Helvetica-Bold")
    .fontSize(16)
    .text(company.name, textX, MARGIN, { width: textWidth });

  const details = [
    company.document,
    company.phone,
    company.email,
    company.address,
  ].filter((line): line is string => Boolean(line));

  if (details.length > 0) {
    doc
      .fillColor(GRAY)
      .font("Helvetica")
      .fontSize(9)
      .text(details.join("\n"), textX, doc.y + 2, { width: textWidth });
  }

  const y = Math.max(doc.y, logoPath ? MARGIN + 70 : doc.y) + 12;
  drawDivider(doc, y);
  return y + 12;
}

function drawTitle(doc: Doc, data: OrderPdfData, startY: number): number {
  doc
    .fillColor(DARK)
    .font("Helvetica-Bold")
    .fontSize(14)
    .text(`Ordem de Serviço ${data.orderNumber}`, CONTENT_LEFT, startY);

  doc
    .fillColor(GRAY)
    .font("Helvetica")
    .fontSize(9)
    .text(`Emitida em ${formatDate(data.createdAt)}`, CONTENT_LEFT, doc.y + 2);

  return doc.y + 14;
}

// Renders a "Label" heading followed by a free-text block.
function drawSection(
  doc: Doc,
  title: string,
  body: string,
  startY: number,
): number {
  doc
    .fillColor(DARK)
    .font("Helvetica-Bold")
    .fontSize(10)
    .text(title, CONTENT_LEFT, startY);

  doc
    .fillColor(DARK)
    .font("Helvetica")
    .fontSize(10)
    .text(body, CONTENT_LEFT, doc.y + 2, { width: CONTENT_WIDTH });

  return doc.y + 12;
}

function drawClientBlock(
  doc: Doc,
  client: OrderPdfClient,
  startY: number,
): number {
  const body = [
    client.name,
    `Documento: ${client.document}`,
    `Tipo: ${CLIENT_TYPE_LABELS[client.clientType]}`,
  ].join("\n");
  return drawSection(doc, "Cliente", body, startY);
}

function drawCell(
  doc: Doc,
  text: string,
  col: { x: number; w: number },
  y: number,
  align: "left" | "right",
): void {
  doc.text(text, col.x, y, { width: col.w, align });
}

function drawItemsTable(doc: Doc, data: OrderPdfData, startY: number): number {
  doc
    .fillColor(DARK)
    .font("Helvetica-Bold")
    .fontSize(10)
    .text("Itens", CONTENT_LEFT, startY);

  let y = doc.y + 6;

  // Header row.
  doc.fillColor(GRAY).font("Helvetica-Bold").fontSize(9);
  drawCell(doc, "Descrição", COL.desc, y, "left");
  drawCell(doc, "Categoria", COL.category, y, "left");
  drawCell(doc, "Qtd", COL.qty, y, "right");
  drawCell(doc, "Valor unit.", COL.unit, y, "right");
  drawCell(doc, "Subtotal", COL.subtotal, y, "right");
  y += 16;
  drawDivider(doc, y - 4);

  doc.fillColor(DARK).font("Helvetica").fontSize(9);
  for (const item of data.items) {
    const descHeight = doc.heightOfString(item.description, {
      width: COL.desc.w,
    });
    const categoryHeight = doc.heightOfString(item.category ?? "—", {
      width: COL.category.w,
    });
    const rowHeight = Math.max(descHeight, categoryHeight, 12);

    drawCell(doc, item.description, COL.desc, y, "left");
    drawCell(doc, item.category ?? "—", COL.category, y, "left");
    drawCell(doc, String(item.quantity), COL.qty, y, "right");
    drawCell(doc, formatCurrency(item.unitValue), COL.unit, y, "right");
    drawCell(doc, formatCurrency(item.subtotal), COL.subtotal, y, "right");

    y += rowHeight + 6;
  }

  drawDivider(doc, y - 2);
  y += 6;

  doc.fillColor(DARK).font("Helvetica-Bold").fontSize(11);
  doc.text("Total", COL.unit.x, y, { width: COL.unit.w, align: "right" });
  doc.text(formatCurrency(data.value), COL.subtotal.x, y, {
    width: COL.subtotal.w,
    align: "right",
  });

  return y + 22;
}

function drawStatusBlock(doc: Doc, data: OrderPdfData, startY: number): number {
  const payment =
    data.paymentStatus === "PAID_OTHER" && data.paymentNote
      ? `${PAYMENT_STATUS_LABELS[data.paymentStatus]} (${data.paymentNote})`
      : PAYMENT_STATUS_LABELS[data.paymentStatus];

  const lines = [
    `Status da OS: ${ORDER_STATUS_LABELS[data.status]}`,
    `Pagamento: ${payment}`,
  ];
  if (data.completedAt) {
    lines.push(`Concluída em: ${formatDate(data.completedAt)}`);
  }

  doc
    .fillColor(DARK)
    .font("Helvetica")
    .fontSize(10)
    .text(lines.join("\n"), CONTENT_LEFT, startY, { width: CONTENT_WIDTH });

  return doc.y + 12;
}

// Footer note sits at the bottom of the page, separated by a divider.
function drawFooter(doc: Doc, footerNote: string | null): void {
  if (!footerNote) return;
  const y = 780;
  drawDivider(doc, y);
  doc
    .fillColor(GRAY)
    .font("Helvetica")
    .fontSize(8)
    .text(footerNote, CONTENT_LEFT, y + 6, {
      width: CONTENT_WIDTH,
      align: "center",
    });
}

// ─── All-orders report PDF ─────────────────────────────────────────────────────

export interface ReportPdfRow {
  orderNumber: string;
  client: { name: string };
  createdAt: string;
  completedAt: string | null;
  total: string;
  honorario: string;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
}

export interface ReportPdfTotals {
  sumTotal: string;
  sumHonorario: string;
  totalReceived: string;
}

export interface ReportPdfData {
  rows: ReportPdfRow[];
  totals: ReportPdfTotals;
  dateFrom?: string;
  dateTo?: string;
}

// Portrait A4, 8pt rows — column x offsets and widths summing to 495pt (content width).
const RCOL = {
  os: { x: CONTENT_LEFT, w: 52 },
  client: { x: CONTENT_LEFT + 57, w: 105 },
  createdAt: { x: CONTENT_LEFT + 167, w: 52 },
  completedAt: { x: CONTENT_LEFT + 224, w: 58 },
  total: { x: CONTENT_LEFT + 287, w: 50 },
  honorario: { x: CONTENT_LEFT + 342, w: 50 },
  payment: { x: CONTENT_LEFT + 397, w: 68 },
  status: { x: CONTENT_LEFT + 470, w: 25 },
} as const;

const ROW_HEIGHT = 14;
const HEADER_HEIGHT = 16;
// Reserve space for the totals row + small padding at the bottom of each page.
const PAGE_BOTTOM_LIMIT = 841.89 - MARGIN - ROW_HEIGHT * 2 - 20;

function drawReportCell(
  doc: Doc,
  text: string,
  col: { x: number; w: number },
  y: number,
  align: "left" | "right" = "left",
): void {
  doc.text(text, col.x, y, { width: col.w, align, lineBreak: false });
}

function drawReportHeaders(doc: Doc, y: number): void {
  doc.fillColor(GRAY).font("Helvetica-Bold").fontSize(7);
  drawReportCell(doc, "Nº OS", RCOL.os, y);
  drawReportCell(doc, "Cliente", RCOL.client, y);
  drawReportCell(doc, "Criado em", RCOL.createdAt, y);
  drawReportCell(doc, "Concluído em", RCOL.completedAt, y);
  drawReportCell(doc, "Total", RCOL.total, y, "right");
  drawReportCell(doc, "Honorário", RCOL.honorario, y, "right");
  drawReportCell(doc, "Pagamento", RCOL.payment, y);
  drawReportCell(doc, "Status", RCOL.status, y);
  drawDivider(doc, y + HEADER_HEIGHT - 2);
}

function drawReportTotalsRow(
  doc: Doc,
  totals: ReportPdfTotals,
  y: number,
): void {
  drawDivider(doc, y - 4);
  doc.fillColor(DARK).font("Helvetica-Bold").fontSize(8);
  drawReportCell(doc, "Total", RCOL.os, y);
  drawReportCell(doc, formatCurrency(totals.sumTotal), RCOL.total, y, "right");
  drawReportCell(
    doc,
    formatCurrency(totals.sumHonorario),
    RCOL.honorario,
    y,
    "right",
  );
  doc.fillColor(GRAY).font("Helvetica").fontSize(7);
  drawReportCell(
    doc,
    `Recebido: ${formatCurrency(totals.totalReceived)}`,
    RCOL.payment,
    y,
  );
}

export function renderReportPdf(data: ReportPdfData): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: MARGIN });
  const chunks: Buffer[] = [];

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  // Title block
  doc
    .fillColor(DARK)
    .font("Helvetica-Bold")
    .fontSize(13)
    .text("Relatório — Todas as Ordens de Serviço", CONTENT_LEFT, MARGIN);

  if (data.dateFrom ?? data.dateTo) {
    const range = [
      data.dateFrom ? `de ${formatDate(new Date(data.dateFrom))}` : "",
      data.dateTo ? `até ${formatDate(new Date(data.dateTo))}` : "",
    ]
      .filter(Boolean)
      .join(" ");
    doc
      .fillColor(GRAY)
      .font("Helvetica")
      .fontSize(9)
      .text(range, CONTENT_LEFT, doc.y + 2);
  }

  let y = doc.y + 10;
  drawDivider(doc, y);
  y += 10;

  drawReportHeaders(doc, y);
  y += HEADER_HEIGHT;

  const paymentLabel: Record<PaymentStatus, string> = {
    UNPAID: "Não pago",
    PAID_PIX: "Pix",
    PAID_CREDIT: "Crédito",
    PAID_DEBIT: "Débito",
    PAID_CASH: "Dinheiro",
    PAID_TRANSFER: "Transfer.",
    PAID_OTHER: "Outro",
  };

  const statusLabel: Record<OrderStatus, string> = {
    PENDING: "Pend.",
    IN_PROGRESS: "Andamento",
    AWAITING_CLIENT: "Ag. cliente",
    COMPLETED: "Concluída",
    CANCELLED: "Cancelada",
  };

  for (const row of data.rows) {
    if (y > PAGE_BOTTOM_LIMIT) {
      doc.addPage();
      y = MARGIN;
      drawReportHeaders(doc, y);
      y += HEADER_HEIGHT;
    }

    doc.fillColor(DARK).font("Helvetica").fontSize(8);
    drawReportCell(doc, row.orderNumber, RCOL.os, y);
    drawReportCell(doc, row.client.name, RCOL.client, y);
    drawReportCell(doc, formatDate(new Date(row.createdAt)), RCOL.createdAt, y);
    drawReportCell(
      doc,
      row.completedAt ? formatDate(new Date(row.completedAt)) : "—",
      RCOL.completedAt,
      y,
    );
    drawReportCell(doc, formatCurrency(row.total), RCOL.total, y, "right");
    drawReportCell(
      doc,
      formatCurrency(row.honorario),
      RCOL.honorario,
      y,
      "right",
    );
    drawReportCell(doc, paymentLabel[row.paymentStatus], RCOL.payment, y);
    drawReportCell(doc, statusLabel[row.status], RCOL.status, y);

    y += ROW_HEIGHT;
  }

  drawReportTotalsRow(doc, data.totals, y + 4);

  doc.end();
  return done;
}

// ─── Service-order PDF ────────────────────────────────────────────────────────

export function renderOrderPdf(data: OrderPdfData): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: MARGIN });
  const chunks: Buffer[] = [];

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  let y = drawHeader(doc, data.company);
  y = drawTitle(doc, data, y);
  y = drawClientBlock(doc, data.client, y);
  y = drawSection(doc, "Descrição", data.description, y);
  y = drawItemsTable(doc, data, y);
  drawStatusBlock(doc, data, y);
  drawFooter(doc, data.company.footerNote);

  doc.end();
  return done;
}
