"""
Main aggregator - runs all scrapers, merges, deduplicates, outputs JSON.
Usage: python scrape_all.py
"""
import importlib
import json
import pkgutil
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from config import ALL_CONTESTS_FILE, DAILY_PUSH_FILE


def normalize_for_dedup(title):
    """Normalize title for deduplication."""
    s = title.lower()
    s = re.sub(r"\(赛季\s*\d+\)", "", s)
    s = re.sub(r"[（(][^）)]*[）)]", "", s)
    s = re.sub(r"[-–—：:，,、\s_/·｜]", "", s)
    s = re.sub(r"20\d{2}年?", "", s)
    s = re.sub(r"[\U0001f300-\U0001f9ff]", "", s)
    return s.strip()


def run_all():
    print(f"🔍 开始抓取 AI 赛事... ({datetime.now().strftime('%Y-%m-%d %H:%M')})")
    print()

    all_contests = []
    sources = []

    for _, module_name, _ in pkgutil.iter_modules(["sources"]):
        sources.append(module_name)

    for name in sorted(sources):
        try:
            module = importlib.import_module(f"sources.{name}", package=None)
            if not hasattr(module, "scrape"):
                continue
            print(f"  ⏳ 正在抓取 {name}...")
            results = module.scrape()
            print(f"  ✅ {name}: 找到 {len(results)} 个 AI 赛事")
            all_contests.extend(results)
        except Exception as e:
            print(f"  ❌ {name} 失败: {e}")

    # Smart deduplication: normalize title, keep the one with more info
    seen = {}
    unique = []
    for c in all_contests:
        key = normalize_for_dedup(c["title"])
        if not key:
            continue
        if key in seen:
            # Keep the one with better data (has URL, has prize amount)
            existing = seen[key]
            c_score = _data_score(c)
            e_score = _data_score(existing)
            if c_score > e_score:
                # Replace
                idx = unique.index(existing)
                unique[idx] = c
                seen[key] = c
        else:
            seen[key] = c
            unique.append(c)

    # Sort by deadline (soonest first)
    unique.sort(key=lambda x: x.get("deadline", "9999"))

    # Add summary stats
    now_str = datetime.now(timezone.utc).isoformat()
    output = {
        "updated_at": now_str,
        "total": len(unique),
        "contests": unique,
        "by_category": {},
        "by_platform": {},
    }

    for c in unique:
        cat = c.get("category", "其他")
        plat = c.get("platform", "未知")
        output["by_category"][cat] = output["by_category"].get(cat, 0) + 1
        output["by_platform"][plat] = output["by_platform"].get(plat, 0) + 1

    # Write main JSON
    ALL_CONTESTS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(ALL_CONTESTS_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"\n📄 数据已写入: {ALL_CONTESTS_FILE}")

    # Generate daily push summary
    push = _generate_push(output)
    with open(DAILY_PUSH_FILE, "w", encoding="utf-8") as f:
        json.dump(push, f, ensure_ascii=False, indent=2)
    print(f"📢 推送内容已写入: {DAILY_PUSH_FILE}")

    print(f"\n🎯 总计: {len(unique)} 个 AI 赛事（去重后）")
    for cat, count in sorted(output["by_category"].items(), key=lambda x: -x[1]):
        print(f"   {cat}: {count}")
    for plat, count in sorted(output["by_platform"].items(), key=lambda x: -x[1]):
        print(f"   [{plat}]: {count}")
    print()
    return output


def _data_score(contest):
    """Score a contest entry by data quality."""
    score = 0
    if contest.get("url", "").startswith("http"):
        score += 3
    prize = contest.get("prize", "")
    if prize and prize != "见官网":
        score += 2
    if contest.get("organizer", "未知") != "未知":
        score += 1
    return score


def _generate_push(data):
    """Generate WeChat-friendly daily push content."""
    contests = data.get("contests", [])
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    lines = [f"🤖 AI 赏金播报 ({today})", f"共 {len(contests)} 个进行中赛事：", ""]

    urgent = []
    upcoming = []
    later = []

    now = datetime.now(timezone.utc)
    for c in contests:
        if not c.get("deadline"):
            later.append(c)
            continue
        try:
            dl = datetime.fromisoformat(c["deadline"])
            if dl.tzinfo is None:
                dl = dl.replace(tzinfo=timezone.utc)
            days_left = (dl - now).days
        except Exception:
            later.append(c)
            continue

        if days_left <= 7:
            urgent.append(c)
        elif days_left <= 30:
            upcoming.append(c)
        else:
            later.append(c)

    if urgent:
        lines.append("🔴 即将截止（7天内）:")
        for c in urgent:
            lines.append(f"  • {c['title']} - {c['prize']}")
        lines.append("")

    if upcoming:
        lines.append("🟡 近期赛事（30天内）:")
        for c in upcoming[:8]:
            lines.append(f"  • {c['title']} - {c['prize']}")
        lines.append("")

    if later:
        lines.append(f"🟢 更多赛事: {len(later)} 个")

    return {
        "date": today,
        "title": f"AI赏金播报：{len(contests)}个赛事进行中",
        "content": "\n".join(lines),
        "total": len(contests),
        "urgent_count": len(urgent),
    }


if __name__ == "__main__":
    run_all()
