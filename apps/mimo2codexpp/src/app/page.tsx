"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type PoolTotals = {
  total: number;
  healthy: number;
  cooling: number;
  unhealthy: number;
  starting: number;
};

type KeyMetrics = {
  totalRequests: number;
  successCount: number;
  failureCount: number;
  rateLimitCount: number;
  timeoutCount: number;
  avgLatencyMs: number;
  lastFailureAt?: string;
  lastSuccessAt?: string;
};

type PoolInstance = {
  keyId: string;
  port: number;
  adminPort: number;
  state: string;
  startedAt?: string;
  cooldownUntil?: number;
  metrics?: {
    inflight: number;
    recent?: { total: number; failures: number; rateLimits: number };
    lastRequestAt?: string;
    lastFailureAt?: string;
    last429At?: string;
  };
};

type KeyRecord = {
  id: string;
  label: string;
  keyPrefix: string;
  keyTail: string;
  hostType: string;
  status: string;
  instanceStatus?: string;
  recentRequests?: number;
  recentFailures?: number;
  recent429s?: number;
  inflight?: number;
  availableScore?: number;
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
  metrics?: KeyMetrics;
};

type PoolStatus = {
  keys: KeyRecord[];
  instances: PoolInstance[];
  totals: PoolTotals;
};

type GeneratedSetup = {
  authJson: Record<string, string>;
  configToml: string;
};

const tabs = ["dashboard", "keys", "setup"] as const;
type Tab = (typeof tabs)[number];

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ background: color, color: "#04110d" }}
    >
      {children}
    </span>
  );
}

function formatMaybeDate(value?: string) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function statusColor(status: string) {
  if (status === "healthy") return "#10b981";
  if (status === "cooling") return "#f59e0b";
  if (status === "unhealthy") return "#ef4444";
  if (status === "starting") return "#38bdf8";
  return "#64748b";
}

