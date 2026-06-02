"""
Main aggregator - runs all scrapers, merges, deduplicates, outputs JSON.
Usage: python scrape_all.py [--skip-ai-search]
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


def _data_score(contest):
    """Score a contest entry by data quality."""
    score = 0
    if contest.get("url", "").startswith("http"):
        score += 3
    prize = contest.get("prize", "")
    if prize and prize != "见官网":
        score += 2
    if contest.get("organizer"):
        score += 1
    return score


def _generate_push(output):
    """Generate a push-friendly summary."""
    contests = output.get("contests", [])
    urgent = [c for c in contests if _days_left(c) <= 3]
    soon = [c for c in contests if 3 < _days_left(c) <= 7]
    big = sorted([c for c in contests if c.get("prize_usd", 0) >= 50000],
                 key=lambda x: x.get("prize_usd", 0), reverse=True)[:5]
    return {
        "updated_at": output["updated_at"],
        "total": output["total"],
        "urgent": [_brief(c) for c in urgent],
        "soon": [_brief(c) for c in soon],
        "top_prize": [_brief(c) for c in big],
    }


def _days_left(contest):
    try:
        dl = contest.get("deadline", "")
        if not dl:
            return 999
        dt = datetime.fromisoformat(dl)
        return (dt - datetime.now(timezone.utc)).days
    except:
        return 999


def _brief(c):
    return {
        "title": c.get("title", ""),
        "prize": c.get("prize", ""),
        "deadline": c.get("deadline", "")[:10],
        "url": c.get("url", ""),
        "category": c.get("category", ""),
    }


def run_all():
    print(f"🔍 开始抓取 AI 赛事... ({datetime.now().strftime('%Y-%m-%d %H:%M')})")
    print()

    all_contests = []
    sources = []
    for _, module_name, _ in pkgutil.iter_modules(["sources"]):
        sources.append(module_name)

    skip_ai = "--skip-ai-search" in sys.argv
    for name in sorted(sources):
        try:
            module = importlib.import_module(f"sources.{name}", package=None)
            if skip_ai and name == "ai_search":
                continue
            if not hasattr(module, "scrape"):
                continue
            print(f"  ⏳ 正在抓取 {name}...")
            results = module.scrape()
            print(f"  ✅ {name}: 找到 {len(results)} 个 AI 赛事")
            all_contests.extend(results)
        except Exception as e:
            print(f"  ❌ {name} 失败: {e}")

    # Smart deduplication
    seen = {}
    unique = []
    for c in all_contests:
        key = normalize_for_dedup(c.get("title", ""))
        if not key:
            continue
        if key in seen:
            existing = seen[key]
            c_score = _data_score(c)
            e_score = _data_score(existing)
            if c_score > e_score:
                idx = unique.index(existing)
                unique[idx] = c
                seen[key] = c
        else:
            seen[key] = c
            unique.append(c)

    # Sort by deadline
    unique.sort(key=lambda x: x.get("deadline", "9999"))

    # Add prize_usd if missing
    for c in unique:
        if "prize_usd" not in c:
            c["prize_usd"] = 0

    # Build output
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


if __name__ == "__main__":
    run_all()
