import { useEffect, useState } from "react";
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {total !== null ? total : "—"}
            </div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary !== null ? summary.PENDING : "—"}
            </div>
            <p className="text-xs text-muted-foreground">Awaiting start</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary !== null ? summary.IN_PROGRESS : "—"}
            </div>
            <p className="text-xs text-muted-foreground">
              Currently being worked on
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary !== null ? summary.COMPLETED : "—"}
            </div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Awaiting Client
            </CardTitle>
            <HourglassIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary !== null ? summary.AWAITING_CLIENT : "—"}
            </div>
            <p className="text-xs text-muted-foreground">
              Waiting for client response
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cancelled</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary !== null ? summary.CANCELLED : "—"}
            </div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
