import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useAdminRole(userId: string | null) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!userId) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .then(({ data }) => {
        const roles = (data ?? []).map((r: { role: string }) => r.role);
        setIsAdmin(roles.includes("admin") || roles.includes("moderator"));
        setLoading(false);
      });
  }, [userId]);
  return { isAdmin, loading };
}
