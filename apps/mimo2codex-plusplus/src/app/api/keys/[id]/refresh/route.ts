import { NextResponse } from "next/server";
import { readKeys, updateKey, getDecryptedKey } from "@/lib/key-store";
import { fetchQuotaSnapshot } from "@/lib/quota-client";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const keys = readKeys();
  const target = keys.find((item) => item.id === id);

  if (!target) {
    return NextResponse.json({ error: "key not found" }, { status: 404 });
  }

  const rawKey = getDecryptedKey(id);
  if (!rawKey) {
    return NextResponse.json({ error: "could not decrypt stored key" }, { status: 500 });
  }

  const snapshot = await fetchQuotaSnapshot(rawKey);

  // Determine status based on whether we got meaningful data
  let status: "healthy" | "unknown" = "unknown";
  if (snapshot.quotaTotal || snapshot.planName) {
    status = "healthy";
  }

  const updated = updateKey(id, {
    quotaTotal: snapshot.quotaTotal,
    quotaUsed: snapshot.quotaUsed,
    quotaRemaining: snapshot.quotaRemaining,
    planName: snapshot.planName,
    cycleStart: snapshot.cycleStart,
    cycleEnd: snapshot.cycleEnd,
    expiresAt: snapshot.expiresAt,
    lastCheckedAt: new Date().toISOString(),
    status,
  });

  return NextResponse.json({
    key: updated,
    snapshot,
    degraded: !snapshot.quotaTotal && !snapshot.planName,
  });
}
