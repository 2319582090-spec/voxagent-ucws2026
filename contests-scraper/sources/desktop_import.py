"""
Import contests from ~/Desktop/AI每日掘金 folder.
Reads the curated competition list and merges into the main dataset.
"""
import re
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

PLATFORM = "AI掘金"

DESKTOP_DIR = Path.home() / "Desktop" / "AI每日掘金"


def scrape():
    """Read contests from desktop AI每日掘金 files."""
    contests = []
    now = datetime.now(timezone.utc)
    cutoff = now + timedelta(days=60)

    # Read from 可参赛清单 files
    for md_file in DESKTOP_DIR.glob("可参赛清单*.md"):
        contests.extend(_parse_md_table(md_file, now, cutoff))

    # Read from date-stamped folders
    for date_dir in sorted(DESKTOP_DIR.iterdir()):
        if not date_dir.is_dir():
            continue
        if not re.match(r"\d{4}-\d{2}-\d{2}", date_dir.name):
            continue
        for md_file in date_dir.glob("AI*掘金*.md"):
            contests.extend(_parse_freeform(md_file, now, cutoff))
        for md_file in date_dir.glob("AI赛事*.md"):
            contests.extend(_parse_freeform(md_file, now, cutoff))

    # Also read the 完整清单 from AI赛事提示词
    prompts_dir = DESKTOP_DIR / "AI赛事提示词"
    if prompts_dir.exists():
        for md_file in prompts_dir.glob("AI赛事完整清单*.md"):
            contests.extend(_parse_freeform(md_file, now, cutoff))

    return contests


def _parse_md_table(path, now, cutoff):
    """Parse markdown table format (可参赛清单)."""
    contests = []
    try:
        text = path.read_text("utf-8")
    except Exception:
        return []

    for line in text.split("\n"):
        # Table rows: | 比赛 | 奖金 | 截止 | 入口 | 形态 | 备注 |
        if not line.startswith("|") or "比赛" in line or "---" in line:
            continue
        cols = [c.strip() for c in line.split("|")[1:-1]]
        if len(cols) < 4:
            continue

        title = cols[0].strip()
        prize = cols[1].strip()
        deadline_str = cols[2].strip()
        url = cols[3].strip()

        if not title or title == "比赛":
            continue

        deadline = _parse_deadline(deadline_str)
        if not deadline or deadline < now or deadline > cutoff:
            continue

        if not url.startswith("http"):
            url = ""

        category = _detect_category(title)
        organizer = _detect_organizer(title, url)

        contests.append({
            "id": f"desktop_{hash(title) % 100000:05d}",
            "title": title,
            "prize": prize,
            "category": category,
            "organizer": organizer,
            "url": url,
            "deadline": deadline.isoformat(),
            "platform": PLATFORM,
        })

    return contests


