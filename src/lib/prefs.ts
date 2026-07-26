const PREFIX = "cinder-";
const LEGACY = "au-";

export function readPref(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key) ?? localStorage.getItem(LEGACY + key);
  } catch {
    return null;
  }
}

export function writePref(key: string, value: string): void {
  try {
    localStorage.setItem(PREFIX + key, value);
  } catch {}
}
