"use client";

import { useState, useEffect, useMemo } from "react";

interface Contest {
  id: string;
  title: string;
  prize: string;
  category: string;
  organizer: string;
  url: string;
  deadline: string;
  platform: string;
}

interface ContestsData {
  updated_at: string;
  total: number;
  contests: Contest[];
  by_category: Record<string, number>;
  by_platform: Record<string, number>;
}

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getDaysLeft(deadline: string): number {
  const dl = new Date(deadline);
  const now = new Date();
  return Math.ceil((dl.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/** Extract numeric prize value for filtering (returns USD equivalent estimate) */
function parsePrizeValue(prize: string): number {
  if (!prize) return 0;
  const clean = prize.replace(/[,，]/g, "").replace(/\s/g, "");

  // USD: $1,175,000
  const usd = clean.match(/\$(\d+)/);
  if (usd) return parseInt(usd[1]);

  // EUR: €250,000
  const eur = clean.match(/€(\d+)/);
  if (eur) return parseInt(eur[1]) * 1.1;

  // CNY: ￥100,000 or ¥100,000
  const cny = clean.match(/[￥¥](\d+)/);
  if (cny) return parseInt(cny[1]) / 7.2;

  // Plain number with 万
  const wan = clean.match(/(\d+)万/);
  if (wan) return parseInt(wan[1]) * 10000 / 7.2;

  // 百万
  if (clean.includes("百万")) return 100000;

  return 0;
}

function shortTitle(title: string): string {
  let t = title
    .replace(/\(赛季\s*\d+\)/, "")
    .replace(/：.*$/, "")
    .replace(/ - .*$/, "")
    .replace(/ · .*$/, "")
    .trim();
  if (t.length > 20) t = t.slice(0, 19) + "…";
  return t;
}

export default function ContestsPage() {
  const [data, setData] = useState<ContestsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [minPrize, setMinPrize] = useState(5000); // Default: filter ≥$5000

  useEffect(() => {
    fetch("/contests/all.json?v=" + Date.now())
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Filter by minimum prize
  const filtered = useMemo(() => {
    if (!data) return [];
    return data.contests.filter((c) => {
      const val = parsePrizeValue(c.prize);
      return val >= minPrize || c.prize.includes("万") || c.prize.includes("百万");
    });
  }, [data, minPrize]);

  const contestMap = useMemo(() => {
    const map: Record<string, Contest[]> = {};
    for (const c of filtered) {
      const key = c.deadline.split("T")[0];
      if (!map[key]) map[key] = [];
      map[key].push(c);
    }
    return map;
  }, [filtered]);

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: Array<{ date: Date; dateStr: string; isCurrentMonth: boolean }> = [];

    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthDays - i);
      days.push({ date: d, dateStr: fmt(d), isCurrentMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      days.push({ date, dateStr: fmt(date), isCurrentMonth: true });
    }
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const date = new Date(year, month + 1, d);
      days.push({ date, dateStr: fmt(date), isCurrentMonth: false });
    }
    return days;
  }, [currentMonth]);

  const todayStr = fmt(new Date());
  const monthLabel = `${currentMonth.getFullYear()}年${currentMonth.getMonth() + 1}月`;

  // Stats
  const totalPrize = useMemo(() => {
    let total = 0;
    for (const c of filtered) {
      total += parsePrizeValue(c.prize);
    }
    return total;
  }, [filtered]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-white text-gray-900"
      style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif" }}
    >
      {/* Header */}
      <div className="max-w-[1360px] mx-auto px-8 pt-10 pb-2">
        <h1 className="text-[32px] font-bold tracking-tight">AI赛事掘金</h1>
        <p className="text-[14px] text-gray-400 mt-1">
          {filtered.length} 场高奖金赛事 · 总奖金池约 ${Math.round(totalPrize).toLocaleString()} · 更新于 {new Date(data?.updated_at || "").toLocaleDateString("zh-CN")}
        </p>
      </div>

      {/* Controls bar */}
      <div className="max-w-[1360px] mx-auto px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-gray-400">最低奖金筛选</span>
          {[
            { label: "全部", value: 0 },
            { label: "≥$5K", value: 5000 },
            { label: "≥$10K", value: 10000 },
            { label: "≥$50K", value: 50000 },
            { label: "≥$100K", value: 100000 },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setMinPrize(opt.value)}
              className={`px-3 py-1 rounded-full text-[12px] font-medium transition-colors ${
                minPrize === opt.value
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L5 7l4 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <button
            onClick={() => setCurrentMonth(new Date())}
            className="text-[13px] text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded-lg hover:bg-gray-100"
          >
            今天
          </button>
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 2l4 5-4 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      </div>

      {/* Calendar */}
      <div className="max-w-[1360px] mx-auto px-8 pb-10">
        {/* Month label */}
        <h2 className="text-[20px] font-semibold mb-3">{monthLabel}</h2>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-gray-200">
          {WEEKDAYS.map((d) => (
            <div key={d} className="text-center text-[12px] text-gray-400 font-medium py-2">{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 border-l border-gray-100">
          {calendarDays.map((day, i) => {
            const isToday = day.dateStr === todayStr;
            const contests = contestMap[day.dateStr] || [];
            const hasContest = contests.length > 0;

            return (
              <div
                key={i}
                className={`
                  min-h-[130px] border-r border-b border-gray-100 p-2 transition-colors
                  ${!day.isCurrentMonth ? "bg-gray-50/50" : ""}
                  ${hasContest ? "bg-red-50/20" : ""}
                  hover:bg-gray-50
                `}
              >
                {/* Date number */}
                <div className="flex items-center justify-between mb-1">
                  <span className={`
                    text-[14px] font-medium w-7 h-7 flex items-center justify-center rounded-full
                    ${isToday ? "bg-gray-900 text-white" : ""}
                    ${!day.isCurrentMonth ? "text-gray-300" : "text-gray-700"}
                  `}>
                    {day.date.getDate()}
                  </span>
                  {hasContest && (
                    <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">
                      {contests.length}场
                    </span>
                  )}
                </div>

                {/* Contest entries */}
                <div className="space-y-1">
                  {contests.map((c) => {
                    const days = getDaysLeft(c.deadline);
                    const prizeVal = parsePrizeValue(c.prize);
                    const isBig = prizeVal >= 100000;
                    return (
                      <a
                        key={c.id}
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block group"
                        title={`${c.title}\n奖金: ${c.prize}\n主办方: ${c.organizer}\n平台: ${c.platform}`}
                      >
                        <div className={`
                          text-[11px] leading-tight px-1.5 py-1 rounded-md transition-colors
                          ${isBig
                            ? "bg-amber-100 text-amber-900 font-semibold border border-amber-200"
                            : days <= 3
                            ? "bg-red-100 text-red-800 font-medium"
                            : days <= 7
                            ? "bg-orange-50 text-orange-700"
                            : "bg-gray-100 text-gray-600"
                          }
                          group-hover:opacity-80
                        `}>
                          <div className="font-medium truncate">{shortTitle(c.title)}</div>
                          <div className="flex items-center gap-1 mt-0.5 opacity-80">
                            <span className="font-semibold">{c.prize}</span>
                          </div>
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-5 mt-4 text-[11px] text-gray-400">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-100 border border-amber-200" />
            ≥$100K 大奖
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-red-100" />
            ≤3天
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-orange-50" />
            ≤7天
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-gray-100" />
            更远
          </div>
          <span className="ml-auto text-gray-300">点击赛事跳转报名页</span>
        </div>
      </div>
    </div>
  );
}
