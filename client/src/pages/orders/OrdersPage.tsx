import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, Plus, Search } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function OrdersPage() {
  const navigate = useNavigate();

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Orders</h1>
          <p className="text-sm text-muted-foreground">
            Manage your service orders
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Order
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by order number or client…"
            className="pl-9"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <Select
          value={statusFilter || "all"}
          onValueChange={(v) =>
            setStatusFilter(v === "all" ? "" : (v as OrderStatus))
          }
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
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
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
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

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order #</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-16">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-muted-foreground"
                >
                  Loading…
                </TableCell>
              </TableRow>
            ) : data?.orders.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-muted-foreground"
                >
                  No orders found.
                </TableCell>
              </TableRow>
            ) : (
              data?.orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">
                    {order.orderNumber}
                  </TableCell>
                  <TableCell>{order.client.name}</TableCell>
                  <TableCell>
                    <OrderStatusBadge status={order.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(order.value)}
                  </TableCell>
                  <TableCell>{formatDate(order.createdAt)}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => navigate(`/orders/${order.id}`)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {data && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {pagination?.total ?? 0} order
            {pagination?.total !== 1 ? "s" : ""}
          </span>
          {pagination && pagination.totalPages > 1 && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!pagination.hasPrev}
                onClick={() => changePage(-1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!pagination.hasNext}
                onClick={() => changePage(1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}

      <OrderForm open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
