import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, MoreHorizontal, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import {
  getClients,
  deleteClient,
  searchClients,
  type Client,
  type ClientSearchResult,
  type ClientType,
  type PaginatedClients,
} from "@/api/clients";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { ClientForm } from "@/components/clients/ClientForm";
import { ClientTypeBadge } from "@/components/clients/ClientTypeBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

export function ClientsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canWrite = user?.role !== "VIEWER";

  const [typeFilter, setTypeFilter] = useState<ClientType | "">("");
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Client | undefined>(undefined);
  const [searchResults, setSearchResults] = useState<ClientSearchResult[]>([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  const {
    data,
    loading,
    error,
    searchInput,
    setSearchInput,
    changePage,
    refresh,
  } = usePaginatedList<PaginatedClients, { clientType?: ClientType }>(
    getClients,
    { clientType: typeFilter || undefined },
  );

  useEffect(() => {
    if (searchInput.trim().length < 3) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const results = await searchClients(searchInput.trim());
        if (!cancelled) {
          setSearchResults(results);
          setShowSearchDropdown(results.length > 0);
        }
      } catch {
        if (!cancelled) setSearchResults([]);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [searchInput]);

  function handleSearchResultClick(clientId: number) {
    setShowSearchDropdown(false);
    setFormOpen(false);
    navigate(`/clients/${clientId}`);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteClient(deleteTarget.id);
      toast.success("Cliente excluído com sucesso");
      setDeleteTarget(null);
      refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Falha ao excluir o cliente",
      );
    } finally {
      setDeleting(false);
    }
  }

  function openCreate() {
    setEditTarget(undefined);
    setFormOpen(true);
  }

  const pagination = data?.pagination;
  const total = pagination?.total ?? 0;
  const hasFilters = searchInput.trim() !== "" || typeFilter !== "";
  const isEmpty = !loading && data !== null && data.clients.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie os clientes do seu negócio
          </p>
        </div>
        {canWrite && (
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Novo cliente
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou documento…"
            className="pl-9"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onFocus={() => {
              if (searchResults.length > 0) setShowSearchDropdown(true);
            }}
            onBlur={() => setTimeout(() => setShowSearchDropdown(false), 150)}
            aria-label="Buscar clientes"
          />
          {showSearchDropdown && searchResults.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md">
              {searchResults.map((client) => (
                <li
                  key={client.id}
                  className="cursor-pointer px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                  onMouseDown={() => handleSearchResultClick(client.id)}
                >
                  <span className="font-medium">{client.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {client.document}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Select
          value={typeFilter || "all"}
          onValueChange={(v) =>
            setTypeFilter(v === "all" ? "" : (v as ClientType))
          }
        >
          <SelectTrigger className="w-full sm:w-40" aria-label="Filtrar por tipo">
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
          icon={Users}
          title={
            hasFilters
              ? "Nenhum cliente encontrado"
              : "Nenhum cliente cadastrado"
          }
          description={
            hasFilters
              ? "Ajuste a busca ou o filtro para ver outros resultados."
              : "Cadastre o primeiro cliente para começar."
          }
          action={
            hasFilters || !canWrite ? undefined : (
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Novo cliente
              </Button>
            )
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-md border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="w-16 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-16 rounded-full" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="ml-auto h-8 w-8" />
                      </TableCell>
                    </TableRow>
                  ))
                : data?.clients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">
                        <Link
                          to={`/clients/${client.id}`}
                          className="underline-offset-2 transition-colors hover:text-primary hover:underline"
                        >
                          {client.name}
                        </Link>
                      </TableCell>
                      <TableCell>{client.document}</TableCell>
                      <TableCell>{client.phone ?? "—"}</TableCell>
                      <TableCell>
                        <ClientTypeBadge type={client.clientType} />
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="min-h-11 min-w-11"
                              aria-label={`Ações para ${client.name}`}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => navigate(`/clients/${client.id}`)}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              Ver detalhes
                            </DropdownMenuItem>
                            {canWrite && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setEditTarget(client);
                                    setFormOpen(true);
                                  }}
                                >
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setDeleteTarget(client)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Excluir
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
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
            {total} {total === 1 ? "cliente" : "clientes"}
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

      <ClientForm
        open={formOpen}
        onOpenChange={setFormOpen}
        client={editTarget}
        onSuccess={refresh}
      />

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir cliente</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir{" "}
              <strong>{deleteTarget?.name}</strong>? Esta ação não pode ser
              desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Excluindo…" : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
