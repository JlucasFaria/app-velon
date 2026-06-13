// Service-order PDF rendering. Builds a one-page A4 document programmatically
// with PDFKit (no headless browser), so it stays light in Docker/CI and produces
// identical output everywhere. The renderer is pure: it takes already-resolved
// order/company data and returns a Buffer, leaving querying to the service layer.

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
