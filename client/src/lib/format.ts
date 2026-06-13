// Shared pt-BR display formatters. Backend returns monetary values as decimal
// strings and timestamps as ISO strings; formatting is the frontend's job.

export function formatCurrency(value: string | number) {
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

// Client registration number is stored as an integer; display it zero-padded to
// at least 3 digits (001, 002, …). Numbers above 999 keep their full length.
export function formatRegistrationNumber(n: number) {
  return String(n).padStart(3, "0");
}
