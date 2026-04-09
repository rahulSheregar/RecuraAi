/**
 * Removes browser keys owned by this app (localStorage prefix `recura`).
 * Safe to call before re-seeding defaults in React state.
 */
export function clearRecuraLocalStorage(): void {
  if (typeof window === "undefined") return;
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.toLowerCase().startsWith("recura")) keys.push(k);
  }
  for (const k of keys) {
    localStorage.removeItem(k);
  }
}
