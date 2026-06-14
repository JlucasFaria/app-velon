import { useEffect, useState } from "react";
import { searchPartners } from "@/api/partners";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PartnerNameFilterProps {
  /** Current partner name; empty string means "all". */
  value: string;
  onChange: (partnerName: string) => void;
  className?: string;
}

// Filters a list by the client's partner name. Partners are a small, distinct
// set per company, so a Select populated from the Partner endpoint is simpler
// and more accessible than a free-text combobox. The filter value stays the
// partner name (the list APIs filter by name). Renders nothing when the company
// has no partners yet.
export function PartnerNameFilter({
  value,
  onChange,
  className,
}: PartnerNameFilterProps) {
  const [names, setNames] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    searchPartners()
      .then((partners) => {
        if (!cancelled) setNames(partners.map((p) => p.name));
      })
      .catch(() => {
        if (!cancelled) setNames([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (names.length === 0) return null;

  return (
    <Select
      value={value || "all"}
      onValueChange={(v) => onChange(v === "all" ? "" : v)}
    >
      <SelectTrigger
        className={className ?? "w-full sm:w-48"}
        aria-label="Filtrar por parceiro"
      >
        <SelectValue placeholder="Todos os parceiros" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todos os parceiros</SelectItem>
        {names.map((name) => (
          <SelectItem key={name} value={name}>
            {name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
