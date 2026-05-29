import { spawn, type ChildProcess } from "node:child_process";
import { readKeysWithRaw, updateKey } from "./key-store";
import type { KeyMetrics, KeyStatus, MiMoKeyRecord, PoolStatus } from "./types";

// ── Constants ───────────────────────────────────────────────────────────────

const BASE_PORT = 9100;
const COOLDOWN_MS = 30_000; // 30s cooldown after 429/error
const HEALTH_CHECK_INTERVAL_MS = 60_000; // 1 min
const MAX_RESTART_DELAY_MS = 30_000;
const MIMO2CODEX_BIN = process.env.MIMO2CODEX_BIN ?? "mimo2codex";

// ── Instance State ──────────────────────────────────────────────────────────

interface Instance {
  keyId: string;
  port: number;
  child: ChildProcess | null;
  status: "starting" | "running" | "stopped" | "error";
  keyStatus: KeyStatus;
  cooldownUntil: number; // timestamp ms, 0 = not cooling
  inflight: number;
  metrics: KeyMetrics;
  restartCount: number;
  lastHealthCheck: number;
}

// ── Pool Manager Singleton ──────────────────────────────────────────────────

class PoolManager {
  private instances = new Map<string, Instance>();
  private nextPort = BASE_PORT;
  private healthTimer: ReturnType<typeof setInterval> | null = null;
  private initialized = false;

  /** Initialize the pool — load keys and start instances */
  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    const keys = readKeysWithRaw();
    for (const key of keys) {
      if (key.encryptedKey && key.rawKey) {
        await this.addInstance(key);
      }
    }

    // Periodic health check
    this.healthTimer = setInterval(() => this.healthCheck(), HEALTH_CHECK_INTERVAL_MS);

