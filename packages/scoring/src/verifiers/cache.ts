/**
 * Dead-simple TTL cache. In-memory, per-process. Replace with Redis for prod
 * multi-instance deployments. Sufficient for single-server MVP.
 */
interface Entry<V> {
  value: V;
  expiresAt: number;
}

export class TTLCache<V> {
  private store = new Map<string, Entry<V>>();
  constructor(private defaultTtlMs: number) {}

  get(key: string): V | null {
    const e = this.store.get(key);
    if (!e) return null;
    if (Date.now() > e.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return e.value;
  }

  set(key: string, value: V, ttlMs?: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs) });
  }

  size(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }
}
