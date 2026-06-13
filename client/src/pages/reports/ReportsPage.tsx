import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Download, FileBarChart, Wallet } from "lucide-react";
import { toast } from "sonner";
import {
  downloadAllOrdersExport,
  getAllOrders,
  getMonthlyBilling,
  type AllOrdersFilters,
  type AllOrdersResult,
  type MonthlyBilling,
} from "@/api/reports";
import { type OrderStatus } from "@/api/orders";
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
import { Button } from "@/components/ui/button";
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
import { PartnerNameFilter } from "@/components/clients/PartnerNameFilter";
import { TH, TH_RIGHT, TD, TD_RIGHT, TABLE_WRAP } from "@/lib/table-classes";

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: new Date(2000, i, 1).toLocaleDateString("pt-BR", { month: "long" }),
}));

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

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

      <div className="border-b flex gap-1">
        {(["monthly", "all"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-all",
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border/60",
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

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Faturamento total
            </CardTitle>
            <span className="flex size-9 items-center justify-center rounded-xl bg-success/10 text-success">
              <Wallet className="h-5 w-5 shrink-0" />
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
              Honorário total
            </CardTitle>
            <span className="flex size-9 items-center justify-center rounded-xl bg-info/10 text-info">
              <Wallet className="h-5 w-5 shrink-0" />
            </span>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold">
                {formatCurrency(data?.totalHonorario ?? 0)}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Receita de serviço no mês
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ordens concluídas
            </CardTitle>
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
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
        <div className={TABLE_WRAP}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={TH}>Ordem</TableHead>
                <TableHead className={TH}>Cliente</TableHead>
                <TableHead className={TH}>Concluída em</TableHead>
                <TableHead className={TH_RIGHT}>Valor</TableHead>
                <TableHead className={TH_RIGHT}>Honorário</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className={TD}>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell className={TD}>
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell className={TD}>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell className={TD_RIGHT}>
                        <Skeleton className="ml-auto h-4 w-16" />
                      </TableCell>
                      <TableCell className={TD_RIGHT}>
                        <Skeleton className="ml-auto h-4 w-16" />
                      </TableCell>
                    </TableRow>
                  ))
                : data?.orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className={`${TD} font-medium`}>
                        <Link
                          to={`/orders/${order.id}`}
                          className="text-primary hover:underline"
                        >
                          {order.orderNumber}
                        </Link>
                      </TableCell>
                      <TableCell className={TD}>{order.client.name}</TableCell>
                      <TableCell className={TD}>{formatDate(order.completedAt)}</TableCell>
                      <TableCell className={TD_RIGHT}>
                        {formatCurrency(order.value)}
                      </TableCell>
                      <TableCell className={TD_RIGHT}>
                        {formatCurrency(order.honorario)}
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
  const [partnerName, setPartnerName] = useState("");

  const [data, setData] = useState<AllOrdersResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const filters = useMemo<AllOrdersFilters>(
    () => ({
      ...(dateFrom && { dateFrom }),
      ...(dateTo && { dateTo }),
      ...(status && { status: status as OrderStatus }),
      ...(partnerName && { partnerName }),
    }),
    [dateFrom, dateTo, status, partnerName],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
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
  }, [filters]);

  const handleExport = async (format: "csv" | "pdf") => {
    setExporting(true);
    try {
      await downloadAllOrdersExport(format, filters);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Falha ao exportar relatório",
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
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
          <PartnerNameFilter value={partnerName} onChange={setPartnerName} />
        </div>

        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleExport("csv")}
            disabled={exporting || loading}
          >
            <Download className="mr-2 h-4 w-4" />
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleExport("pdf")}
            disabled={exporting || loading}
          >
            <Download className="mr-2 h-4 w-4" />
            PDF
          </Button>
        </div>
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
        <div className={TABLE_WRAP}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={TH}>Nº OS</TableHead>
                <TableHead className={TH}>Cliente</TableHead>
                <TableHead className={TH}>Criado em</TableHead>
                <TableHead className={TH}>Concluído em</TableHead>
                <TableHead className={TH_RIGHT}>Total</TableHead>
                <TableHead className={TH_RIGHT}>Honorário</TableHead>
                <TableHead className={TH}>Pagamento</TableHead>
                <TableHead className={TH}>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 8 }).map((__, j) => (
                        <TableCell key={j} className={TD}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : data?.orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className={`${TD} font-medium`}>
                        <Link
                          to={`/orders/${order.id}`}
                          className="text-primary hover:underline"
                        >
                          {order.orderNumber}
                        </Link>
                      </TableCell>
                      <TableCell className={TD}>{order.client.name}</TableCell>
                      <TableCell className={TD}>{formatDate(order.createdAt)}</TableCell>
                      <TableCell className={TD}>
                        {order.completedAt
                          ? formatDate(order.completedAt)
                          : "—"}
                      </TableCell>
                      <TableCell className={TD_RIGHT}>
                        {formatCurrency(order.total)}
                      </TableCell>
                      <TableCell className={TD_RIGHT}>
                        {formatCurrency(order.honorario)}
                      </TableCell>
                      <TableCell className={TD}>
                        <PaymentBadge status={order.paymentStatus} />
                      </TableCell>
                      <TableCell className={TD}>
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
                    className={`${TD} font-medium text-muted-foreground`}
                  >
                    Totais
                  </TableCell>
                  <TableCell className={`${TD_RIGHT} font-bold`}>
                    {formatCurrency(data.totals.sumTotal)}
                  </TableCell>
                  <TableCell className={`${TD_RIGHT} font-bold`}>
                    {formatCurrency(data.totals.sumHonorario)}
                  </TableCell>
                  <TableCell
                    colSpan={2}
                    className={`${TD} text-sm text-muted-foreground`}
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
