# Architecture — mimo2codex++

`mimo2codex++` is a multi-account gateway designed to sit in front of `mimo2codex`. Its purpose is not to replace the existing Codex adapter, but to add:

- multi-key management
- automatic request distribution
- failure-aware routing
- per-key quota visibility
- simple onboarding for users who only want to paste keys

---

## 1. Product Goal

A user should be able to do the following:

1. Open the app
2. Paste one or more MiMo API keys
3. See each key's status
4. See estimated remaining quota / used quota / expiry or plan info when available
5. Get a one-click Codex configuration snippet
6. Let the app automatically balance requests across healthy keys

---

## 2. System Overview

### 2.1 Frontend
- add / remove keys
- label keys
- show account status
- show quota summary
- show load balancing policy
- copy Codex config snippet

### 2.2 API layer
- key management
- health status
- quota fetch / refresh
- Codex config generation
- runtime settings

### 2.3 Pool Manager
- lifecycle manager for per-key workers
- starts one `mimo2codex` instance per configured key
- stops / restarts instances when keys change
- handles cooldown and recovery

### 2.4 Gateway
- inbound unified URL
- selects a healthy backend instance
- forwards request
- updates runtime metrics on response

### 2.5 Upstream Client
- optional direct MiMo API calls for quota / plan / account usage
- used only for metadata, not for replacing `mimo2codex`

---

## 3. Why reuse `mimo2codex`

Because it already solves the hardest Codex-specific part:

- Responses compatibility
- Codex client expectations
- admin UI
- provider catalog
- docs / packaging

So `mimo2codex++` should focus on orchestration and visibility.

---

## 4. Key Features

## 4.1 Multi-Key Pool
Support multiple keys at once.

Each key becomes one managed backend.

## 4.2 Health Tracking
Track:

- healthy
- unhealthy
- cooling down
- unknown

## 4.3 Quota Visibility
Show per key:

- remaining quota
- used quota
- plan cycle / expiry
- last checked time
- upstream error count

## 4.4 Load Balancing Policies
Start simple:

- round robin
- health-weighted round robin
- cooldown-aware routing

Later:

- least recently used
- concurrency-aware routing
- cost-aware routing

## 4.5 Codex Onboarding
Generate one-click config for:

- `auth.json`
- `config.toml`

So users can connect Codex without manual editing.

---

## 5. Data Model

### Key entry
- id
- label
- key prefix
- host type (pay-as-you-go / token-plan / unknown)
- quota
- used quota
- plan expiry / cycle info
- health status
- cooldown until
- last error
- last quota check time
- instance port
- instance status

### Runtime metrics
- total requests
- success count
- failure count
- 429 count
- timeout count
- average latency
- last failure time

---

## 6. Routing Logic

## 6.1 Default policy
- skip unhealthy keys
- skip keys in cooldown
- prefer healthy keys with more remaining quota
- fall back to any available healthy key

## 6.2 Failure handling
On upstream error:
- mark instance unhealthy temporarily
- start cooldown
- reduce weight in pool
- retry on another healthy instance when possible

## 6.3 Recovery
Periodically:
- re-check health
- re-check quota
- restore key to active pool if stable

---

## 7. Quota Model

The app should expose:

- `quotaTotal`
- `quotaUsed`
- `quotaRemaining`
- `cycleStart`
- `cycleEnd`
- `planName`
- `expiresAt`

If the upstream API only exposes partial data, show what is available and mark the rest as `unknown`.

If quota cannot be fetched, fall back to:
- recent error rate
- cooldown events
- last successful request time

---

## 8. Open Questions

- What exact MiMo API endpoints expose quota / plan / account usage reliably?
- Are there differences between `tp-*` and `sk-*` key reporting?
- Does upstream expose cycle dates, or only token/credit usage?
- Should key storage be encrypted by default in MVP or later?

These can be resolved by inspecting official MiMo docs and reverse-engineering the admin/account API in a safe read-only way.

---

## 9. Packaging Recommendation

For easy open-source adoption:

- simple local web app first
- Docker later
- desktop wrapper later
- Codex / XAgent plugin later if needed

The recommended MVP packaging is:

- local Next.js or Node app
- single command to start
- local config file for keys
- browser-based setup UI

---

## 10. Success Criteria

This project is successful if a user can say:

> "I added five keys, the web app showed which instances were healthy or cooling, it degraded gracefully when quota APIs were unavailable, and Codex still worked through the single gateway."

That is meaningfully more valuable than another single-key adapter.
