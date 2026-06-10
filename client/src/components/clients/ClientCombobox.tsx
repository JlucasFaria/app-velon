import { useEffect, useRef, useState, type Ref } from "react";
import { getClients, type Client } from "@/api/clients";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ClientComboboxProps {
  value: number | null;
  onChange: (clientId: number | null) => void;
  placeholder?: string;
  // Forwarded to the inner input so it can be wired by shadcn's FormControl
  // (id/aria-* for label + error association, ref for focus management).
  id?: string;
  ref?: Ref<HTMLInputElement>;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

/**
 * Searchable client picker backed by the server-side client search. Typing
 * re-queries the API (debounced); editing the text after a selection clears
 * the selected id so a stale id can never be submitted with mismatched text.
 */
export function ClientCombobox({
  value,
  onChange,
  placeholder,
  id,
  ref,
  "aria-describedby": ariaDescribedby,
  "aria-invalid": ariaInvalid,
}: ClientComboboxProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Client[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const t = setTimeout(() => {
      setLoading(true);
      getClients({ search: query || undefined, limit: 8 })
        .then((d) => {
          if (!cancelled) {
            setResults(d.clients);
            setLoading(false);
          }
        })
        .catch(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, open]);

  useEffect(() => {
    return () => {
      if (blurTimeout.current) clearTimeout(blurTimeout.current);
    };
  }, []);

  function selectClient(client: Client) {
    onChange(client.id);
    setQuery(client.name);
    setOpen(false);
  }

  return (
    <div className="relative">
      <Input
        ref={ref}
        id={id}
        aria-describedby={ariaDescribedby}
        aria-invalid={ariaInvalid}
        value={query}
        placeholder={placeholder ?? "Search client by name or document…"}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          blurTimeout.current = setTimeout(() => setOpen(false), 120);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (value !== null) onChange(null);
        }}
      />
      {open && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover shadow-md">
          {loading ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              Loading…
            </div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              No clients found.
            </div>
          ) : (
            results.map((client) => (
              <button
                key={client.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectClient(client);
                }}
                className={cn(
                  "flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-accent",
                  value === client.id && "bg-accent",
                )}
              >
                <span className="font-medium">{client.name}</span>
                <span className="text-xs text-muted-foreground">
                  {client.document}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
