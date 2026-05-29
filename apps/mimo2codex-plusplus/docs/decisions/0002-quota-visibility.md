# 0002 — Include quota / plan visibility per key

## Status

Proposed

## Context

Users want more than basic load balancing. They also want to know which key still has quota, which account looks healthy, and which account is likely to hit limits soon.

## Decision

Treat quota visibility as a first-class feature. The system should display:

- remaining quota estimate
- used quota
- plan expiration or billing cycle date when available
- upstream error rate
- cooldown status

## Consequences

- the app becomes more valuable than a plain reverse proxy
- upstream API discovery is required
- some fields may need graceful degradation if the upstream only exposes partial data
