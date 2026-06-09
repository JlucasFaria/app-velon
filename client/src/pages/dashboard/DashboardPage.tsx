import { useEffect, useState } from "react";
import type { ElementType } from "react";
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

interface StatCardProps {
  title: string;
  value: number | null;
  description: string;
  icon: ElementType;
}

function StatCard({ title, value, description, icon: Icon }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value !== null ? value : "—"}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
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
        setError(err instanceof Error ? err.message : "Failed to load summary");
      });
  }, []);

  const total =
    summary !== null
      ? summary.PENDING +
        summary.IN_PROGRESS +
        summary.AWAITING_CLIENT +
        summary.COMPLETED +
        summary.CANCELLED
      : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Overview of all service orders
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Total Orders"
          value={total}
          description="All time"
          icon={ClipboardList}
        />
        <StatCard
          title="Pending"
          value={summary?.PENDING ?? null}
          description="Awaiting start"
          icon={Clock}
        />
        <StatCard
          title="In Progress"
          value={summary?.IN_PROGRESS ?? null}
          description="Currently being worked on"
          icon={Wrench}
        />
        <StatCard
          title="Awaiting Client"
          value={summary?.AWAITING_CLIENT ?? null}
          description="Waiting for client response"
          icon={HourglassIcon}
        />
        <StatCard
          title="Completed"
          value={summary?.COMPLETED ?? null}
          description="All time"
          icon={CheckCircle2}
        />
        <StatCard
          title="Cancelled"
          value={summary?.CANCELLED ?? null}
          description="All time"
          icon={XCircle}
        />
      </div>
    </div>
  );
}
