import fs from "node:fs";
import path from "node:path";
import type { MiMoKeyRecord, MiMoKeyRecordSafe } from "./types";
import { decrypt } from "./encryption";

// Simple, reliable DATA_DIR resolution
// Priority: 1) env var, 2) cwd, 3) hardcoded fallback
function getDataDir(): string {
  // Method 1: Environment variable (set by start.sh)
  if (process.env.DATA_DIR) {
    return process.env.DATA_DIR;
  }

  // Method 2: Check if data/ exists in cwd
  const cwdData = path.join(process.cwd(), "data");
  if (fs.existsSync(cwdData)) {
    return cwdData;
  }

  // Method 3: Hardcoded fallback
  return "/Users/scq/Documents/New project7/apps/mimo2codexpp/data";
}

const DATA_DIR = getDataDir();
const DATA_FILE = path.join(DATA_DIR, "keys.json");

console.log(`[key-store] DATA_DIR = ${DATA_DIR}`);

// Ensure directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log(`[key-store] Created directory: ${DATA_DIR}`);
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function readKeys(): MiMoKeyRecord[] {
  ensureDir();
  if (!fs.existsSync(DATA_FILE)) {
    return [];
  }
  const raw = fs.readFileSync(DATA_FILE, "utf-8");
  try {
    return JSON.parse(raw) as MiMoKeyRecord[];
  } catch {
    return [];
  }
}

export function writeKeys(keys: MiMoKeyRecord[]) {
  ensureDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(keys, null, 2), "utf-8");
}

export function addKey(record: MiMoKeyRecord) {
  const keys = readKeys();
  keys.push(record);
  writeKeys(keys);
  return toSafe(record);
}

export function removeKey(id: string) {
  const keys = readKeys().filter((item) => item.id !== id);
  writeKeys(keys);
}

export function updateKey(id: string, patch: Partial<MiMoKeyRecord>): MiMoKeyRecordSafe | null {
  const keys = readKeys();
  const next = keys.map((item) => (item.id === id ? { ...item, ...patch } : item));
  writeKeys(next);
  const found = next.find((item) => item.id === id);
  return found ? toSafe(found) : null;
}

/** Returns the decrypted raw key for internal use (pool manager, quota refresh) */
export function getDecryptedKey(id: string): string | null {
  const keys = readKeys();
  const record = keys.find((item) => item.id === id);
  if (!record?.encryptedKey) return null;
  try {
    return decrypt(record.encryptedKey);
  } catch {
    return null;
  }
}

/** Returns all records without the encrypted key (safe for client) */
export function readKeysSafe(): MiMoKeyRecordSafe[] {
  return readKeys().map(toSafe);
}

/** Returns all records with decrypted keys (internal use only) */
export function readKeysWithRaw(): Array<MiMoKeyRecord & { rawKey: string }> {
  return readKeys().map((record) => ({
    ...record,
    rawKey: (() => {
      try {
        return decrypt(record.encryptedKey);
      } catch {
        return "";
      }
    })(),
  }));
}

function toSafe(record: MiMoKeyRecord): MiMoKeyRecordSafe {
  const { encryptedKey: _, ...safe } = record;
  return safe;
}
