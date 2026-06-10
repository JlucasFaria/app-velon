import { useCallback, useEffect, useState } from "react";

type PaginationQuery = { search?: string; page: number; limit: number };

/**
 * Drives a server-paginated, searchable, filterable list. Owns the search box
 * (debounced), current page, loading/error and the fetch lifecycle; resets to
 * page 1 whenever the search term or filters change. `fetchPage` must be a
 * stable reference (e.g. a module-level API function) so the effect doesn't
 * refetch on every render. `filters` is serialized to detect changes.
 */
export function usePaginatedList<
  T,
  F extends Record<string, string | undefined>,
>(fetchPage: (params: PaginationQuery & F) => Promise<T>, filters: F, limit = 10) {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const filterKey = JSON.stringify(filters);
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);

  // Reset to the first page (and show loading) whenever the filters change,
  // adjusting state during render instead of in an effect.
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
    setLoading(true);
  }

  const refresh = useCallback(() => {
    setLoading(true);
    setRefreshKey((k) => k + 1);
  }, []);

  const changePage = useCallback((delta: number) => {
    setLoading(true);
    setPage((p) => p + delta);
  }, []);

  // Debounce the search box → committed search term. The guard skips the no-op
  // run on mount so loading isn't left stuck on true.
  useEffect(() => {
    if (searchInput === search) return;
    const t = setTimeout(() => {
      setLoading(true);
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput, search]);

  useEffect(() => {
    let cancelled = false;
    const activeFilters = JSON.parse(filterKey) as F;
    fetchPage({ search: search || undefined, page, limit, ...activeFilters })
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load data");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fetchPage, search, page, limit, filterKey, refreshKey]);

  return {
    data,
    loading,
    error,
    searchInput,
    setSearchInput,
    changePage,
    refresh,
  };
}
