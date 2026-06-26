import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns flags for the current user's role.
 * - isMod: admin OR moderator (used to gate cross-linking confirmations).
 */
export function useUserRole() {
  const [userId, setUserId] = useState<string | null>(null);
  const [isMod, setIsMod] = useState(false);

  useEffect(() => {
    let active = true;

    const check = async (uid: string | null) => {
      if (!uid) {
        if (active) setIsMod(false);
        return;
      }
      const [{ data: a }, { data: m }] = await Promise.all([
        supabase.rpc("has_role", { _user_id: uid, _role: "admin" }),
        supabase.rpc("has_role", { _user_id: uid, _role: "moderator" }),
      ]);
      if (active) setIsMod(Boolean(a) || Boolean(m));
    };

    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user.id ?? null;
      setUserId(uid);
      check(uid);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const uid = session?.user.id ?? null;
      setUserId(uid);
      check(uid);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { userId, isMod, isAuthenticated: !!userId };
}