def _parse_freeform(path, now, cutoff):
    """Parse freeform markdown with 比赛:/奖金:/链接: format."""
    contests = []
    try:
        text = path.read_text("utf-8")
    except Exception:
        return []

    # Split by blocks
    blocks = re.split(r"\n(?=- 奖金|##)", text)
    for block in blocks:
        name_m = re.search(r"(?:比赛|名称)[：:]\s*(.+?)(?:\n|$)", block)
        prize_m = re.search(r"奖金[：:]\s*(.+?)(?:\n|$)", block)
        url_m = re.search(r"(?:链接|入口|url)[：:]\s*(https?://\S+)", block)
        if not url_m:
            url_m = re.search(r"(https?://\S+)", block)

        if not name_m:
            continue

        title = name_m.group(1).strip()
        prize = prize_m.group(1).strip() if prize_m else "见官网"
        url = url_m.group(1).strip() if url_m else ""

        # Find deadline
        deadline = None
        for m in re.finditer(r"(\d{4})年(\d{1,2})月(\d{1,2})日", block):
            try:
                dt = datetime(int(m[1]), int(m[2]), int(m[3]))
                dt = dt.replace(tzinfo=timezone(timedelta(hours=8)))
                if dt >= now and dt <= cutoff:
                    deadline = dt
            except Exception:
                continue
        if not deadline:
            for m in re.finditer(r"(\d{1,2})月(\d{1,2})日", block):
                try:
                    dt = datetime(now.year, int(m[1]), int(m[2]))
                    dt = dt.replace(tzinfo=timezone(timedelta(hours=8)))
                    if dt >= now and dt <= cutoff:
                        deadline = dt
                except Exception:
                    continue
        if not deadline:
            # Try ~2026-06-中旬 format
            m = re.search(r"~?(\d{4})-(\d{2})-(.+?)(?:\n|$)", block)
            if m:
                try:
                    year, month = int(m[1]), int(m[2])
                    day_part = m[3].strip()
                    if "中旬" in day_part:
                        day = 15
                    elif "下旬" in day_part:
                        day = 25
                    else:
                        day = int(re.search(r"\d+", day_part).group()) if re.search(r"\d+", day_part) else 15
                    dt = datetime(year, month, day)
                    dt = dt.replace(tzinfo=timezone(timedelta(hours=8)))
                    if dt >= now and dt <= cutoff:
                        deadline = dt
                except Exception:
                    pass

        if not deadline:
            continue

        contests.append({
            "id": f"desktop_{hash(title) % 100000:05d}",
            "title": title,
            "prize": prize,
            "category": _detect_category(title),
            "organizer": _detect_organizer(title, url),
            "url": url,
            "deadline": deadline.isoformat(),
            "platform": PLATFORM,
        })

    return contests


def _parse_deadline(text):
    """Parse deadline from various formats."""
    now = datetime.now()
    # ~2026-06-11
    m = re.search(r"~?(\d{4})-(\d{2})-(\d{2})", text)
    if m:
        try:
            return datetime(int(m[1]), int(m[2]), int(m[3]), tzinfo=timezone(timedelta(hours=8)))
        except Exception:
            pass
    # ~2026-06-中旬
    m = re.search(r"~?(\d{4})-(\d{2})-(.+)", text)
    if m:
        try:
            year, month = int(m[1]), int(m[2])
            day_part = m[3].strip()
            if "中旬" in day_part:
                day = 15
            elif "下旬" in day_part:
                day = 25
            else:
                day = int(re.search(r"\d+", day_part).group()) if re.search(r"\d+", day_part) else 15
            return datetime(year, month, day, tzinfo=timezone(timedelta(hours=8)))
        except Exception:
            pass
    # 6月14日
    m = re.search(r"(\d{1,2})月(\d{1,2})日", text)
    if m:
        try:
            return datetime(now.year, int(m[1]), int(m[2]), tzinfo=timezone(timedelta(hours=8)))
        except Exception:
            pass
    return None


def _detect_category(title):
    t = title.lower()
    if any(w in t for w in ["视频", "video", "电影", "film", "短剧", "动画", "创作大赛", "漫剧"]):
        return "AI视频"
    if any(w in t for w in ["hackathon", "hack", "黑客松"]):
        return "AI黑客松"
    return "AI开发"


def _detect_organizer(title, url):
    t = (title + " " + url).lower()
    if "kaggle" in t: return "Kaggle"
    if "tianchi" in t or "天池" in t: return "阿里云"
    if "devpost" in t: return "Devpost"
    if "google" in t: return "Google"
    if "bilibili" in t or "b站" in t: return "哔哩哔哩"
    if "tencent" in t or "腾讯" in t: return "腾讯"
    if "uipath" in t: return "UiPath"
    if "xprize" in t: return "XPRIZE"
    if "hkaiiff" in t: return "HKAIIFF"
    if "arcprize" in t: return "ARC Prize"
    if "clickhouse" in t: return "ClickHouse"
    if "aibetas" in t: return "AI贝塔斯"
    return "未知"
