export interface MiMoQuotaSnapshot {
  quotaTotal?: number;
  quotaUsed?: number;
  quotaRemaining?: number;
  planName?: string;
  cycleStart?: string;
  cycleEnd?: string;
  expiresAt?: string;
  raw?: unknown;
}

function inferBaseUrl(key: string) {
  if (key.startsWith("tp-")) {
    return "https://token-plan-sgp.xiaomimimo.com";
  }

  return "https://api.xiaomimimo.com";
}

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}

export async function fetchQuotaSnapshot(rawKey: string): Promise<MiMoQuotaSnapshot> {
  const base = inferBaseUrl(rawKey);
  const headers = {
    Authorization: `Bearer ${rawKey}`,
    Accept: "application/json",
  };

  const endpoints = ["/v1/dashboard/billing/usage", "/v1/dashboard/billing/subscription", "/v1/account/usage"];

  for (const path of endpoints) {
    try {
      const res = await fetch(`${base}${path}`, { headers, cache: "no-store" });

      if (!res.ok) {
        continue;
      }

      const json = await safeJson(res);

      if (!json) {
        continue;
      }

      const snapshot: MiMoQuotaSnapshot = { raw: json };
      const data = json?.data ?? json;

      snapshot.quotaTotal ??= Number(data.total ?? data.total_tokens ?? data.quotaTotal ?? data.quota_total ?? NaN) || undefined;
      snapshot.quotaUsed ??= Number(data.used ?? data.used_tokens ?? data.quotaUsed ?? data.quota_used ?? NaN) || undefined;
      snapshot.quotaRemaining ??= Number(data.remaining ?? data.remaining_tokens ?? data.quotaRemaining ?? data.quota_remaining ?? NaN) || undefined;
      snapshot.planName ??= String(data.plan ?? data.plan_name ?? data.product_name ?? "") || undefined;
      snapshot.cycleStart ??= String(data.cycle_start ?? data.current_period_start ?? "") || undefined;
      snapshot.cycleEnd ??= String(data.cycle_end ?? data.current_period_end ?? "") || undefined;
      snapshot.expiresAt ??= String(data.expires_at ?? data.expire_at ?? data.current_period_end ?? "") || undefined;

      if (snapshot.quotaTotal && snapshot.quotaUsed && !snapshot.quotaRemaining) {
        snapshot.quotaRemaining = Math.max(snapshot.quotaTotal - snapshot.quotaUsed, 0);
      }

      return snapshot;
    } catch {
      continue;
    }
  }

  return {};
}
