import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, FileBarChart, Wallet } from "lucide-react";
import {
  getAllOrders,
  getMonthlyBilling,
  type AllOrdersResult,
  type MonthlyBilling,
} from "@/api/reports";
import { getClients, type Client } from "@/api/clients";
import {
  PAYMENT_STATUS_LABELS,
  type OrderStatus,
  type PaymentStatus,
} from "@/api/orders";
import { ORDER_STATUSES, ORDER_STATUS_LABELS } from "@/lib/order-status";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { PaymentBadge } from "@/components/orders/PaymentBadge";

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: new Date(2000, i, 1).toLocaleDateString("pt-BR", { month: "long" }),
}));

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

const PAYMENT_STATUSES = Object.keys(
  PAYMENT_STATUS_LABELS,
) as PaymentStatus[];

type Tab = "monthly" | "all";

export function ReportsPage() {
  const [tab, setTab] = useState<Tab>("monthly");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Relatórios</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe as ordens de serviço e o faturamento da empresa
        </p>
      </div>

      <div className="border-b flex">
        {(["monthly", "all"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === t
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
            )}
          >
            {t === "monthly" ? "Concluídas no mês" : "Todas as OSs"}
          </button>
        ))}
      </div>

      {tab === "monthly" ? <MonthlyBillingTab /> : <AllOrdersTab />}
    </div>
  );
}

function MonthlyBillingTab() {
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

function AllOrdersTab() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [status, setStatus] = useState<string>("");
  const [paymentStatus, setPaymentStatus] = useState<string>("");
  const [clientId, setClientId] = useState<string>("");

  const [clients, setClients] = useState<Client[]>([]);
  const [data, setData] = useState<AllOrdersResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getClients({ limit: 100 })
      .then((r) => setClients(r.clients))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const filters = {
      ...(dateFrom && { dateFrom }),
      ...(dateTo && { dateTo }),
      ...(status && { status: status as OrderStatus }),
      ...(paymentStatus && { paymentStatus: paymentStatus as PaymentStatus }),
      ...(clientId && { clientId: Number(clientId) }),
    };

    getAllOrders(filters)
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
  }, [dateFrom, dateTo, status, paymentStatus, clientId]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="w-full sm:w-40"
          aria-label="Data inicial"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="w-full sm:w-40"
          aria-label="Data final"
        />
        <Select
          value={status || "all"}
          onValueChange={(v) => setStatus(v === "all" ? "" : v)}
        >
          <SelectTrigger className="w-full sm:w-48" aria-label="Status da OS">
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {ORDER_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {ORDER_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={paymentStatus || "all"}
          onValueChange={(v) => setPaymentStatus(v === "all" ? "" : v)}
        >
          <SelectTrigger
            className="w-full sm:w-48"
            aria-label="Status de pagamento"
          >
            <SelectValue placeholder="Todos os pagamentos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os pagamentos</SelectItem>
            {PAYMENT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {PAYMENT_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={clientId || "all"}
          onValueChange={(v) => setClientId(v === "all" ? "" : v)}
        >
          <SelectTrigger className="w-full sm:w-48" aria-label="Cliente">
            <SelectValue placeholder="Todos os clientes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os clientes</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
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

      {!loading && data && data.orders.length === 0 ? (
        <EmptyState
          icon={FileBarChart}
          title="Nenhuma ordem encontrada"
          description="Nenhuma ordem corresponde aos filtros selecionados."
        />
      ) : (
        <div className="overflow-x-auto rounded-md border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº OS</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead>Concluído em</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Honorário</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 8 }).map((__, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
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
                      <TableCell>{formatDate(order.createdAt)}</TableCell>
                      <TableCell>
                        {order.completedAt
                          ? formatDate(order.completedAt)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(order.total)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(order.honorario)}
                      </TableCell>
                      <TableCell>
                        <PaymentBadge status={order.paymentStatus} />
                      </TableCell>
                      <TableCell>
                        <OrderStatusBadge status={order.status} />
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
            {!loading && data && data.orders.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="font-medium text-muted-foreground"
                  >
                    Totais
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {formatCurrency(data.totals.sumTotal)}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {formatCurrency(data.totals.sumHonorario)}
                  </TableCell>
                  <TableCell
                    colSpan={2}
                    className="text-sm text-muted-foreground"
                  >
                    Recebido: {formatCurrency(data.totals.totalReceived)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      )}
    </div>
  );
}
