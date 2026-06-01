"""Devpost - AI hackathons worldwide."""
import re
import requests
from datetime import datetime, timedelta, timezone
from bs4 import BeautifulSoup

PLATFORM = "Devpost"
ORGANIZER = "Devpost"

def scrape():
    now = datetime.now(timezone.utc)
    cutoff = now + timedelta(days=60)
    contests = []
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "text/html",
    }

    for page in range(1, 4):
        try:
            resp = requests.get(
                "https://devpost.com/hackathons",
                params={"search": "ai", "page": page, "status[]": "upcoming"},
                headers=headers, timeout=20
            )
            soup = BeautifulSoup(resp.text, "lxml")
        except Exception as e:
            print(f"  [Devpost] Page {page} failed: {e}")
            break

        items = soup.select("article, .hackathon, .challenge-listing, .hackathon-thumbnail")
        if not items:
            break

        for item in items:
            try:
                title_el = item.select_one("h3, h2, .title")
                if not title_el:
                    continue
                title = title_el.get_text(strip=True)
                text = title.lower()
                if not any(kw in text for kw in [
                    "ai", "artificial intelligence", "ml", "machine learning",
                    "llm", "generative", "agent", "copilot", "gpt",
                    "computer vision", "nlp", "deep learning"
                ]):
                    continue

                link_el = item.select_one("a[href]")
                url = link_el["href"] if link_el else ""
                if url and not url.startswith("http"):
                    url = "https://devpost.com" + url

                prize_el = item.select_one(".prize, .reward")
                prize = prize_el.get_text(strip=True) if prize_el else "见官网"

                deadline_el = item.select_one("time, .deadline")
                deadline_str = deadline_el.get_text(strip=True) if deadline_el else ""
                deadline = _parse_date(deadline_str)
                if not deadline or deadline < now or deadline > cutoff:
                    continue

                slug = re.sub(r'[^a-z0-9]', '_', title.lower())[:40]
                contests.append({
                    "id": f"devpost_{slug}",
                    "title": title,
                    "prize": prize,
                    "category": "AI黑客松",
                    "organizer": ORGANIZER,
                    "url": url,
                    "deadline": deadline.isoformat(),
                    "platform": PLATFORM,
                })
            except Exception:
                continue

    return contests


def _parse_date(text):
    if not text:
        return None
    now = datetime.now(timezone.utc)
    for fmt in ["%b %d, %Y", "%B %d, %Y", "%Y-%m-%d", "%m/%d/%Y"]:
        try:
            return datetime.strptime(text.strip(), fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    m = re.search(r'in\s+(\d+)\s+day', text, re.I)
    if m:
        return now + timedelta(days=int(m.group(1)))
    return None
