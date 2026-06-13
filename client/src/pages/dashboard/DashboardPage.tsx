import { useEffect, useState } from "react";
import type { ElementType } from "react";
import { Link } from "react-router-dom";
import {
  ClipboardList,
  Clock,
  Wrench,
  CheckCircle2,
  XCircle,
  HourglassIcon,
} from "lucide-react";
import { getOrdersSummary, type OrdersSummary } from "@/api/reports";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: number;
  description: string;
  icon: ElementType;
  iconAccent: string;
  stripColor: string;
  gradientOverlay: string;
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  iconAccent,
  stripColor,
  gradientOverlay,
}: StatCardProps) {
  return (
    <Card className="relative overflow-hidden shadow-card transition-shadow hover:shadow-elevated">
      {/* Subtle gradient overlay — light mode only */}
      <div className={cn("pointer-events-none absolute inset-0 dark:hidden", gradientOverlay)} />
      {/* Left accent strip */}
      <div className={cn("absolute inset-y-0 left-0 w-[3px]", stripColor)} />
      <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2 pl-5">
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
          {title}
        </CardTitle>
        <span className={cn("flex size-9 items-center justify-center rounded-xl", iconAccent)}>
          <Icon className="h-5 w-5 shrink-0" />
        </span>
      </CardHeader>
      <CardContent className="relative pl-5">
        <div className="text-3xl font-bold tracking-tight">{value}</div>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function StatCardSkeleton() {
  return (
    <Card className="shadow-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="size-9 rounded-xl" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-12" />
        <Skeleton className="mt-2 h-3 w-20" />
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
          iconAccent: "bg-indigo-50 text-indigo-600",
          stripColor: "bg-indigo-500",
          gradientOverlay: "bg-gradient-to-br from-white to-indigo-50/70",
        },
        {
          title: "Pendentes",
          value: summary.PENDING,
          description: "Aguardando início",
          icon: Clock,
          iconAccent: "bg-slate-100 text-slate-500",
          stripColor: "bg-slate-400",
          gradientOverlay: "bg-gradient-to-br from-white to-slate-50/80",
        },
        {
          title: "Em andamento",
          value: summary.IN_PROGRESS,
          description: "Sendo executadas",
          icon: Wrench,
          iconAccent: "bg-blue-50 text-blue-600",
          stripColor: "bg-blue-500",
          gradientOverlay: "bg-gradient-to-br from-white to-blue-50/70",
        },
        {
          title: "Aguardando cliente",
          value: summary.AWAITING_CLIENT,
          description: "Esperando retorno do cliente",
          icon: HourglassIcon,
          iconAccent: "bg-amber-50 text-amber-600",
          stripColor: "bg-amber-400",
          gradientOverlay: "bg-gradient-to-br from-white to-amber-50/70",
        },
        {
          title: "Concluídas",
          value: summary.COMPLETED,
          description: "Desde o início",
          icon: CheckCircle2,
          iconAccent: "bg-emerald-50 text-emerald-600",
          stripColor: "bg-emerald-500",
          gradientOverlay: "bg-gradient-to-br from-white to-emerald-50/70",
        },
        {
          title: "Canceladas",
          value: summary.CANCELLED,
          description: "Desde o início",
          icon: XCircle,
          iconAccent: "bg-rose-50 text-rose-600",
          stripColor: "bg-rose-500",
          gradientOverlay: "bg-gradient-to-br from-white to-rose-50/70",
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Painel</h1>
          <p className="text-sm text-muted-foreground">
            Visão geral das ordens de serviço
          </p>
        </div>
        <Button asChild variant="default" size="sm">
          <Link to="/orders">Ver todas as ordens</Link>
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((stat) => (
            <StatCard key={stat.title} {...stat} />
          ))}
        </div>
      )}
    </div>
  );
}
