import { describe, it, expect } from "bun:test";
import { generateReportCsv } from "../csv";
import type { CsvReportRow, CsvReportTotals } from "../csv";

const totals: CsvReportTotals = {
  sumTotal: "100.00",
  sumHonorario: "0.00",
  totalReceived: "0.00",
};

const baseRow: CsvReportRow = {
  orderNumber: "OS-0001",
  client: { name: "João Silva" },
  createdAt: "2026-06-01T10:00:00.000Z",
  completedAt: null,
  total: "100.00",
  honorario: "0.00",
  paymentStatus: "UNPAID",
  status: "PENDING",
};

describe("generateReportCsv", () => {
  it("includes a header row and a totals row", () => {
    const csv = generateReportCsv([baseRow], totals);

    expect(csv).toContain("Nº OS");
    expect(csv).toContain("Total geral");
    expect(csv).toContain("OS-0001");
  });

  it("quotes cells containing commas (RFC 4180)", () => {
    const csv = generateReportCsv(
      [{ ...baseRow, client: { name: "Silva, João" } }],
      totals,
    );

    expect(csv).toContain('"Silva, João"');
  });

  it("escapes embedded double-quotes by doubling them", () => {
    const csv = generateReportCsv(
      [{ ...baseRow, client: { name: 'A "B" C' } }],
      totals,
    );

    expect(csv).toContain('"A ""B"" C"');
  });

  it("neutralizes formula injection by prefixing dangerous cells with a quote", () => {
    const csv = generateReportCsv(
      [{ ...baseRow, client: { name: "=HYPERLINK(1+2)" } }],
      totals,
    );

    // The leading "=" must be defused (prefixed with '). No comma/quote here,
    // so RFC 4180 quoting does not apply — just the prefix.
    expect(csv).toContain("'=HYPERLINK(1+2)");
    expect(csv).not.toContain(",=HYPERLINK");
  });
});
