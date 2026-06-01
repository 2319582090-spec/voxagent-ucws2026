"""Configuration for AI contest tracker."""
from pathlib import Path

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
PUBLIC_DIR = BASE_DIR.parent / "public" / "contests"

DATA_DIR.mkdir(exist_ok=True)
PUBLIC_DIR.mkdir(parents=True, exist_ok=True)

# Only keep contests with deadline in the next 2 months
MONTHS_AHEAD = 2

# AI keywords for filtering non-AI contests
AI_KEYWORDS = [
    "ai", "artificial intelligence", "机器学习", "深度学习",
    "大模型", "llm", "gpt", "chatgpt", "agent", "rag",
    "diffusion", "stable diffusion", "midjourney", "sora",
    "computer vision", "计算机视觉", "nlp", "自然语言",
    "multimodal", "多模态", "transformer", "neural",
    "生成", "aigc", "copilot", "智能体", "prompt",
    "video generation", "视频生成", "image generation",
    "hackathon", "黑客松",
]

# Output schema (per contest):
# {
#   "id": str,
#   "title": str,          # 比赛名称
#   "prize": str,          # 奖金描述
#   "category": str,       # AI开发/AI黑客松/AI视频/ML竞赛
#   "organizer": str,      # 主办方
#   "url": str,            # 官方链接
#   "deadline": str,       # 截止日期 ISO
#   "platform": str,       # 来源平台
# }

ALL_CONTESTS_FILE = PUBLIC_DIR / "all.json"
DAILY_PUSH_FILE = PUBLIC_DIR / "daily-push.json"
