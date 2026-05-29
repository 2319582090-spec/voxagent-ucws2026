# mimo2codexpp

**mimo2codex++**: 小米 MiMo 模型多账号并发网关，提升 Codex 算力上限！

## ✨ 功能特性

- 🚀 **多账号并发**：自动负载均衡，多个 API Key 轮流处理请求
- 📊 **配额可视化**：实时查看每个账号的余量、用量、重置时间
- 🔄 **智能冷却**：429 限流后自动冷却，避免账号失效
- 🎯 **一键配置**：自动生成 Codex 配置文件
- 🛡️ **安全存储**：API Key 加密存储，不上传 Git

## 📦 安装

```bash
# 1. 安装 mimo2codex (前置依赖)
npm install -g mimo2codex

# 2. 克隆本项目
git clone https://github.com/yourusername/New project7.git
cd New project7

# 3. 安装依赖
pnpm install

# 4. 启动网关
cd apps/mimo2codexpp
chmod +x start.sh
./start.sh
```

## 🚀 使用方法

### 1. 添加 API Key

访问 http://127.0.0.1:4020，在 Web UI 中添加你的小米 API Key（支持多个）。

**获取 API Key**：访问 https://platform.moonshot.cn

### 2. 配置 Codex

点击 Web UI 中的 **"生成 Codex 配置"** 按钮，自动配置 `~/.codex/config.toml`。

或者手动配置：

```toml
model_provider = "mimo2codexpp"
base_url = "http://127.0.0.1:4020/v1"
wire_api = "chat"
```

### 3. 启动 Codex

```bash
codex
```

现在 Codex 会通过 mimo2codexpp 网关访问小米模型，自动在多个账号间负载均衡！

## 🧪 并发测试

```bash
bash /tmp/test-concurrent.sh
```

发送 10 个并发请求，观察负载分布。

## 📊 监控

- **Web UI**: http://127.0.0.1:4020
- **API 状态**: http://127.0.0.1:4020/api/pool/status
- **实例列表**: http://127.0.0.1:4020/api/keys

## 🔧 技术架构

```
Codex → mimo2codexpp (端口4020) → mimo2codex 实例1 (端口9102)
                                      → mimo2codex 实例2 (端口9103)
                                      → ...
```

- **并发控制**: `selectAndBegin()` 原子操作，防止 race condition
- **健康检查**: 每分钟自动检测实例状态
- **指数退避**: 实例崩溃后自动重启（最大延迟 30s）

## 📝 配置文件

- **网关配置**: `apps/mimo2codexpp/.env.local`（可选）
- **数据存储**: `apps/mimo2codexpp/data/keys.json`（加密，不上传 Git）
- **Codex 配置**: `~/.codex/config.toml`

## 🔒 安全注意事项

- ✅ `data/` 目录已加入 `.gitignore`，API Key 不会上传
- ✅ API Key 使用 AES-256-GCM 加密存储
- ✅ 网关仅监听 `127.0.0.1`，不暴露到公网

## 🐛 故障排查

### 网关无法启动

```bash
# 检查端口占用
lsof -i :4020

# 查看日志
tail -f /tmp/mimo2codexpp.log
```

### API Key 无效（401 错误）

1. 访问 https://platform.moonshot.cn 确认 Key 有效
2. 检查 Key 是否有权限访问 `mimo-v2.5-pro` 模型
3. 在 Web UI 中删除并重新添加 Key

### 实例启动失败

```bash
# 检查 mimo2codex 是否安装
which mimo2codex

# 手动测试实例
mimo2codex --port 9102 --api-key YOUR_KEY --model mimo
```

## 📄 许可证

MIT License

## 🙏 致谢

- [mimo2codex](https://github.com/yourusername/mimo2codex) - 小米 MiMo 模型的 OpenAI 兼容网关
- [Next.js](https://nextjs.org/) - React 框架
- [Codex](https://github.com/openai/codex) - OpenAI 的 AI 编程助手

---

**⚡ 立即提升你的 Codex 算力上限！**
