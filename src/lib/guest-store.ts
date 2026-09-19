"use client";
import { initialState, type State } from "./types";

const KEY = "gabie-world:v1";
// Earlier builds shipped a seeded demo so the screens would not look empty. It
// reads as the user's own data, so drop it on load — but only while it is still
// untouched, because once somebody edits it those are real edits.
const SEEDED_ITEMS = ["cpu", "gpu", "ram"];
const isUntouchedDemo = (build: State["builds"][number]) =>
  build.id === "demo" && build.items.length === SEEDED_ITEMS.length && build.items.every((i) => SEEDED_ITEMS.includes(i.id));

function dropSeedData(state: State): State {
  const builds = state.builds.filter((b) => !isUntouchedDemo(b));
  if (builds.length === state.builds.length) return state;
  const notices = state.notices.filter((n) => n.id !== "welcome");
  return { ...state, builds, notices, activeBuildId: builds.some((b) => b.id === state.activeBuildId) ? state.activeBuildId : (builds[0]?.id ?? "") };
}

export function loadState(): State {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? dropSeedData(JSON.parse(raw) as State) : structuredClone(initialState);
  } catch {
    return structuredClone(initialState);
  }
}

export function saveState(state: State) {
  localStorage.setItem(KEY, JSON.stringify(state));
}
