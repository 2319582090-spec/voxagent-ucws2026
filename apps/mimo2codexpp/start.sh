#!/bin/bash
# mimo2codexpp 启动脚本 - 确保 DATA_DIR 路径正确

set -e

# 项目绝对路径
export PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
export DATA_DIR="$PROJECT_ROOT/data"

echo "🚀 Starting mimo2codexpp..."
echo "   PROJECT_ROOT = $PROJECT_ROOT"
echo "   DATA_DIR     = $DATA_DIR"

# 确保 data 目录存在
mkdir -p "$DATA_DIR"
chmod 755 "$DATA_DIR"

# 进入项目目录（确保 process.cwd() 正确）
cd "$PROJECT_ROOT"

# 启动 Next.js 开发服务器
PORT=4020 npm run dev
