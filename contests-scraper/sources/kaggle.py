"""Kaggle - AI/ML competitions with prizes."""
import requests
from datetime import datetime, timedelta, timezone

PLATFORM = "Kaggle"
ORGANIZER = "Google"

def scrape():
    session = requests.Session()
    session.headers["User-Agent"] = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
    try:
        session.get("https://www.kaggle.com/competitions", timeout=15)
        xsrf = session.cookies.get("XSRF-TOKEN", "")
    except Exception as e:
        print(f"  [Kaggle] XSRF failed: {e}")
        return []

    url = "https://www.kaggle.com/api/i/competitions.CompetitionService/ListCompetitions"
    payload = {
        "selector": {
            "competitionIds": [], "listOption": "LIST_OPTION_ACTIVE",
            "sortOption": "SORT_OPTION_NEWEST", "hostSegmentIdFilter": 0,
            "searchQuery": "", "prestigeFilter": "PRESTIGE_FILTER_UNSPECIFIED",
            "tagIds": [], "requireSimulations": False
        },
        "pageToken": "", "pageSize": 100
    }
    try:
        resp = session.post(url, json=payload, headers={"x-xsrf-token": xsrf}, timeout=20)
        data = resp.json()
    except Exception as e:
        print(f"  [Kaggle] API failed: {e}")
        return []

    now = datetime.now(timezone.utc)
    cutoff = now + timedelta(days=60)
    contests = []

    for c in data.get("competitions", []):
        title = c.get("title", "")
        desc = c.get("briefDescription", "")
        tags = [t.get("name", "") for t in c.get("tags", [])]
        text = f"{title} {desc} {' '.join(tags)}".lower()

        # Skip non-AI competitions
        if not any(kw in text for kw in [
            "ai", "machine learning", "deep learning", "neural", "llm", "nlp",
            "computer vision", "multimodal", "generative", "diffusion", "transformer",
            "agent", "rag", "aigc", "llm", "language model"
        ]):
            continue

        deadline_str = c.get("deadline")
        if not deadline_str:
            continue
        deadline = datetime.fromisoformat(deadline_str.replace("Z", "+00:00"))
        if deadline < now or deadline > cutoff:
            continue

        reward = c.get("rewardQuantity", 0)
        comp_name = c.get("competitionName", "")
        prize = f"${reward:,}" if reward else "见官网"

        category = "AI黑客松" if "hack" in text else (
            "AI视频" if any(w in text for w in ["video", "film"]) else "AI开发"
        )

        contests.append({
            "id": f"kaggle_{comp_name}",
            "title": title,
            "prize": prize,
            "category": category,
            "organizer": ORGANIZER,
            "url": f"https://www.kaggle.com/c/{comp_name}",
            "deadline": deadline.isoformat(),
            "platform": PLATFORM,
        })

    return contests
