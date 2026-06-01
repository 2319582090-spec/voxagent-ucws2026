"""AI Video competition scraper - checks known AI video contest sites."""
import requests
from datetime import datetime, timedelta, timezone
from bs4 import BeautifulSoup

PLATFORM = "AI视频赛"
ORGANIZER = "各平台"

# Known AI video competition aggregation URLs
SOURCES = [
    {
        "name": "B站AI创作赛",
        "url": "https://www.bilibili.com/blackboard/activity-ai-creation",
        "organizer": "哔哩哔哩",
    },
]

def scrape():
    """Check known AI video competition pages."""
    now = datetime.now(timezone.utc)
    cutoff = now + timedelta(days=60)
    contests = []
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    }

    # Since most AI video contests are event-based and change frequently,
    # we scrape known aggregation pages
    # For now, return empty - these are typically tracked manually
    # and added via the manual_contests.json file

    return contests
