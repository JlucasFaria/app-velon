import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FileText, Pencil, Plus, Trash2 } from "lucide-react";
import {
  getTemplates,
  deleteTemplate,
  type ServiceTemplate,
} from "@/api/templates";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { TemplateForm } from "./TemplateForm";

export function TemplatesSection() {
  const { user } = useAuth();
  const canWrite = user?.role !== "VIEWER";

  const [templates, setTemplates] = useState<ServiceTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceTemplate | null>(null);

  const [deleting, setDeleting] = useState<ServiceTemplate | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getTemplates()
      .then((list) => {
        if (!cancelled) {
          setTemplates(list);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          toast.error(
            err instanceof Error ? err.message : "Falha ao carregar modelos",
          );
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(template: ServiceTemplate) {
    setEditing(template);
    setFormOpen(true);
  }

  // Upsert the saved template into the local list (sorted by name, as the API).
  function handleSaved(saved: ServiceTemplate) {
    setTemplates((prev) => {
      const next = prev.some((t) => t.id === saved.id)
        ? prev.map((t) => (t.id === saved.id ? saved : t))
        : [...prev, saved];
      return next.sort((a, b) => a.name.localeCompare(b.name));
    });
  }

  async function handleDelete() {
    if (!deleting) return;
    setRemoving(true);
    try {
      await deleteTemplate(deleting.id);
      setTemplates((prev) => prev.filter((t) => t.id !== deleting.id));
      toast.success("Modelo excluído");
      setDeleting(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao excluir modelo");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <Card className="shadow-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Modelos de serviço</CardTitle>
        {canWrite && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Novo modelo
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : templates.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Nenhum modelo cadastrado"
            description="Crie modelos para pré-preencher a descrição e os itens das ordens de serviço."
            action={
              canWrite ? (
                <Button size="sm" onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  Novo modelo
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="divide-y">
            {templates.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {t.defaultDescription}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t.items.length}{" "}
                    {t.items.length === 1 ? "item" : "itens"}
                  </p>
                </div>
                {canWrite && (
                  <div className="ml-4 flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(t)}
                      aria-label="Editar modelo"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleting(t)}
                      aria-label="Excluir modelo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Create / edit dialog */}
      <TemplateForm
        open={formOpen}
        onOpenChange={setFormOpen}
        template={editing}
        onSaved={handleSaved}
      />

      {/* Delete confirmation */}
      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir modelo</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o modelo
              {deleting ? ` "${deleting.name}"` : ""}? Esta ação não pode ser
              desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={removing}
            >
              {removing ? "Excluindo…" : "Excluir"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
