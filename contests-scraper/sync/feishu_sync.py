"""
飞书 Bitable 数据同步脚本
将 all.json 中的赛事数据同步到飞书多维表格
"""
import json
import sys
import time
import requests
from datetime import datetime, timezone, timedelta
from pathlib import Path

# ============ 配置 ============
FEISHU_APP_ID = "cli_aa943c65cef81cc6"
FEISHU_APP_SECRET = "6lJ2gJXTdMDBZlHjQyJsDdG6Zl0YWcXS"

# 这两个需要在飞书妙搭建好后填入
# 在飞书妙搭 → 设置 → 多维表格 → 找到 app_token 和 table_id
BITABLE_APP_TOKEN = ""   # 填入: 例如 "bascnXXXXXXXXXX"
BITABLE_TABLE_ID = ""    # 填入: 例如 "tblXXXXXXXXXX"

DATA_FILE = Path(__file__).parent.parent.parent / "public" / "contests" / "all.json"
# ==============================

BASE = "https://open.feishu.cn/open-apis"


def get_token():
    """获取飞书 tenant_access_token"""
    resp = requests.post(f"{BASE}/auth/v3/tenant_access_token/internal", json={
        "app_id": FEISHU_APP_ID,
        "app_secret": FEISHU_APP_SECRET
    })
    data = resp.json()
    if data.get("code") != 0:
        print(f"❌ 获取 token 失败: {data}")
        sys.exit(1)
    return data["tenant_access_token"]


def get_existing_records(token):
    """获取 Bitable 中已有的所有记录"""
    headers = {"Authorization": f"Bearer {token}"}
    records = {}
    page_token = ""
    
    while True:
        params = {"page_size": 500}
        if page_token:
            params["page_token"] = page_token
        
        resp = requests.get(
            f"{BASE}/bitable/v1/apps/{BITABLE_APP_TOKEN}/tables/{BITABLE_TABLE_ID}/records",
            headers=headers, params=params
        )
        data = resp.json()
        
        if data.get("code") != 0:
            print(f"❌ 读取记录失败: {data}")
            break
        
        for item in data.get("data", {}).get("items", []):
            fields = item.get("fields", {})
            name = fields.get("比赛名称", "")
            if name:
                records[name] = item["record_id"]
        
        if not data.get("data", {}).get("has_more"):
            break
        page_token = data["data"]["page_token"]
    
    return records


def prepare_fields(contest):
    """将一条赛事数据转为 Bitable 字段格式"""
    deadline = contest.get("deadline", "")
    deadline_ts = None
    if deadline:
        try:
            dt = datetime.fromisoformat(deadline)
            deadline_ts = int(dt.timestamp() * 1000)  # 飞书要毫秒时间戳
        except:
            pass
    
    update_ts = int(datetime.now(timezone(timedelta(hours=8))).timestamp() * 1000)
    
    fields = {
        "比赛名称": contest.get("title", ""),
        "奖金金额": contest.get("prize", "见官网"),
        "奖金美元数": int(contest.get("prize_usd", 0)),
        "比赛类别": contest.get("category", "AI开发"),
        "主办方": contest.get("organizer", ""),
        "来源平台": contest.get("platform", ""),
        "更新时间": update_ts,
    }
    
    if deadline_ts:
        fields["截止日期"] = deadline_ts
    
    url = contest.get("url", "")
    if url and url.startswith("http"):
        fields["官方链接"] = {"link": url, "text": "🔗 官网"}
    
    return fields


def sync():
    """主同步逻辑：新增、更新、删除过期"""
    print("🔄 开始同步赛事数据到飞书...")
    
    if not BITABLE_APP_TOKEN or not BITABLE_TABLE_ID:
        print("❌ 请先在脚本中填入 BITABLE_APP_TOKEN 和 BITABLE_TABLE_ID")
        print("   获取方式：飞书妙搭 → 设置 → 多维表格 → 复制 app_token 和 table_id")
        sys.exit(1)
    
    # 读取本地数据
    data = json.loads(DATA_FILE.read_text("utf-8"))
    contests = data.get("contests", [])
    print(f"  📊 本地数据: {len(contests)} 条")
    
    token = get_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # 获取已有记录
    existing = get_existing_records(token)
    print(f"  📋 飞书已有: {len(existing)} 条")
    
    # 准备新数据
    new_names = set()
    to_create = []
    to_update = []
    
    for c in contests:
        name = c.get("title", "")
        if not name:
            continue
        new_names.add(name)
        fields = prepare_fields(c)
        
        if name in existing:
            to_update.append({
                "record_id": existing[name],
                "fields": fields
            })
        else:
            to_create.append({"fields": fields})
    
    # 找出过期的（本地没有但飞书有的）
    to_delete = [rid for name, rid in existing.items() if name not in new_names]
    
    # 执行：批量新增
    if to_create:
        print(f"  ➕ 新增 {len(to_create)} 条...")
        for i in range(0, len(to_create), 100):
            batch = to_create[i:i+100]
            resp = requests.post(
                f"{BASE}/bitable/v1/apps/{BITABLE_APP_TOKEN}/tables/{BITABLE_TABLE_ID}/records/batch_create",
                headers=headers, json={"records": batch}
            )
            result = resp.json()
            if result.get("code") != 0:
                print(f"    ❌ 新增失败: {result.get('msg')}")
            else:
                print(f"    ✅ 新增 {len(batch)} 条成功")
            time.sleep(0.5)
    
    # 执行：批量更新
    if to_update:
        print(f"  🔄 更新 {len(to_update)} 条...")
        for i in range(0, len(to_update), 100):
            batch = to_update[i:i+100]
            resp = requests.post(
                f"{BASE}/bitable/v1/apps/{BITABLE_APP_TOKEN}/tables/{BITABLE_TABLE_ID}/records/batch_update",
                headers=headers, json={"records": batch}
            )
            result = resp.json()
            if result.get("code") != 0:
                print(f"    ❌ 更新失败: {result.get('msg')}")
            else:
                print(f"    ✅ 更新 {len(batch)} 条成功")
            time.sleep(0.5)
    
    # 执行：删除过期
    if to_delete:
        print(f"  🗑️ 删除 {len(to_delete)} 条过期数据...")
        for i in range(0, len(to_delete), 100):
            batch = to_delete[i:i+100]
            resp = requests.post(
                f"{BASE}/bitable/v1/apps/{BITABLE_APP_TOKEN}/tables/{BITABLE_TABLE_ID}/records/batch_delete",
                headers=headers, json={"records": batch}
            )
            result = resp.json()
            if result.get("code") != 0:
                print(f"    ❌ 删除失败: {result.get('msg')}")
            else:
                print(f"    ✅ 删除 {len(batch)} 条成功")
            time.sleep(0.5)
    
    print(f"\n✅ 同步完成！新增 {len(to_create)} | 更新 {len(to_update)} | 删除 {len(to_delete)}")


if __name__ == "__main__":
    sync()
