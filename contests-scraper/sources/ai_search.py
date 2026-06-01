"""
AI-powered contest discovery using LLM API.
"""
import json
import re
import requests
from datetime import datetime, timedelta, timezone

PLATFORM = "AI搜索"

ACCOUNTS = [
    {
        "base_url": "https://token-plan-sgp.xiaomimimo.com/v1",
        "api_key": "tp-s9cgbgzivr48i738ga3wo8qxdx124ulci4etk3eegz0cwg7r",
        "model": "mimo-v2.5-pro",
    },
    {
        "base_url": "https://token-plan-cn.xiaomimimo.com/v1",
        "api_key": "tp-cqzum00doz0qkf8tnqmlu8bfimf0hfpmfsk9gef4bxb93nqy",
        "model": "mimo-v2.5-pro",
    },
    {
        "base_url": "https://token-plan-cn.xiaomimimo.com/v1",
        "api_key": "tp-ckmn9x9jwtvoes22k5l8ixzrtqe18bgwszrag31v04fmr5eq",
        "model": "mimo-v2.5-pro",
    },
    {
        "base_url": "https://api.openai-next.com",
        "api_key": "sk-dhYOQqd3zq7GW4d6E98d487a2dFd4214B92788473610202d",
        "model": "gpt-4o-mini",
    },
    {
        "base_url": "https://api.openai-next.com",
        "api_key": "sk-WdnQ1b8LuiCRgCanC7Ec2a2c762d4946Ab14Bc6fCb9eB6F5",
        "model": "gpt-4o-mini",
    },
]

# Shorter prompt to avoid truncation
PROMPT = """列出当前正在进行的AI相关比赛（有奖金，未来2个月截止）。返回JSON数组，每项包含title,prize,category(AI开发/AI黑客松/AI视频),organizer,url,deadline(ISO8601)。只返回JSON，至少10个。"""


def scrape():
    now = datetime.now()
    date_str = now.strftime("%Y-%m-%d")

    for account in ACCOUNTS:
        try:
            result = _query_llm(account, date_str)
            if result:
                return result
        except Exception as e:
            print(f"  [AI搜索] {account['model']}@{account['base_url'][:25]}... failed: {e}")
            continue

    print("  [AI搜索] All accounts failed")
    return []


def _query_llm(account, date_str):
    url = f"{account['base_url']}/chat/completions"
    headers = {
        "Authorization": f"Bearer {account['api_key']}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": account["model"],
        "messages": [
            {"role": "system", "content": f"今天是{date_str}。返回JSON数组。"},
            {"role": "user", "content": PROMPT}
        ],
        "temperature": 0.2,
        "max_tokens": 3000,
        "stream": False,
    }

    resp = requests.post(url, json=payload, headers=headers, timeout=120)
    resp.raise_for_status()

    # Handle possible streaming response
    try:
        data = resp.json()
    except Exception:
        # Try parsing as SSE
        content = _parse_sse(resp.text)
        if not content:
            raise ValueError("Cannot parse response")
        return _parse_contests(content)

    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    if not content:
        return []

    return _parse_contests(content)


def _parse_sse(text):
    """Parse Server-Sent Events format."""
    parts = []
    for line in text.split("\n"):
        if line.startswith("data: ") and line.strip() != "data: [DONE]":
            try:
                chunk = json.loads(line[6:])
                delta = chunk.get("choices", [{}])[0].get("delta", {})
                if "content" in delta:
                    parts.append(delta["content"])
            except Exception:
                continue
    return "".join(parts)


def _parse_contests(content):
    """Parse JSON from LLM response, handling truncation."""
    content = content.strip()

    # Extract from code blocks
    if "```" in content:
        parts = content.split("```")
        for part in parts:
            part = part.strip()
            if part.startswith("json"):
                part = part[4:]
            part = part.strip()
            if part.startswith("["):
                result = _try_parse_json(part)
                if result:
                    return result

    # Try raw content
    if content.startswith("["):
        return _try_parse_json(content)

    return []


def _try_parse_json(text):
    """Try to parse JSON, repairing if truncated."""
    if not text:
        return []

    # Try direct parse first
    try:
        items = json.loads(text)
        if isinstance(items, list):
            return _filter_contests(items)
    except Exception:
        pass

    # Try to repair truncated JSON
    # Find all complete objects
    objects = []
    depth = 0
    start = -1
    for i, ch in enumerate(text):
        if ch == '{':
            if depth == 0:
                start = i
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0 and start >= 0:
                try:
                    obj = json.loads(text[start:i+1])
                    objects.append(obj)
                except Exception:
                    pass
                start = -1

    if objects:
        return _filter_contests(objects)

    return []


def _filter_contests(items):
    """Filter and format contest entries."""
    now = datetime.now(timezone.utc)
    cutoff = now + timedelta(days=60)
    contests = []

    for item in items:
        if not isinstance(item, dict):
            continue
        try:
            title = item.get("title", "")
            if not title:
                continue

            deadline_str = item.get("deadline", "")
            if not deadline_str:
                continue
            deadline = datetime.fromisoformat(deadline_str)
            if deadline.tzinfo is None:
                deadline = deadline.replace(tzinfo=timezone(timedelta(hours=8)))
            if deadline < now or deadline > cutoff:
                continue

            slug = f"ai_{hash(title) % 100000:05d}"
            contests.append({
                "id": f"aisearch_{slug}",
                "title": title,
                "prize": item.get("prize", "见官网"),
                "category": item.get("category", "AI开发"),
                "organizer": item.get("organizer", "未知"),
                "url": item.get("url", ""),
                "deadline": deadline.isoformat(),
                "platform": PLATFORM,
            })
        except Exception:
            continue

    if contests:
        print(f"  [AI搜索] Found {len(contests)} contests via LLM")
    return contests
