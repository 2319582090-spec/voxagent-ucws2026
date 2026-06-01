"""和鲸 (Heywhale) - AI/ML competitions."""
import re
import requests
from datetime import datetime, timedelta, timezone

PLATFORM = "和鲸"
ORGANIZER = "和鲸社区"

def scrape():
    now = datetime.now(timezone.utc)
    cutoff = now + timedelta(days=60)
    contests = []
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": "https://www.heywhale.com/home/competition",
    }

    for page in range(1, 5):
        try:
            resp = requests.get(
                "https://www.heywhale.com/home/competition/ajax",
                params={"page": page, "status": "running"},
                headers=headers, timeout=15
            )
            data = resp.json()
        except Exception as e:
            print(f"  [和鲸] Page {page} failed: {e}")
            break

        items = data.get("data", data.get("competitions", []))
        if not items:
            break

        for item in items:
            title = item.get("title", item.get("name", ""))
            desc = item.get("description", "")
            text = f"{title} {desc}".lower()

            ai_kw = ["ai", "人工智能", "大模型", "机器学习", "深度学习", "nlp",
                      "视觉", "多模态", "agent", "llm", "生成", "aigc"]
            if not any(kw in text for kw in ai_kw):
                continue

            deadline_str = item.get("end_time", item.get("deadline", ""))
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
            prize = item.get("reward", item.get("prize", "见官网"))
            if isinstance(prize, (int, float)):
                prize = f"¥{int(prize):,}"

            contests.append({
                "id": f"heywhale_{comp_id}",
                "title": title,
                "prize": str(prize),
                "category": "AI开发",
                "organizer": ORGANIZER,
                "url": f"https://www.heywhale.com/home/competition/{comp_id}",
                "deadline": deadline.isoformat(),
                "platform": PLATFORM,
            })

    return contests
