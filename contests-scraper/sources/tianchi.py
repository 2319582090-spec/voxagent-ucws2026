"""天池 - 阿里 AI competitions."""
import requests
from datetime import datetime, timedelta, timezone

PLATFORM = "天池"
ORGANIZER = "阿里云"

def scrape():
    now = datetime.now(timezone.utc)
    cutoff = now + timedelta(days=60)
    contests = []
    headers = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"}

    for page in range(1, 5):
        try:
            resp = requests.get(
                "https://tianchi.aliyun.com/mobile/api/proxy/competitionService/api/race/listBrief",
                params={"pageNum": page, "pageSize": 20, "state": 1, "userId": -1},
                headers=headers, timeout=15
            )
            items = resp.json().get("data", {}).get("list", [])
        except Exception as e:
            print(f"  [天池] Page {page} failed: {e}")
            break
        if not items:
            break

        for item in items:
            if int(item.get("bonus", 0)) == 0:
                continue

            title = item.get("raceName", "")
            desc = item.get("brief", "")
            text = f"{title} {desc}".lower()

            # Filter AI-only
            ai_kw = ["ai", "人工智能", "大模型", "机器学习", "深度学习", "nlp",
                      "视觉", "多模态", "agent", "智能体", "llm", "生成", "aigc",
                      "扩散", "transformer", "神经网络", "自然语言", "语音", "视频"]
            if not any(kw in text for kw in ai_kw):
                continue

            race_id = item.get("raceId", "")
            deadline_str = item.get("currentSeasonEnd", "")
            if not deadline_str:
                continue
            deadline = datetime.strptime(deadline_str, "%Y-%m-%d %H:%M:%S")
            deadline = deadline.replace(tzinfo=timezone(timedelta(hours=8)))
            if deadline < now or deadline > cutoff:
                continue

            bonus = int(item.get("bonus", 0))
            currency = item.get("currencySymbol", "￥")
            season = item.get("season", 0)

            category = "AI黑客松" if "黑客" in text or "hack" in text else (
                "AI视频" if any(w in text for w in ["视频", "video", "创作"]) else "AI开发"
            )

            contests.append({
                "id": f"tianchi_{race_id}",
                "title": f"{title} (赛季{season + 1})",
                "prize": f"{currency}{bonus:,}",
                "category": category,
                "organizer": ORGANIZER,
                "url": f"https://tianchi.aliyun.com/competition/entrance/{race_id}/introduction",
                "deadline": deadline.isoformat(),
                "platform": PLATFORM,
            })

    return contests
