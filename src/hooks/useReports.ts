import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Report, MissingPerson } from "@/lib/types";

export function useReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (mounted && data) setReports(data as Report[]);
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
  }, []);

  return { reports, loading };
}

export function useMissing() {
  const [missing, setMissing] = useState<MissingPerson[]>([]);
  useEffect(() => {
    let mounted = true;
    supabase
      .from("missing_persons")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (mounted && data) setMissing(data as MissingPerson[]);
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
  return { missing };
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
