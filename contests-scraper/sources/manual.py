"""Manual contests - add AI video/hackathon contests found via social media.

Edit data/manual_contests.json to add entries.
Format per entry:
{
  "title": "比赛名称",
  "prize": "奖金描述",
  "category": "AI视频 / AI黑客松 / AI开发",
  "organizer": "主办方",
  "url": "链接",
  "deadline": "2026-07-01T23:59:00+08:00"
}
"""
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

PLATFORM = "手动添加"

def scrape():
    now = datetime.now(timezone.utc)
    cutoff = now + timedelta(days=60)
    contests = []

    manual_file = Path(__file__).parent.parent / "data" / "manual_contests.json"
    if not manual_file.exists():
        # Create empty template
        manual_file.parent.mkdir(exist_ok=True)
        with open(manual_file, "w", encoding="utf-8") as f:
            json.dump([], f)
        return []

    try:
        with open(manual_file, "r", encoding="utf-8") as f:
            items = json.load(f)
    except Exception:
        return []

    for i, item in enumerate(items):
        deadline_str = item.get("deadline", "")
        if not deadline_str:
            continue
        try:
            deadline = datetime.fromisoformat(deadline_str)
        except Exception:
            continue

        if deadline < now or deadline > cutoff:
            continue

        contests.append({
            "id": f"manual_{i}",
            "title": item.get("title", ""),
            "prize": item.get("prize", "见官网"),
            "category": item.get("category", "AI开发"),
            "organizer": item.get("organizer", "未知"),
            "url": item.get("url", ""),
            "deadline": deadline.isoformat(),
            "platform": PLATFORM,
        })

    return contests