export default function Page() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [status, setStatus] = useState<PoolStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [gatewayBase, setGatewayBase] = useState("http://127.0.0.1:4020");
  const [generated, setGenerated] = useState<GeneratedSetup | null>(null);
  const [setupCopied, setSetupCopied] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pool/status");
      const json = (await res.json()) as PoolStatus;
      setStatus(json);
    } catch (error) {
      setError(String(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const totals = status?.totals;
  const instances = useMemo(() => status?.instances ?? [], [status?.instances]);
  const instanceMap = useMemo(() => {
    const mapped = new Map<string, PoolInstance>();
    for (const instance of instances) {
      mapped.set(instance.keyId, instance);
    }
    return mapped;
  }, [instances]);

  async function addKey() {
    if (!newKey.trim()) return;
    await fetch("/api/keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: newKey.trim(), label: newLabel.trim() }),
    });
    setNewKey("");
    setNewLabel("");
    await fetchStatus();
  }

  async function deleteKey(id: string) {
    await fetch(`/api/keys?id=${id}`, { method: "DELETE" });
    await fetchStatus();
  }

  async function refreshQuota(id: string) {
    setRefreshing(id);
    try {
      await fetch(`/api/keys/${id}/refresh`, { method: "POST" });
      await fetchStatus();
    } finally {
      setRefreshing(null);
    }
  }

  async function requestPoolAction(action: string, id?: string) {
    await fetch("/api/pool/status", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, id }),
    });
    await fetchStatus();
  }

  async function generateSetup() {
    const res = await fetch("/api/codex/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ gatewayBase }),
    });
    const json = (await res.json()) as GeneratedSetup;
    setGenerated(json);
    setSetupCopied(null);
  }

  async function copySetup(key: "auth" | "config") {
    if (!generated) return;
    const text =
      key === "auth"
        ? JSON.stringify(generated.authJson, null, 2)
        : generated.configToml;
    await navigator.clipboard.writeText(text);
    setSetupCopied(key);
    setTimeout(() => setSetupCopied(null), 1500);
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">mimo2codex++</h1>
          <p className="mt-1 text-sm text-slate-400">
            多账号 MiMo 网关 + 额度看板。通过多账号并发突破单账号并发上限，解决 429 限流问题。
          </p>
        </div>
        <button
          onClick={fetchStatus}
          className="rounded-lg bg-sky-500/90 px-3 py-2 text-sm font-medium text-black hover:bg-sky-400"
        >
          {loading ? "刷新中..." : "刷新状态"}
        </button>
      </header>

      {error ? (
        <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
          加载失败：{error}
        </div>
      ) : null}

      {/* 核心价值：突破并发限制 */}
      <section className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
        <div className="flex items-start gap-3">
          <div className="text-2xl">⚡</div>
          <div>
            <div className="text-base font-semibold text-amber-200">为什么需要 mimo2codex++？</div>
            <p className="mt-2 text-sm text-slate-300">
              使用单个小米 Key 时，经常遇到 <code className="rounded bg-black/30 px-1 py-0.5 text-amber-300">429 Too Many Requests</code> 错误，
              任务频繁失败。原因是单账号存在并发和速率限制。
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                <div className="text-xs font-medium text-slate-400">小米套餐并发上限</div>
                <div className="mt-2 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-300">Lite（39 元）</span>
                    <span className="font-mono text-rose-300">5 并发</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Standard（99 元）</span>
                    <span className="font-mono text-amber-300">20 并发</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Pro/Max（329/659 元）</span>
                    <span className="font-mono text-emerald-300">不设上限*</span>
                  </div>
                </div>
                <div className="mt-2 text-[10px] text-slate-500">* 受 TPM 与集群负载约束</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                <div className="text-xs font-medium text-slate-400">API 速率限制（所有套餐）</div>
                <div className="mt-2 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-300">RPM（每分钟请求数）</span>
                    <span className="font-mono text-sky-300">500</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">TPM（每分钟 Token）</span>
                    <span className="font-mono text-sky-300">100,000</span>
                  </div>
                </div>
                <div className="mt-2 text-[10px] text-slate-500">超限返回 429 Too Many Requests</div>
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
              <div className="text-sm font-medium text-emerald-200">✅ mimo2codex++ 的解决方案</div>
              <p className="mt-1 text-xs text-slate-300">
                通过<strong className="text-emerald-300">多账号并发</strong>，将请求分散到多个 Key，
                突破单账号的并发上限和 RPM/TPM 限制。例如 3 个 Standard 套餐账号 = 60 并发 + 1500 RPM + 300K TPM。
                系统自动处理 429 限流、冷却避让和健康调度。
              </p>
            </div>
          </div>
        </div>
      </section>

      <nav className="mt-6 flex gap-2">
        {tabs.map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              tab === item ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5"
            }`}
          >
            {item === "dashboard" ? "状态总览" : item === "keys" ? "账号池" : "Codex 接入"}
          </button>
        ))}
      </nav>

      {tab === "dashboard" ? (
        <section className="mt-6 grid gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-white/10 p-4">
            <div className="text-xs text-slate-400">账号总数</div>
            <div className="mt-1 text-2xl font-semibold">{totals?.total ?? 0}</div>
          </div>
          <div className="rounded-xl border border-white/10 p-4">
            <div className="text-xs text-slate-400">healthy</div>
            <div className="mt-1 text-2xl font-semibold text-emerald-400">{totals?.healthy ?? 0}</div>
          </div>
          <div className="rounded-xl border border-white/10 p-4">
            <div className="text-xs text-slate-400">cooling</div>
            <div className="mt-1 text-2xl font-semibold text-amber-400">{totals?.cooling ?? 0}</div>
          </div>
          <div className="rounded-xl border border-white/10 p-4">
            <div className="text-xs text-slate-400">unhealthy / starting</div>
            <div className="mt-1 text-2xl font-semibold text-rose-300">
              {(totals?.unhealthy ?? 0) + (totals?.starting ?? 0)}
            </div>
          </div>

          <div className="sm:col-span-4 rounded-xl border border-white/10 p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">实例运行状态</div>
              <div className="flex gap-2">
                <button onClick={() => requestPoolAction("start-all")} className="rounded-lg bg-emerald-500/80 px-3 py-1.5 text-xs font-medium text-black hover:bg-emerald-400">
                  全部启动
                </button>
                <button onClick={() => requestPoolAction("stop-all")} className="rounded-lg bg-rose-500/80 px-3 py-1.5 text-xs font-medium text-black hover:bg-rose-400">
                  全部停止
                </button>
              </div>
            </div>

            <div className="mt-3 divide-y divide-white/5 text-sm">
              {instances.length === 0 ? (
                <div className="py-3 text-slate-400">还没有运行中的实例。</div>
              ) : (
                instances.map((instance) => (
                  <div key={instance.keyId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-[220px]">
                      <div className="text-white/90">{instance.keyId}</div>
                      <div className="text-xs text-slate-500">
                        port {instance.port} / admin {instance.adminPort}
                      </div>
                    </div>
                    <Badge color={statusColor(instance.state)}>{instance.state}</Badge>
                    <div className="text-xs text-slate-400">
                      inflight {instance.metrics?.inflight ?? 0} · recent {instance.metrics?.recent?.total ?? 0}
                    </div>
                    <div className="text-xs text-slate-500">started {formatMaybeDate(instance.startedAt)}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="sm:col-span-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
            提示：多账号并发调度不是免费加速器。它能帮助降低单账号压力、提升成功率，但会增加本地计算资源占用，并可能更快消耗上游额度。
          </div>
        </section>
      ) : null}

      {tab === "keys" ? (
        <section className="mt-6 grid gap-4">
          <div className="rounded-xl border border-white/10 p-4">
            <div className="text-sm font-medium">添加 Key</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <input
                value={newLabel}
                onChange={(event) => setNewLabel(event.target.value)}
                placeholder="备注 / 标签"
                className="rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm"
              />
              <input
                value={newKey}
                onChange={(event) => setNewKey(event.target.value)}
                placeholder="tp-... / sk-..."
                className="sm:col-span-2 rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <button onClick={addKey} className="mt-3 rounded-lg bg-sky-500/90 px-3 py-2 text-sm font-medium text-black hover:bg-sky-400">
              添加
            </button>
          </div>

          <div className="rounded-xl border border-white/10 p-4">
            <div className="text-sm font-medium">已保存的 Key</div>
            <div className="mt-3 divide-y divide-white/5 text-sm">
              {(status?.keys ?? []).length === 0 ? (
                <div className="py-3 text-slate-400">还没有 Key，请先添加。</div>
              ) : (
                (status?.keys ?? []).map((key) => {
                  const instance = instanceMap.get(key.id);
                  return (
                    <div key={key.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-[260px]">
                        <div className="text-white/90">{key.label} <span className="ml-2 text-xs text-slate-500">{key.keyPrefix}***{key.keyTail}</span></div>
                        <div className="text-xs text-slate-500">
                          host {key.hostType} · instance {instance?.state ?? key.instanceStatus ?? "stopped"}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge color={statusColor(key.status)}>{key.status}</Badge>
                        <button onClick={() => refreshQuota(key.id)} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/5">
                          {refreshing === key.id ? "刷新中" : "刷新额度"}
                        </button>
                        <button onClick={() => requestPoolAction("start", key.id)} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/5">
                          启动实例
                        </button>
                        <button onClick={() => requestPoolAction("stop", key.id)} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/5">
                          停止实例
                        </button>
                        <button onClick={() => deleteKey(key.id)} className="rounded-lg border border-rose-500/40 px-2.5 py-1.5 text-xs text-rose-300 hover:bg-rose-500/10">
                          删除
                        </button>
                      </div>
                      <div className="text-xs text-slate-500">
                        {key.planName ? <div>plan {key.planName}</div> : null}
                        {typeof key.quotaRemaining === "number" ? <div>remaining {key.quotaRemaining}</div> : null}
                        {typeof key.quotaUsed === "number" ? <div>used {key.quotaUsed}</div> : null}
                        {key.expiresAt ? <div>expires {key.expiresAt}</div> : null}
                        {key.lastCheckedAt ? <div>checked {formatMaybeDate(key.lastCheckedAt)}</div> : null}
                        {key.lastError ? <div className="text-rose-300">last error: {key.lastError}</div> : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>
      ) : null}

      {tab === "setup" ? (
        <section className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 p-4">
            <div className="text-sm font-medium">生成 Codex 接入配置</div>
            <p className="mt-1 text-xs text-slate-400">
              生成后可直接复制到 Codex 配置目录。Gateway URL 请填写你对外暴露的 mimo2codex++ 地址。
            </p>
            <div className="mt-3 grid gap-3">
              <input
                value={gatewayBase}
                onChange={(event) => setGatewayBase(event.target.value)}
                placeholder="http://127.0.0.1:4020"
                className="rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm"
              />
              <button onClick={generateSetup} className="rounded-lg bg-sky-500/90 px-3 py-2 text-sm font-medium text-black hover:bg-sky-400">
                生成配置
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 p-4">
            <div className="text-sm font-medium">接入说明</div>
            <ol className="mt-2 list-decimal space-y-2 pl-4 text-sm text-slate-300">
              <li>先在“账号池”页添加多个 MiMo Key。</li>
              <li>在状态总览页启动实例，确认实例状态。</li>
              <li>回到本页生成 Codex 配置并复制。</li>
              <li>重启 Codex，使用统一网关入口。</li>
            </ol>
            <div className="mt-3 rounded-lg border border-sky-500/30 bg-sky-500/5 p-3 text-xs text-sky-200">
              说明：并发调度帮助分散单账号压力，但多任务会增加系统开销并更快消耗额度。
            </div>
          </div>

          <div className="sm:col-span-2 rounded-xl border border-white/10 p-4">
            <div className="text-sm font-medium">生成结果</div>
            {generated ? (
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                    <div>auth.json</div>
                    <button onClick={() => copySetup("auth")} className="rounded-md border border-white/10 px-2 py-1 text-xs hover:bg-white/5">
                      {setupCopied === "auth" ? "已复制" : "复制"}
                    </button>
                  </div>
                  <pre className="overflow-auto rounded-lg bg-black/40 p-3 text-xs text-slate-200">{JSON.stringify(generated.authJson, null, 2)}</pre>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                    <div>config.toml</div>
                    <button onClick={() => copySetup("config")} className="rounded-md border border-white/10 px-2 py-1 text-xs hover:bg-white/5">
                      {setupCopied === "config" ? "已复制" : "复制"}
                    </button>
                  </div>
                  <pre className="overflow-auto rounded-lg bg-black/40 p-3 text-xs text-slate-200">{generated.configToml}</pre>
                </div>
              </div>
            ) : (
              <div className="mt-3 text-sm text-slate-400">点击左侧“生成配置”后，这里会显示可复制内容。</div>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
