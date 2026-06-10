import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, FileBarChart, Wallet } from "lucide-react";
import { getMonthlyBilling, type MonthlyBilling } from "@/api/reports";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: new Date(2000, i, 1).toLocaleDateString("pt-BR", { month: "long" }),
}));

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

export function ReportsPage() {
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [data, setData] = useState<MonthlyBilling | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMonthlyBilling(month, year)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Falha ao carregar o relatório",
          );
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [month, year]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Relatórios</h1>
        <p className="text-sm text-muted-foreground">
          Faturamento mensal das ordens concluídas
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Select
          value={String(month)}
          onValueChange={(v) => {
            setLoading(true);
            setMonth(Number(v));
          }}
        >
          <SelectTrigger
            className="w-full capitalize sm:w-40"
            aria-label="Selecionar mês"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map((m) => (
              <SelectItem
                key={m.value}
                value={String(m.value)}
                className="capitalize"
              >
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={String(year)}
          onValueChange={(v) => {
            setLoading(true);
            setYear(Number(v));
          }}
        >
          <SelectTrigger className="w-full sm:w-28" aria-label="Selecionar ano">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {YEARS.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Faturamento total
            </CardTitle>
            <span className="flex size-8 items-center justify-center rounded-md bg-success/10 text-success">
              <Wallet className="h-4 w-4" />
            </span>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold">
                {formatCurrency(data?.totalRevenue ?? 0)}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Apenas ordens concluídas
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ordens concluídas
            </CardTitle>
            <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <CheckCircle2 className="h-4 w-4" />
            </span>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <div className="text-2xl font-bold">{data?.orderCount ?? 0}</div>
            )}
            <p className="text-xs text-muted-foreground">No mês selecionado</p>
          </CardContent>
        </Card>
      </div>

      {!loading && data && data.orders.length === 0 ? (
        <EmptyState
          icon={FileBarChart}
          title="Nenhuma ordem concluída"
          description="Não há ordens concluídas no período selecionado."
        />
      ) : (
        <div className="overflow-x-auto rounded-md border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ordem</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Concluída em</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="ml-auto h-4 w-16" />
                      </TableCell>
                    </TableRow>
                  ))
                : data?.orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">
                        <Link
                          to={`/orders/${order.id}`}
                          className="text-primary hover:underline"
                        >
                          {order.orderNumber}
                        </Link>
                      </TableCell>
                      <TableCell>{order.client.name}</TableCell>
                      <TableCell>{formatDate(order.completedAt)}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(order.value)}
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
