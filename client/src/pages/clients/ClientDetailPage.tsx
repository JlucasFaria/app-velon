import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { getClient, type ClientDetail } from "@/api/clients";
import { ClientTypeBadge } from "@/components/clients/ClientTypeBadge";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { formatCurrency, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TH, TH_RIGHT, TD, TD_RIGHT, TABLE_WRAP } from "@/lib/table-classes";
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
        <ArrowLeft className="h-4 w-4" />
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BackButton />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {client.name}
          </h1>
          <p className="text-sm text-muted-foreground">{client.document}</p>
        </div>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Dados do cliente</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground">Telefone</p>
            <p className="font-medium">{client.phone ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Tipo</p>
            <p className="mt-1">
              <ClientTypeBadge type={client.clientType} />
            </p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-muted-foreground">Endereço</p>
            <p className="font-medium">{client.address ?? "—"}</p>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-4 text-lg font-semibold tracking-tight">
          Ordens de serviço ({client.orders.length})
        </h2>
        {client.orders.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Nenhuma ordem de serviço"
            description="Este cliente ainda não possui ordens de serviço."
          />
        ) : (
          <div className={TABLE_WRAP}>
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
                        className="text-primary hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                    </TableCell>
                    <TableCell className={TD}>{formatDate(order.createdAt)}</TableCell>
                    <TableCell className={TD}>
                      <OrderStatusBadge status={order.status} />
                    </TableCell>
                    <TableCell className={TD_RIGHT}>
                      {formatCurrency(order.value)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
