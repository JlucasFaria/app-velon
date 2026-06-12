import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ClipboardList, Eye, Plus, Search } from "lucide-react";
import {
  getOrders,
  type OrderStatus,
  type PaginatedOrders,
} from "@/api/orders";
import type { ClientType } from "@/api/clients";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { OrderForm } from "@/components/orders/OrderForm";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { ORDER_STATUSES, ORDER_STATUS_LABELS } from "@/lib/order-status";
import { formatCurrency, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/auth-context";

export function OrdersPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canWrite = user?.role !== "VIEWER";

  const [statusFilter, setStatusFilter] = useState<OrderStatus | "">("");
  const [typeFilter, setTypeFilter] = useState<ClientType | "">("");
  const [formOpen, setFormOpen] = useState(false);

  const { data, loading, error, searchInput, setSearchInput, changePage } =
    usePaginatedList<
      PaginatedOrders,
      { status?: OrderStatus; clientType?: ClientType }
    >(getOrders, {
      status: statusFilter || undefined,
      clientType: typeFilter || undefined,
    });

  const pagination = data?.pagination;
  const total = pagination?.total ?? 0;
  const hasFilters =
    searchInput.trim() !== "" || statusFilter !== "" || typeFilter !== "";
  const isEmpty = !loading && data !== null && data.orders.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Ordens de serviço
          </h1>
          <p className="text-sm text-muted-foreground">
            Gerencie as ordens de serviço do seu negócio
          </p>
        </div>
        {canWrite && (
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova ordem
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por número ou cliente…"
            className="pl-9"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Buscar ordens"
          />
        </div>
        <Select
          value={statusFilter || "all"}
          onValueChange={(v) =>
            setStatusFilter(v === "all" ? "" : (v as OrderStatus))
          }
        >
          <SelectTrigger
            className="w-full sm:w-44"
            aria-label="Filtrar por status"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {ORDER_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {ORDER_STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={typeFilter || "all"}
          onValueChange={(v) =>
            setTypeFilter(v === "all" ? "" : (v as ClientType))
          }
        >
          <SelectTrigger
            className="w-full sm:w-40"
            aria-label="Filtrar por tipo de cliente"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="COUNTER">Balcão</SelectItem>
            <SelectItem value="PARTNER">Parceiro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {isEmpty ? (
        <EmptyState
          icon={ClipboardList}
          title={
            hasFilters
              ? "Nenhuma ordem encontrada"
              : "Nenhuma ordem de serviço"
          }
          description={
            hasFilters
              ? "Ajuste a busca ou os filtros para ver outros resultados."
              : "Crie a primeira ordem de serviço para começar."
          }
          action={
            hasFilters || !canWrite ? undefined : (
              <Button onClick={() => setFormOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Nova ordem
              </Button>
            )
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-md border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ordem</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Criada em</TableHead>
                <TableHead className="w-16 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-24 rounded-full" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="ml-auto h-4 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="ml-auto h-8 w-8" />
                      </TableCell>
                    </TableRow>
                  ))
                : data?.orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">
                        <Link
                          to={`/orders/${order.id}`}
                          className="hover:underline"
                        >
                          {order.orderNumber}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link
                          to={`/clients/${order.client.id}`}
                          className="hover:underline"
                        >
                          {order.client.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <OrderStatusBadge status={order.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(order.value)}
                      </TableCell>
                      <TableCell>{formatDate(order.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="min-h-11 min-w-11"
                          aria-label={`Ver ordem ${order.orderNumber}`}
                          onClick={() => navigate(`/orders/${order.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </div>
      )}

      {data && !isEmpty && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {total} {total === 1 ? "ordem" : "ordens"}
          </span>
          {pagination && pagination.totalPages > 1 && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!pagination.hasPrev}
                onClick={() => changePage(-1)}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!pagination.hasNext}
                onClick={() => changePage(1)}
              >
                Próxima
              </Button>
            </div>
          )}
        </div>
      )}

      <OrderForm open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
