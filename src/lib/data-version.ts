// Global data version — bumped on every database write, used to push
// live-update notifications to connected clients via SSE (/api/stream).
// Stored on globalThis so all route bundles share the same instance.

type Listener = () => void;

interface VersionStore {
  v: number;
  listeners: Set<Listener>;
  pending: boolean;
}

const g = globalThis as unknown as { __dataVersionStore?: VersionStore };
const store: VersionStore =
  g.__dataVersionStore ?? (g.__dataVersionStore = { v: Date.now(), listeners: new Set(), pending: false });

export function getDataVersion(): number {
  return store.v;
}

export function bumpDataVersion(): void {
  store.v++;
  // Coalesce rapid consecutive bumps (e.g. multi-upsert transactions) into one notification
  if (store.pending) return;
  store.pending = true;
  setTimeout(() => {
    store.pending = false;
    for (const l of store.listeners) {
      try {
        l();
      } catch {}
    }
  }, 150);
}

export function subscribeDataVersion(l: Listener): () => void {
  store.listeners.add(l);
  return () => store.listeners.delete(l);
}
