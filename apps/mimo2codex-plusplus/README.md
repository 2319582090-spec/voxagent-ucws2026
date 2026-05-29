# mimo2codex++

`mimo2codex++` is a wrapper application around `mimo2codex`, designed for people who have **multiple MiMo API keys / multiple Xiaomi accounts** and want to:

- solve concurrency limits
- reduce the impact of single-key throttling
- provide a simpler onboarding flow for non-technical users
- generate one-click Codex configuration

> Display name: **mimo2codex++**.  
> For npm / folder naming, this scaffold uses **mimo2codex-plusplus**.

## 为什么需要 mimo2codex++？

使用单个小米 Key 时，经常遇到 `429 Too Many Requests` 错误，任务频繁失败。原因是单账号存在并发和速率限制。

### 小米套餐并发上限

| 套餐 | 并发上限 |
|------|----------|
| Lite（39 元） | 5 并发 |
| Standard（99 元） | 20 并发 |
| Pro/Max（329/659 元） | 不设上限* |

*受 TPM 与集群负载约束

### API 速率限制（所有套餐）

| 限制类型 | 默认值 |
|----------|--------|
| RPM（每分钟请求数） | 500 |
| TPM（每分钟 Token） | 100,000 |

超限返回 `429 Too Many Requests`

### mimo2codex++ 的解决方案

通过**多账号并发**，将请求分散到多个 Key，突破单账号的并发上限和 RPM/TPM 限制。

例如：3 个 Standard 套餐账号 = 60 并发 + 1500 RPM + 300K TPM

系统自动处理 429 限流、冷却避让和健康调度。

## Goal

The goal is not to replace `mimo2codex`. The goal is to add a **multi-account pool layer** on top of it:

- multi-key management
- automatic request distribution
- failure-aware key selection
- health checking
- one-click Codex setup generation

## MVP

1. Add multiple MiMo keys through a simple web UI
2. Persist keys locally
3. Persist keys locally with AES-256-GCM encrypted storage
4. Start multiple `mimo2codex` instances, one per key
5. Expose a single frontend gateway URL
6. Distribute requests across healthy instances with health-weighted scheduling, cooldown awareness, and inflight tracking
7. Generate Codex `auth.json` / `config.toml` snippet automatically

## Suggested Architecture

### Web UI
- key list
- add / remove key
- label each key (account name, notes)
- key status: healthy / unhealthy / cooling-down
- one-click copy Codex config
- optional default model selector

### Gateway
- single inbound URL
- route request to an available backend instance
- prefer healthy instance with lowest recent failure rate
- avoid instance that just returned 429 / rate-limit / timeout

### Pool Manager
- per-key worker lifecycle
- start / stop one `mimo2codex` instance per key
- periodic health probe
- exponential backoff on failure
- automatic recovery

## Load Balancing Strategies

### Round Robin
- simplest
- good default

### Least Recently Used
- good when tasks have mixed duration

### Weighted by Health
- reduce traffic to failing keys
- increase traffic to stable keys

### Concurrency Aware
- track in-flight requests
- avoid overloading a single key/account

## Recommended MVP Policy

Start with:

- **health-weighted round robin**
- **cooldown on 429 / upstream error**
- **auto-recover after N seconds**

This covers most real-world needs without overengineering.

## Why this is worth building

The existing `mimo2codex` already solves:

- Codex integration
- protocol compatibility
- admin UI
- provider support

So the valuable layer is not “connect MiMo to Codex again”.

The valuable layer is:

- multi-account operation
- higher availability
- simpler onboarding
- team / power-user usage

This turns the idea from a thin adapter into a **pool gateway**.

## Open-source packaging recommendations

To make this easy to share:

- keep config minimal
- let users paste keys in UI
- persist keys in local config file
- support Docker later
- support desktop wrapper later
- provide a simple `README` with screenshots

## Future features

- per-key usage stats
- rate-limit detection and automatic cooling
- model routing rules
- team mode / shared deployment
- encrypted local key storage
- optional desktop app wrapper
- optional plugin packaging for Codex / XAgent later

## License

TBD. MIT is recommended if this is intended for open-source adoption.
