import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { searchPartners, createPartner, type PartnerFull } from "@/api/partners";
import { ApiError } from "@/api/client";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const MIN_CHARS = 2;
const DEBOUNCE_MS = 300;

interface PartnerComboboxProps {
  /** Selected partner id (form value), or undefined when none chosen. */
  value: number | undefined;
  onChange: (id: number | undefined) => void;
  /** Current partner name to display on first render (edit mode). */
  initialLabel?: string;
  /** Extra classes for the input (e.g. compact sizing in the inline form). */
  inputClassName?: string;
}

// Autocomplete over the company's partners. Searches with debounce (min 2
// chars), lets the user pick an existing partner, and offers an inline
// "Criar parceiro" option when the typed name has no exact match. Stores the
// chosen partner's id via onChange; typing clears the selection until re-picked.
export function PartnerCombobox({
  value,
  onChange,
  initialLabel,
  inputClassName,
}: PartnerComboboxProps) {
  const [inputValue, setInputValue] = useState(initialLabel ?? "");
  const [results, setResults] = useState<PartnerFull[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  // Resync the displayed name when the host swaps in a different partner (e.g.
  // the edit dialog reopens for another client). React's render-phase reset
  // pattern — no effect, so the field updates before paint.
  const [prevLabel, setPrevLabel] = useState(initialLabel);
  if (initialLabel !== prevLabel) {
    setPrevLabel(initialLabel);
    setInputValue(initialLabel ?? "");
  }

  useEffect(() => {
    const q = inputValue.trim();
    // Below the threshold the dropdown is hidden (see showDropdown), so stale
    // results never render — no need to clear state synchronously here.
    if (q.length < MIN_CHARS) return;
    const t = setTimeout(() => {
      setLoading(true);
      searchPartners(q)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [inputValue]);

  const query = inputValue.trim();
  const hasExactMatch = results.some(
    (p) => p.name.toLowerCase() === query.toLowerCase(),
  );
  const canCreate = query.length >= MIN_CHARS && !hasExactMatch && !loading;

  function select(partner: PartnerFull) {
    setInputValue(partner.name);
    setResults([]);
    setOpen(false);
    onChange(partner.id);
  }

  async function handleCreate() {
    if (query.length < MIN_CHARS) return;
    setCreating(true);
    try {
      const created = await createPartner(query);
      select(created);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Falha ao criar parceiro";
      toast.error(message);
    } finally {
      setCreating(false);
    }
  }

  const showDropdown = open && query.length >= MIN_CHARS;

  return (
    <div className="relative">
      <Input
        value={inputValue}
        placeholder="Buscar parceiro…"
        className={inputClassName}
        onChange={(e) => {
          setInputValue(e.target.value);
          // Typing invalidates a previous selection until the user re-picks.
          if (value !== undefined) onChange(undefined);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {showDropdown && (
        <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md">
          {results.map((partner) => (
            <li
              key={partner.id}
              className="cursor-pointer px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
              onMouseDown={(e) => {
                e.preventDefault();
                select(partner);
              }}
            >
              {partner.name}
            </li>
          ))}
          {loading && results.length === 0 && (
            <li className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Buscando…
            </li>
          )}
          {!loading && results.length === 0 && !canCreate && (
            <li className="px-3 py-2 text-sm text-muted-foreground">
              Nenhum parceiro encontrado
            </li>
          )}
          {canCreate && (
            <li
              className={cn(
                "flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground",
                results.length > 0 && "border-t",
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                void handleCreate();
              }}
            >
              {creating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Criar parceiro “{query}”
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
