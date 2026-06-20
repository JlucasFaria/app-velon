import { useEffect, useState } from "react";
import type { ElementType } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ClipboardList,
  Clock,
  Wrench,
  CheckCircle2,
  XCircle,
  HourglassIcon,
} from "lucide-react";
import { getOrdersSummary, type OrdersSummary } from "@/api/reports";
import { getOrders, type OrderListItem } from "@/api/orders";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/layout/PageHeader";
import { formatCurrency, formatDate } from "@/lib/format";
import { TH, TH_RIGHT, TD, TD_RIGHT } from "@/lib/table-classes";

interface StatCardProps {
  title: string;
  value: number;
  description: string;
  icon: ElementType;
  iconBg: string;
  iconFg: string;
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  iconBg,
  iconFg,
}: StatCardProps) {
  return (
    <div className="rounded-[18px] border border-border bg-card p-[22px] shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-elevated">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="text-[13px] font-semibold text-muted-foreground">
          {title}
        </span>
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full"
          style={{ background: iconBg, color: iconFg }}
        >
          <Icon className="h-[19px] w-[19px]" strokeWidth={1.75} />
        </span>
      </div>
      <div className="text-[34px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">
        {value}
      </div>
      <p className="mt-2 text-[12.5px] text-muted-foreground/80">{description}</p>
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="rounded-[18px] border border-border bg-card p-[22px] shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-10 rounded-full" />
      </div>
      <Skeleton className="h-8 w-12" />
      <Skeleton className="mt-2 h-3 w-20" />
    </div>
  );
}

function RecentOrdersCard() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderListItem[] | null>(null);

  useEffect(() => {
    getOrders({ limit: 5 })
      .then((d) => setOrders(d.orders))
      .catch(() => setOrders([]));
  }, []);

  return (
    <Card className="shadow-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-[17px] font-bold tracking-[-0.01em]">
          Ordens recentes
        </CardTitle>
        <Link
          to="/orders"
          className="text-sm font-semibold text-[color:var(--velon-primary-text)] hover:underline"
        >
          Ver todas
        </Link>
      </CardHeader>
      <CardContent className="px-0 pb-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={TH}>Ordem</TableHead>
              <TableHead className={TH}>Cliente</TableHead>
              <TableHead className={TH}>Status</TableHead>
              <TableHead className={TH_RIGHT}>Valor</TableHead>
              <TableHead className={TH_RIGHT}>Criada em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders === null
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className={TD}>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell className={TD}>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell className={TD}>
                      <Skeleton className="h-5 w-24 rounded-full" />
                    </TableCell>
                    <TableCell className={TD_RIGHT}>
                      <Skeleton className="ml-auto h-4 w-16" />
                    </TableCell>
                    <TableCell className={TD_RIGHT}>
                      <Skeleton className="ml-auto h-4 w-20" />
                    </TableCell>
                  </TableRow>
                ))
              : orders.map((order) => (
                  <TableRow
                    key={order.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/orders/${order.id}`)}
                  >
                    <TableCell className={`${TD} font-medium tabular-nums`}>
                      {order.orderNumber}
                    </TableCell>
                    <TableCell className={TD}>{order.client.name}</TableCell>
                    <TableCell className={TD}>
                      <OrderStatusBadge status={order.status} />
                    </TableCell>
                    <TableCell className={`${TD_RIGHT} tabular-nums`}>
                      {formatCurrency(order.value)}
                    </TableCell>
                    <TableCell className={`${TD_RIGHT} tabular-nums`}>
                      {formatDate(order.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const [summary, setSummary] = useState<OrdersSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getOrdersSummary()
      .then(setSummary)
      .catch((err: unknown) => {
        setError(
          err instanceof Error ? err.message : "Falha ao carregar o resumo",
        );
      });
  }, []);

  const isLoading = summary === null && error === null;

  const total =
    summary !== null
      ? summary.PENDING +
        summary.IN_PROGRESS +
        summary.AWAITING_CLIENT +
        summary.COMPLETED +
        summary.CANCELLED
      : 0;

  const stats: StatCardProps[] = summary
    ? [
        {
          title: "Total de ordens",
          value: total,
          description: "Desde o início",
          icon: ClipboardList,
          iconBg: "var(--velon-primary-soft)",
          iconFg: "var(--primary)",
        },
        {
          title: "Pendentes",
          value: summary.PENDING,
          description: "Aguardando início",
          icon: Clock,
          iconBg: "#faebd0",
          iconFg: "#c8870f",
        },
        {
          title: "Em andamento",
          value: summary.IN_PROGRESS,
          description: "Sendo executadas",
          icon: Wrench,
          iconBg: "#d7edf3",
          iconFg: "#0e8fa8",
        },
        {
          title: "Aguardando cliente",
          value: summary.AWAITING_CLIENT,
          description: "Esperando retorno do cliente",
          icon: HourglassIcon,
          iconBg: "#ebe3fa",
          iconFg: "#7c53d9",
        },
        {
          title: "Concluídas",
          value: summary.COMPLETED,
          description: "Desde o início",
          icon: CheckCircle2,
          iconBg: "#d4f0e4",
          iconFg: "#0e9f7c",
        },
        {
          title: "Canceladas",
          value: summary.CANCELLED,
          description: "Desde o início",
          icon: XCircle,
          iconBg: "#fadfdb",
          iconFg: "#d9503c",
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Painel"
        subtitle="Visão geral das ordens de serviço"
        actions={
          <Button asChild variant="default">
            <Link to="/orders">Ver todas as ordens</Link>
          </Button>
        }
      />

      <div className="space-y-6">
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {isLoading && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      )}

      {summary && total === 0 && (
        <EmptyState
          icon={ClipboardList}
          title="Nenhuma ordem de serviço ainda"
          description="Crie a primeira ordem para acompanhar o andamento por aqui."
          action={
            <Button asChild>
              <Link to="/orders">Ir para ordens</Link>
            </Button>
          }
        />
      )}

      {summary && total > 0 && (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {stats.map((stat) => (
              <StatCard key={stat.title} {...stat} />
            ))}
          </div>
          <RecentOrdersCard />
        </>
      )}
      </div>
    </div>
  );
}
