"""DataFountain (数据竞赛) scraper."""
import requests
from datetime import datetime, timedelta, timezone

PLATFORM = "DataFountain"
ORGANIZER = "中国计算机学会"

def scrape():
    now = datetime.now(timezone.utc)
    cutoff = now + timedelta(days=60)
    contests = []
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        "Accept": "application/json",
    }

    try:
        resp = requests.get(
            "https://www.datafountain.cn/api/competitions",
            params={"status": 1, "page": 1, "pageSize": 30},
            headers=headers, timeout=15
        )
        data = resp.json()
    except Exception as e:
        print(f"  [DataFountain] API failed: {e}")
        return []

    items = data.get("data", {}).get("list", data.get("rows", []))
    if isinstance(data, list):
        items = data

    for item in items:
        title = item.get("title", item.get("name", ""))
        text = title.lower()
        ai_kw = ["ai", "人工智能", "大模型", "机器学习", "深度学习", "nlp",
                  "视觉", "多模态", "llm", "生成", "aigc", "agent"]
        if not any(kw in text for kw in ai_kw):
            continue

        deadline_str = item.get("endTime", item.get("deadline", ""))
        if not deadline_str:
            continue
        try:
            deadline = datetime.fromisoformat(deadline_str.replace("Z", "+00:00"))
        except Exception:
            try:
                deadline = datetime.strptime(deadline_str[:19], "%Y-%m-%dT%H:%M:%S")
                deadline = deadline.replace(tzinfo=timezone(timedelta(hours=8)))
            except Exception:
                continue

        if deadline < now or deadline > cutoff:
            continue

        comp_id = item.get("id", "")
        prize = item.get("bonus", item.get("prize", "见官网"))
        if isinstance(prize, (int, float)):
            prize = f"¥{int(prize):,}"

        contests.append({
            "id": f"datafountain_{comp_id}",
            "title": title,
            "prize": str(prize),
            "category": "AI开发",
            "organizer": ORGANIZER,
            "url": f"https://www.datafountain.cn/competitions/{comp_id}",
            "deadline": deadline.isoformat(),
            "platform": PLATFORM,
        })

    return contests
