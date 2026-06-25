import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Report, ReportComment } from "@/lib/types";

export function useReportDetail(id: string | null) {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) {
      setReport(null);
      setNotFound(false);
      return;
    }
    let mounted = true;
    setLoading(true);
    setNotFound(false);
    supabase
      .from("reports")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        if (!mounted) return;
        if (!data) setNotFound(true);
        else setReport(data as unknown as Report);
        setLoading(false);
      });

    const ch = supabase
      .channel(`report-detail-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "reports", filter: `id=eq.${id}` },
        (payload) => {
          setReport(payload.new as unknown as Report);
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, [id]);

  return { report, loading, notFound };
}

const COMMENTS_LIMIT = 20;

export function useReportComments(reportId: string | null) {
  const [comments, setComments] = useState<ReportComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!reportId) {
      setComments([]);
      setHasMore(false);
      return;
    }
    let mounted = true;
    setLoading(true);
    setHasMore(false);
    supabase
      .from("report_comments")
      .select("*")
      .eq("report_id", reportId)
      .order("created_at", { ascending: true })
      .limit(COMMENTS_LIMIT + 1)
      .then(({ data }) => {
        if (!mounted) return;
        if (data) {
          const rows = data as unknown as ReportComment[];
          if (rows.length > COMMENTS_LIMIT) {
            setComments(rows.slice(0, COMMENTS_LIMIT));
            setHasMore(true);
          } else {
            setComments(rows);
            setHasMore(false);
          }
        }
        setLoading(false);
      });

    const ch = supabase
      .channel(`report-comments-${reportId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "report_comments", filter: `report_id=eq.${reportId}` },
        (payload) => {
          setComments((prev) => {
            const next = payload.new as unknown as ReportComment;
            if (prev.some((c) => c.id === next.id)) return prev;
            return [...prev, next];
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "report_comments", filter: `report_id=eq.${reportId}` },
        (payload) => {
          setComments((prev) => prev.filter((c) => c.id !== (payload.old as ReportComment).id));
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, [reportId]);

  const loadMore = async () => {
    if (!reportId || loadingMore) return;
    setLoadingMore(true);
    const { data } = await supabase
      .from("report_comments")
      .select("*")
      .eq("report_id", reportId)
      .order("created_at", { ascending: true });
    if (data) {
      setComments(data as unknown as ReportComment[]);
      setHasMore(false);
    }
    setLoadingMore(false);
  };

  return { comments, loading, hasMore, loadMore, loadingMore };
}

