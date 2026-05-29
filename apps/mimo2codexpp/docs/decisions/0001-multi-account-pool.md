# 0001 — Multi-account pool over single adapter

## Status

Proposed

## Context

A single `mimo2codex` adapter is already enough to connect MiMo to Codex. However, power users often have multiple API keys or multiple Xiaomi accounts, and they need better concurrency, availability, and observability.

## Decision

Build `mimo2codex++` as a wrapper application that manages multiple keys and multiple backend instances, while reusing `mimo2codex` as the proven Codex-compatible adapter.

## Consequences

- higher availability than single-key setup
- simpler onboarding for non-technical users
- clearer observability per key/account
- more complexity in lifecycle management and health checking
