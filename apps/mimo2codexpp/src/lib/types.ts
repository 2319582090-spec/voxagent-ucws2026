export type KeyStatus = "healthy" | "unhealthy" | "cooling" | "unknown";

export interface KeyMetrics {
  totalRequests: number;
  successCount: number;
  failureCount: number;
  rateLimitCount: number;
  timeoutCount: number;
  avgLatencyMs: number;
  lastFailureAt?: string;
  lastSuccessAt?: string;
}

export interface MiMoKeyRecord {
  id: string;
  label: string;
  /** Display-only prefix (e.g. "tp-") */
  keyPrefix: string;
  /** Display-only tail (e.g. "xK9q") */
  keyTail: string;
  /** AES-256-GCM encrypted raw key (base64). Only stored on disk, never sent to client. */
  encryptedKey: string;
  hostType: string;
  status: KeyStatus;
  lastCheckedAt?: string;
  cooldownUntil?: string;
  lastError?: string;
  quotaTotal?: number;
  quotaUsed?: number;
  quotaRemaining?: number;
  planName?: string;
  cycleStart?: string;
  cycleEnd?: string;
  expiresAt?: string;
  /** Assigned mimo2codex instance port */
  instancePort?: number;
  /** mimo2codex instance process status */
  instanceStatus?: "starting" | "running" | "stopped" | "error";
  /** Runtime metrics */
  metrics?: KeyMetrics;
}

/** Shape returned to the frontend — raw key fields are stripped */
export type MiMoKeyRecordSafe = Omit<MiMoKeyRecord, "encryptedKey">;

export interface PoolStatus {
  totalKeys: number;
  healthyKeys: number;
  coolingKeys: number;
  unhealthyKeys: number;
  instances: Array<{
    keyId: string;
    label: string;
    port: number | null;
    instanceStatus: string;
    keyStatus: KeyStatus;
    inflight: number;
    metrics?: KeyMetrics;
    cooldownUntil?: string;
    lastError?: string;
  }>;
}
