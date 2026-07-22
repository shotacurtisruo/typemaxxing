// jsdom's localStorage can be incomplete under vitest; install a spec-complete,
// in-memory Storage so the persistence tests exercise the real code paths.
class MemoryStorage {
  private m = new Map<string, string>()
  get length() {
    return this.m.size
  }
  clear() {
    this.m.clear()
  }
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v))
  }
  removeItem(k: string) {
    this.m.delete(k)
  }
  key(i: number) {
    return Array.from(this.m.keys())[i] ?? null
  }
}

const g = globalThis as unknown as { localStorage?: Storage }
if (typeof g.localStorage === "undefined" || typeof g.localStorage.clear !== "function") {
  Object.defineProperty(globalThis, "localStorage", {
    value: new MemoryStorage(),
    configurable: true,
    writable: true,
  })
}
