"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "./supabase/client";
import { fetchRemoteState, importGuestState, pushRemoteState } from "./remote-store";
import type { State } from "./types";

export type SyncStatus = "guest" | "loading" | "synced" | "error";

const PUSH_DEBOUNCE_MS = 900;

/**
 * Keeps the in-memory State mirrored to Supabase while somebody is signed in.
 *
 * On the first sign-in with an empty account the local guest build is copied up,
 * so signing in never looks like losing your work.
 */
export function useCloudSync(state: State, ready: boolean, adopt: (next: State) => void) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<SyncStatus>("guest");

  const hydratedFor = useRef<string | null>(null);
  // Lets the hydration effect read the newest state without re-running on every edit.
  const latest = useRef(state);
  useEffect(() => { latest.current = state; }, [state]);

  // Track who is signed in.
  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    supabase.auth.getUser().then(({ data }) => { if (alive) setUserId(data.user?.id ?? null); });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => setUserId(session?.user?.id ?? null));
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [supabase]);

  // Pull the account's data once per signed-in user, importing guest data if the account is empty.
  useEffect(() => {
    if (!supabase || !ready) return;
    if (!userId) { hydratedFor.current = null; queueMicrotask(() => setStatus("guest")); return; }
    if (hydratedFor.current === userId) return;
    hydratedFor.current = userId;

    let alive = true;
    setStatus("loading");
    (async () => {
      try {
        let remote = await fetchRemoteState(supabase, userId);
        if (!remote) {
          await importGuestState(supabase, userId, latest.current);
          remote = await fetchRemoteState(supabase, userId);
        }
        if (!alive) return;
        if (remote) adopt(remote);
        setStatus("synced");
      } catch {
        if (alive) { hydratedFor.current = null; setStatus("error"); }
      }
    })();
    return () => { alive = false; };
  }, [supabase, ready, userId, adopt]);

  // Mirror later edits up, debounced so typing in a form is not one write per keystroke.
  useEffect(() => {
    if (!supabase || !userId || status !== "synced") return;
    const timer = setTimeout(() => { pushRemoteState(supabase, userId, latest.current).catch(() => setStatus("error")); }, PUSH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [supabase, userId, status, state]);

  const retry = useCallback(() => { hydratedFor.current = null; setStatus(userId ? "loading" : "guest"); }, [userId]);

  return { userId, status, retry };
}