    // Graceful shutdown
    const shutdown = () => this.shutdown();
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
    process.on("beforeExit", shutdown);
  }

  /** Add a new mimo2codex instance for a key */
  async addInstance(key: MiMoKeyRecord & { rawKey: string }): Promise<Instance> {
    const port = this.allocatePort();
    const inst: Instance = {
      keyId: key.id,
      port,
      child: null,
      status: "starting",
      keyStatus: "unknown",
      cooldownUntil: 0,
      inflight: 0,
      metrics: {
        totalRequests: 0,
        successCount: 0,
        failureCount: 0,
        rateLimitCount: 0,
        timeoutCount: 0,
        avgLatencyMs: 0,
      },
      restartCount: 0,
      lastHealthCheck: 0,
    };

    this.instances.set(key.id, inst);
    updateKey(key.id, { instancePort: port, instanceStatus: "starting" });

    this.spawnProcess(inst, key.rawKey);
    return inst;
  }

  /** Remove an instance */
  removeInstance(keyId: string): void {
    const inst = this.instances.get(keyId);
    if (!inst) return;

    if (inst.child) {
      inst.child.kill("SIGTERM");
      inst.child = null;
    }
    inst.status = "stopped";
    this.instances.delete(keyId);
    updateKey(keyId, { instanceStatus: "stopped" });
  }

  /** Restart an instance */
  async restartInstance(keyId: string): Promise<void> {
    const inst = this.instances.get(keyId);
    if (!inst) return;

    if (inst.child) {
      inst.child.kill("SIGTERM");
      inst.child = null;
    }

    const keys = readKeysWithRaw();
    const key = keys.find((k) => k.id === keyId);
    if (!key?.rawKey) return;

    inst.status = "starting";
    inst.restartCount++;
    updateKey(keyId, { instanceStatus: "starting" });
    this.spawnProcess(inst, key.rawKey);
  }

  /** Spawn a mimo2codex child process */
  private spawnProcess(inst: Instance, rawKey: string): void {
    const args = [
      "--port", String(inst.port),
      "--host", "127.0.0.1",
      "--api-key", rawKey,
      "--model", "mimo",
      "--no-admin",
      "--no-update-check",
      "--no-load-env",
    ];

    const child = spawn(MIMO2CODEX_BIN, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        MIMO_API_KEY: rawKey,
        MIMO2CODEX_NO_ADMIN: "1",
        MIMO2CODEX_NO_UPDATE_CHECK: "1",
      },
    });

    inst.child = child;

    child.on("error", (err) => {
      console.error(`[pool] instance ${inst.keyId} spawn error:`, err.message);
      inst.status = "error";
      inst.keyStatus = "unhealthy";
      updateKey(inst.keyId, { instanceStatus: "error", status: "unhealthy", lastError: err.message });
      this.scheduleRestart(inst);
    });

    child.on("exit", (code, signal) => {
      console.warn(`[pool] instance ${inst.keyId} exited (code=${code}, signal=${signal})`);
      inst.child = null;
      if (inst.status === "running") {
        inst.status = "stopped";
        updateKey(inst.keyId, { instanceStatus: "stopped" });
        this.scheduleRestart(inst);
      }
    });

    // Consider it running after a short delay (mimo2codex starts fast)
    setTimeout(() => {
      if (inst.child === child && inst.status === "starting") {
        inst.status = "running";
        inst.keyStatus = "healthy";
        updateKey(inst.keyId, { instanceStatus: "running", status: "healthy" });
        console.log(`[pool] instance ${inst.keyId} running on port ${inst.port}`);
      }
    }, 2000);
  }

  /** Schedule a restart with exponential backoff */
  private scheduleRestart(inst: Instance): void {
    const delay = Math.min(1000 * Math.pow(2, inst.restartCount), MAX_RESTART_DELAY_MS);
    console.log(`[pool] scheduling restart for ${inst.keyId} in ${delay}ms`);
    setTimeout(() => {
      if (this.instances.has(inst.keyId)) {
        this.restartInstance(inst.keyId).catch((err) => {
          console.error(`[pool] restart failed for ${inst.keyId}:`, err);
        });
      }
    }, delay);
  }

  /** Allocate the next available port */
  private allocatePort(): number {
    const used = new Set<number>();
    for (const inst of this.instances.values()) {
      if (inst.port) used.add(inst.port);
    }
    while (used.has(this.nextPort)) {
      this.nextPort++;
    }
    return this.nextPort++;
  }

  // ── Health Check ────────────────────────────────────────────────────────

  private async healthCheck(): Promise<void> {
    const now = Date.now();
    for (const inst of this.instances.values()) {
      if (inst.status !== "running") continue;
      inst.lastHealthCheck = now;

      try {
        const res = await fetch(`http://127.0.0.1:${inst.port}/v1/models`, {
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          if (inst.keyStatus !== "healthy") {
            inst.keyStatus = "healthy";
            inst.cooldownUntil = 0;
            updateKey(inst.keyId, { status: "healthy", cooldownUntil: undefined, lastError: undefined });
          }
        } else {
          // Non-OK response — might be degraded
          if (res.status === 429) {
            this.enterCooldown(inst, "rate limited by upstream");
          }
        }
      } catch {
        // Connection failed — check if process is still alive
        if (inst.child && !inst.child.killed) {
          // Process alive but not responding — might be starting up
          inst.keyStatus = "unknown";
        } else {
          inst.keyStatus = "unhealthy";
          inst.status = "stopped";
          updateKey(inst.keyId, { status: "unhealthy", instanceStatus: "stopped" });
        }
      }
    }
  }

  // ── Cooldown State Machine ──────────────────────────────────────────────

  private enterCooldown(inst: Instance, reason: string): void {
    inst.cooldownUntil = Date.now() + COOLDOWN_MS;
    inst.keyStatus = "cooling";
    const cooldownIso = new Date(inst.cooldownUntil).toISOString();
    updateKey(inst.keyId, {
      status: "cooling",
      cooldownUntil: cooldownIso,
      lastError: reason,
    });
    console.log(`[pool] instance ${inst.keyId} cooling down for ${COOLDOWN_MS}ms: ${reason}`);
  }

  private isCooling(inst: Instance): boolean {
    if (inst.cooldownUntil === 0) return false;
    if (Date.now() >= inst.cooldownUntil) {
      // Cooldown expired, back to healthy
      inst.cooldownUntil = 0;
      inst.keyStatus = "healthy";
      updateKey(inst.keyId, { status: "healthy", cooldownUntil: undefined });
      return false;
    }
    return true;
  }

  // ── Request Routing (Scheduler) ─────────────────────────────────────────

  /**
   * Atomically select + mark begin (prevents race condition).
   * Returns null if no instance is available.
   */
  selectAndBegin(): Instance | null {
    const candidates: Instance[] = [];

    for (const inst of this.instances.values()) {
      if (inst.status !== "running") continue;
      if (this.isCooling(inst)) continue;
      if (inst.keyStatus === "unhealthy") continue;
      candidates.push(inst);
    }

    if (candidates.length === 0) {
      for (const inst of this.instances.values()) {
        if (inst.status === "running" && inst.keyStatus !== "unhealthy") {
          candidates.push(inst);
        }
      }
    }

    if (candidates.length === 0) return null;

    candidates.sort((a, b) => {
      const aHealth = a.keyStatus === "healthy" ? 0 : 1;
      const bHealth = b.keyStatus === "healthy" ? 0 : 1;
      if (aHealth !== bHealth) return aHealth - bHealth;
      if (a.inflight !== b.inflight) return a.inflight - b.inflight;
      return a.metrics.totalRequests - b.metrics.totalRequests;
    });

    const chosen = candidates[0];
    chosen.inflight++;
    chosen.metrics.totalRequests++;
    return chosen;
  }

  /** Mark a request as completed */
  endRequest(keyId: string, result: { success: boolean; status?: number; latencyMs?: number }): void {
    const inst = this.instances.get(keyId);
    if (!inst) return;

    inst.inflight = Math.max(0, inst.inflight - 1);

    const now = new Date().toISOString();

    if (result.success) {
      inst.metrics.successCount++;
      inst.metrics.lastSuccessAt = now;
      if (result.latencyMs) {
        // Rolling average
        const n = inst.metrics.successCount;
        inst.metrics.avgLatencyMs =
          ((inst.metrics.avgLatencyMs * (n - 1)) + result.latencyMs) / n;
      }
    } else {
      inst.metrics.failureCount++;
      inst.metrics.lastFailureAt = now;

      if (result.status === 429) {
        inst.metrics.rateLimitCount++;
        this.enterCooldown(inst, "429 rate limit from upstream");
      } else if (result.status && result.status >= 500) {
        this.enterCooldown(inst, `upstream error ${result.status}`);
      }
    }

    // Persist metrics
    updateKey(keyId, { metrics: { ...inst.metrics } });
  }

  // ── Pool Status ─────────────────────────────────────────────────────────

  getStatus(): PoolStatus {
    const instances: PoolStatus["instances"] = [];
    let healthyKeys = 0;
    let coolingKeys = 0;
    let unhealthyKeys = 0;

    for (const inst of this.instances.values()) {
      if (inst.keyStatus === "healthy") healthyKeys++;
      else if (inst.keyStatus === "cooling") coolingKeys++;
      else if (inst.keyStatus === "unhealthy") unhealthyKeys++;

      instances.push({
        keyId: inst.keyId,
        label: "", // filled from key-store by the API route
        port: inst.port,
        instanceStatus: inst.status,
        keyStatus: inst.keyStatus,
        inflight: inst.inflight,
        metrics: { ...inst.metrics },
        cooldownUntil: inst.cooldownUntil > 0 ? new Date(inst.cooldownUntil).toISOString() : undefined,
      });
    }

    return {
      totalKeys: this.instances.size,
      healthyKeys,
      coolingKeys,
      unhealthyKeys,
      instances,
    };
  }

  /** Get a specific instance by key ID */
  getInstance(keyId: string): Instance | undefined {
    return this.instances.get(keyId);
  }

  // ── Shutdown ────────────────────────────────────────────────────────────

  shutdown(): void {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }

    for (const inst of this.instances.values()) {
      if (inst.child) {
        inst.child.kill("SIGTERM");
        inst.child = null;
      }
      inst.status = "stopped";
    }

    this.instances.clear();
    this.initialized = false;
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

const globalForPool = globalThis as unknown as { __poolManager?: PoolManager };

export function getPoolManager(): PoolManager {
  if (!globalForPool.__poolManager) {
    globalForPool.__poolManager = new PoolManager();
  }
  return globalForPool.__poolManager;
}
