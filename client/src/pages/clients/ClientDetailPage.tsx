import { useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { getClient, type ClientDetail } from "@/api/clients";
import { ClientTypeBadge } from "@/components/clients/ClientTypeBadge";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import {
  formatCurrency,
  formatDate,
  formatRegistrationNumber,
} from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InitialsAvatar } from "@/components/ui/initials-avatar";
import { TH, TH_RIGHT, TD, TD_RIGHT } from "@/lib/table-classes";
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

function BackButton() {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="min-h-11 min-w-11 shrink-0"
      aria-label="Voltar para clientes"
      asChild
    >
      <Link to="/clients">
        <ArrowLeft className="h-5 w-5" />
      </Link>
    </Button>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-11 w-11 rounded-md" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <Card className="shadow-card">
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-40" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getClient(Number(id))
      .then((data) => {
        setClient(data);
        setError(null);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(
          err instanceof Error ? err.message : "Falha ao carregar o cliente",
        );
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return <DetailSkeleton />;
  }

  if (error || !client) {
    return (
      <div className="space-y-4">
        <BackButton />
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error ?? "Cliente não encontrado."}
        </div>
      </div>
    );
  }

  const ordersTotal = client.orders.length;
  const billedCents = client.orders
    .filter((o) => o.status === "COMPLETED")
    .reduce((sum, o) => sum + Math.round(Number(o.value) * 100), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
        <div className="flex items-center gap-3">
          <InitialsAvatar
            name={client.name}
            size={48}
            variant={client.clientType === "PARTNER" ? "warm" : "primary"}
          />
          <div>
            <h1 className="text-[24px] font-extrabold leading-tight tracking-[-0.025em]">
              {client.name}
            </h1>
            <p className="text-sm tabular-nums text-muted-foreground">
              {client.document}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-[17px] font-bold tracking-[-0.01em]">
              Dados do cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            {client.registrationNumber != null && (
              <Field label="Nº de cadastro">
                <span className="font-semibold tabular-nums">
                  {formatRegistrationNumber(client.registrationNumber)}
                </span>
              </Field>
            )}
            <Field label="Telefone">
              <span className="font-semibold tabular-nums">
                {client.phone ?? "—"}
              </span>
            </Field>
            <Field label="Tipo">
              <ClientTypeBadge type={client.clientType} />
            </Field>
            {client.clientType === "PARTNER" && (
              <Field label="Parceiro">
                <span className="font-semibold">
                  {client.partner?.name ?? "—"}
                </span>
              </Field>
            )}
            <Field label="Endereço" full>
              <span className="font-semibold">{client.address ?? "—"}</span>
            </Field>
          </CardContent>
        </Card>

        <Card className="bg-muted/40 shadow-card">
          <CardContent className="pt-6">
            <span className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-muted-foreground/70">
              Resumo
            </span>
            <div className="mt-3 flex items-end gap-4">
              <div>
                <div className="text-[30px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">
                  {ordersTotal}
                </div>
                <div className="mt-2 text-[12.5px] text-muted-foreground/80">
                  Ordens totais
                </div>
              </div>
              <div className="ml-auto text-right">
                <div className="text-[30px] font-extrabold leading-none tracking-[-0.03em] tabular-nums text-[color:var(--velon-primary-text)]">
                  {formatCurrency(billedCents / 100)}
                </div>
                <div className="mt-2 text-[12.5px] text-muted-foreground/80">
                  Faturado
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-[17px] font-bold tracking-[-0.01em]">
            Ordens de serviço
          </CardTitle>
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
            {ordersTotal}
          </span>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          {client.orders.length === 0 ? (
            <div className="px-6 pb-4">
              <EmptyState
                icon={ClipboardList}
                title="Nenhuma ordem de serviço"
                description="Este cliente ainda não possui ordens de serviço."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={TH}>Ordem</TableHead>
                  <TableHead className={TH}>Data</TableHead>
                  <TableHead className={TH}>Status</TableHead>
                  <TableHead className={TH_RIGHT}>Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {client.orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className={`${TD} font-medium`}>
                      <Link
                        to={`/orders/${order.id}`}
                        className="text-[color:var(--velon-primary-text)] hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                    </TableCell>
                    <TableCell className={`${TD} tabular-nums`}>
                      {formatDate(order.createdAt)}
                    </TableCell>
                    <TableCell className={TD}>
                      <OrderStatusBadge status={order.status} />
                    </TableCell>
                    <TableCell className={`${TD_RIGHT} tabular-nums`}>
                      {formatCurrency(order.value)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={full ? "sm:col-span-2" : undefined}>
      <div className="mb-1.5 text-[11.5px] font-bold uppercase tracking-[0.09em] text-muted-foreground/70">
        {label}
      </div>
      <div className="text-sm">{children}</div>
    </div>
  );
}
