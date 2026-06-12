import { useEffect, useRef, useState, type Ref } from "react";
import { searchClients, type ClientSearchResult } from "@/api/clients";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ClientComboboxProps {
  value: number | null;
  onChange: (clientId: number | null) => void;
  placeholder?: string;
  id?: string;
  ref?: Ref<HTMLInputElement>;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

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
  const [results, setResults] = useState<ClientSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open || query.length < 3) return;
    let cancelled = false;
    const t = setTimeout(() => {
      setLoading(true);
      searchClients(query)
        .then((data) => {
          if (!cancelled) {
            setResults(data.slice(0, 5));
            setLoading(false);
          }
        })
        .catch(() => {
          if (!cancelled) setLoading(false);
        });
    }, 300);
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

  function selectClient(client: ClientSearchResult) {
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
        placeholder={placeholder ?? "Buscar cliente por nome ou documento…"}
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
      {open && query.length >= 1 && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover shadow-md">
          {query.length < 3 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              Digite ao menos 3 caracteres para buscar.
            </div>
          ) : loading ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              Buscando…
            </div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              Nenhum cliente encontrado.
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
