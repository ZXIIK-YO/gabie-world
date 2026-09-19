"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Build, Item, Notice, State } from "./types";

/**
 * Bridges the guest-shaped `State` object the UI already uses and the relational
 * schema in Supabase. The UI keeps editing one plain object; this module
 * reconciles that object against the tables on a debounce.
 */

const GUEST_IMPORT_KEY = "gabie-world:import-key";

type BuildRow = { id: string; name: string; description: string; budget: string | number; created_at: string };
type ItemRow = { id: string; build_id: string; category: string; name: string; status: string; priority: string; planned_price: string | number; paid_price: string | number; target_price: string | number | null; owned: boolean; favorite: boolean };
type NoticeRow = { id: string; title: string; body: string; read_at: string | null; created_at: string };

const num = (value: string | number | null | undefined) => (value == null ? 0 : typeof value === "number" ? value : Number(value) || 0);

/**
 * Stable per-browser key so re-importing the same guest data is a no-op even if
 * the user signs in again from the same device (`builds.guest_import_key` is unique).
 */
function guestImportKey() {
  try {
    const existing = localStorage.getItem(GUEST_IMPORT_KEY);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    localStorage.setItem(GUEST_IMPORT_KEY, fresh);
    return fresh;
  } catch {
    return crypto.randomUUID();
  }
}

export async function fetchRemoteState(supabase: SupabaseClient, userId: string): Promise<State | null> {
  const [builds, notices] = await Promise.all([
    supabase.from("builds").select("id,name,description,budget,created_at").eq("user_id", userId).order("created_at", { ascending: true }),
    supabase.from("notifications").select("id,title,body,read_at,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
  ]);
  if (builds.error) throw builds.error;

  const buildRows = (builds.data ?? []) as BuildRow[];
  const ids = buildRows.map((row) => row.id);
  let itemRows: ItemRow[] = [];
  if (ids.length > 0) {
    const items = await supabase.from("build_items").select("id,build_id,category,name,status,priority,planned_price,paid_price,target_price,owned,favorite").in("build_id", ids).order("created_at", { ascending: true });
    if (items.error) throw items.error;
    itemRows = (items.data ?? []) as ItemRow[];
  }

  const mapped: Build[] = buildRows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    budget: num(row.budget),
    createdAt: row.created_at,
    items: itemRows.filter((item) => item.build_id === row.id).map((item) => ({
      id: item.id,
      category: item.category,
      name: item.name,
      status: item.status,
      priority: item.priority,
      planned: num(item.planned_price),
      paid: num(item.paid_price),
      owned: item.owned,
      favorite: item.favorite,
      targetPrice: item.target_price == null ? undefined : num(item.target_price),
    })),
  }));

  if (mapped.length === 0) return null; // caller decides whether to import guest data

  return {
    builds: mapped,
    activeBuildId: mapped[0].id,
    notices: ((notices.data ?? []) as NoticeRow[]).map((row) => ({ id: row.id, title: row.title, body: row.body, read: row.read_at != null, createdAt: row.created_at })),
  };
}

const buildPayload = (build: Build, userId: string) => ({ id: build.id, user_id: userId, name: build.name, description: build.description, budget: build.budget });
const itemPayload = (item: Item, buildId: string) => ({ id: item.id, build_id: buildId, category: item.category, name: item.name, status: item.status, priority: item.priority, planned_price: item.planned, paid_price: item.paid, target_price: item.targetPrice ?? null, owned: item.owned, favorite: item.favorite });
const noticePayload = (notice: Notice, userId: string) => ({ id: notice.id, user_id: userId, kind: "app", title: notice.title, body: notice.body, read_at: notice.read ? new Date().toISOString() : null });

/**
 * Upserts everything the UI currently holds and deletes rows the user removed.
 * Deletes are scoped by user_id / build_id so RLS still guards every statement.
 */
export async function pushRemoteState(supabase: SupabaseClient, userId: string, state: State) {
  const builds = state.builds;
  if (builds.length > 0) {
    const { error } = await supabase.from("builds").upsert(builds.map((build) => buildPayload(build, userId)), { onConflict: "id" });
    if (error) throw error;
  }

  const keptBuilds = builds.map((build) => build.id);
  const staleBuilds = supabase.from("builds").delete().eq("user_id", userId);
  const { error: buildDeleteError } = keptBuilds.length > 0 ? await staleBuilds.not("id", "in", `(${keptBuilds.join(",")})`) : await staleBuilds;
  if (buildDeleteError) throw buildDeleteError;

  const items = builds.flatMap((build) => build.items.map((item) => itemPayload(item, build.id)));
  if (items.length > 0) {
    const { error } = await supabase.from("build_items").upsert(items, { onConflict: "id" });
    if (error) throw error;
  }
  if (keptBuilds.length > 0) {
    const keptItems = items.map((item) => item.id);
    const staleItems = supabase.from("build_items").delete().in("build_id", keptBuilds);
    const { error } = keptItems.length > 0 ? await staleItems.not("id", "in", `(${keptItems.join(",")})`) : await staleItems;
    if (error) throw error;
  }

  const notices = state.notices.slice(0, 50);
  if (notices.length > 0) {
    const { error } = await supabase.from("notifications").upsert(notices.map((notice) => noticePayload(notice, userId)), { onConflict: "id" });
    if (error) throw error;
  }
}

/**
 * One-shot copy of the guest build into a fresh account. Idempotent: the first
 * build carries `guest_import_key`, and the unique constraint makes a second
 * attempt from the same browser a no-op instead of a duplicate.
 */
export async function importGuestState(supabase: SupabaseClient, userId: string, guest: State) {
  const key = guestImportKey();
  const existing = await supabase.from("builds").select("id").eq("user_id", userId).eq("guest_import_key", key).maybeSingle();
  if (existing.data) return false;

  const [first, ...rest] = guest.builds;
  if (!first) return false;

  const { error } = await supabase.from("builds").insert({ ...buildPayload(first, userId), guest_import_key: key });
  // 23505 = unique violation: another tab already imported this browser's data.
  if (error) { if (error.code === "23505") return false; throw error; }

  if (rest.length > 0) {
    const { error: restError } = await supabase.from("builds").insert(rest.map((build) => buildPayload(build, userId)));
    if (restError) throw restError;
  }

  const items = guest.builds.flatMap((build) => build.items.map((item) => itemPayload(item, build.id)));
  if (items.length > 0) {
    const { error: itemsError } = await supabase.from("build_items").insert(items);
    if (itemsError) throw itemsError;
  }
  return true;
}
