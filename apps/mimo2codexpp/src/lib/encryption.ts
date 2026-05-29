import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ALGO = "aes-256-gcm";
const IV_LEN = 16;
const TAG_LEN = 16;
const SALT_LEN = 32;

const SECRET_DIR = path.join(process.cwd(), "apps", "mimo2codex-plusplus", "data");
const SECRET_FILE = path.join(SECRET_DIR, ".encryption-key");

function getOrCreateSecret(): Buffer {
  if (!fs.existsSync(SECRET_DIR)) {
    fs.mkdirSync(SECRET_DIR, { recursive: true });
  }
  if (fs.existsSync(SECRET_FILE)) {
    return fs.readFileSync(SECRET_FILE);
  }
  const secret = crypto.randomBytes(32);
  fs.writeFileSync(SECRET_FILE, secret, { mode: 0o600 });
  return secret;
}

function deriveKey(secret: Buffer, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(secret, salt, 100_000, 32, "sha256");
}

export function encrypt(plaintext: string): string {
  const secret = getOrCreateSecret();
  const salt = crypto.randomBytes(SALT_LEN);
  const key = deriveKey(secret, salt);
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Pack: salt(32) + iv(16) + tag(16) + ciphertext
  const packed = Buffer.concat([salt, iv, tag, encrypted]);
  return packed.toString("base64");
}

export function decrypt(packedBase64: string): string {
  const secret = getOrCreateSecret();
  const packed = Buffer.from(packedBase64, "base64");

  const salt = packed.subarray(0, SALT_LEN);
  const iv = packed.subarray(SALT_LEN, SALT_LEN + IV_LEN);
  const tag = packed.subarray(SALT_LEN + IV_LEN, SALT_LEN + IV_LEN + TAG_LEN);
  const encrypted = packed.subarray(SALT_LEN + IV_LEN + TAG_LEN);

  const key = deriveKey(secret, salt);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);

  return decipher.update(encrypted) + decipher.final("utf8");
}
