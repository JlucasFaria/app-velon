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
