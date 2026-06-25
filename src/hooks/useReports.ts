import { useCallback, useEffect, useState } from "react";
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

export function useMissing() {
  const [missing, setMissing] = useState<MissingPerson[]>([]);

  const refetch = useCallback(async () => {
    const { data } = await supabase
      .from("missing_persons")
      .select("*")
      .order("report_date", { ascending: false });
    if (data) setMissing(data as unknown as MissingPerson[]);
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase
      .from("missing_persons")
      .select("*")
      .order("report_date", { ascending: false })
      .then(({ data }) => {
        if (mounted && data) setMissing(data as unknown as MissingPerson[]);
      });
    const ch = supabase
      .channel(`missing-rt-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "missing_persons" }, (payload) => {
        setMissing((prev) => {
          if (payload.eventType === "INSERT") return [payload.new as MissingPerson, ...prev];
          if (payload.eventType === "UPDATE")
            return prev.map((r) => (r.id === (payload.new as MissingPerson).id ? (payload.new as MissingPerson) : r));
          if (payload.eventType === "DELETE")
            return prev.filter((r) => r.id !== (payload.old as MissingPerson).id);
          return prev;
        });
      })
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, []);
  return { missing, refetch };
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
