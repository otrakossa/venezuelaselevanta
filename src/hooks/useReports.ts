import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Report, MissingPerson } from "@/lib/types";

export function useReports(opts: { includeHidden?: boolean } = {}) {
  const includeHidden = opts.includeHidden ?? false;
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const { data } = await supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) {
      const rows = data as unknown as Report[];
      setReports(includeHidden ? rows : rows.filter((r) => !r.hidden));
    }
    setLoading(false);
  }, [includeHidden]);

  useEffect(() => {
    let mounted = true;
    supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (mounted && data) {
          const rows = data as unknown as Report[];
          setReports(includeHidden ? rows : rows.filter((r) => !r.hidden));
        }
        setLoading(false);
      });

    const ch = supabase
      .channel(`reports-rt-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "reports" }, (payload) => {
        setReports((prev) => {
          if (payload.eventType === "INSERT") return [payload.new as Report, ...prev];
          if (payload.eventType === "UPDATE")
            return prev.map((r) => (r.id === (payload.new as Report).id ? (payload.new as Report) : r));
          if (payload.eventType === "DELETE")
            return prev.filter((r) => r.id !== (payload.old as Report).id);
          return prev;
        });
      })
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, [includeHidden]);

  return { reports, loading, refetch };
}

export type MissingCounts = { all: number; missing: number; found: number; deceased: number };

const MISSING_PAGE = 300;

export function useMissing() {
  const [records, setRecords] = useState<MissingPerson[]>([]);
  const [counts, setCounts] = useState<MissingCounts>({ all: 0, missing: 0, found: 0, deceased: 0 });
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const refetchCounts = useCallback(async () => {
    const [all, m, f, d] = await Promise.all([
      supabase.from("missing_persons").select("id", { count: "exact", head: true }),
      supabase.from("missing_persons").select("id", { count: "exact", head: true }).eq("status", "missing"),
      supabase.from("missing_persons").select("id", { count: "exact", head: true }).eq("status", "found"),
      supabase.from("missing_persons").select("id", { count: "exact", head: true }).eq("status", "deceased"),
    ]);
    setCounts({
      all: all.count ?? 0,
      missing: m.count ?? 0,
      found: f.count ?? 0,
      deceased: d.count ?? 0,
    });
  }, []);

  const fetchPage = useCallback(async (pageOffset: number, append: boolean) => {
    const { MISSING_PUBLIC_COLUMNS } = await import("@/lib/missing-columns");
    const { data } = await supabase
      .from("missing_persons")
      .select(MISSING_PUBLIC_COLUMNS)
      .order("report_date", { ascending: false })
      .range(pageOffset, pageOffset + MISSING_PAGE - 1);

    if (!data) return;
    const items = data as unknown as MissingPerson[];
    if (append) {
      setRecords((prev) => [...prev, ...items]);
    } else {
      setRecords(items);
    }
    setHasMore(data.length === MISSING_PAGE);
    setOffset(pageOffset + data.length);
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      await fetchPage(offset, true);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, offset, fetchPage]);

  const refetch = useCallback(async () => {
    setOffset(0);
    setHasMore(true);
    await fetchPage(0, false);
    await refetchCounts();
  }, [fetchPage, refetchCounts]);

  useEffect(() => {
    let mounted = true;
    fetchPage(0, false).then(() => { if (!mounted) return; });
    refetchCounts();
    const ch = supabase
      .channel(`missing-rt-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "missing_persons" }, (payload) => {
        setRecords((prev) => {
          if (payload.eventType === "INSERT") return [payload.new as MissingPerson, ...prev];
          if (payload.eventType === "UPDATE")
            return prev.map((r) => (r.id === (payload.new as MissingPerson).id ? (payload.new as MissingPerson) : r));
          if (payload.eventType === "DELETE")
            return prev.filter((r) => r.id !== (payload.old as MissingPerson).id);
          return prev;
        });
        refetchCounts();
      })
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, [fetchPage, refetchCounts]);

  return { missing: records, counts, refetch, loadMore, hasMore, loadingMore };
}


export function useAuth() {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  return { userId, isAuthenticated: !!userId };
}
