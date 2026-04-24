# Shared Gotchas

Things that cause quiet cross-package drift.

## Shared is the contract, not a convenience bucket

`@webmux/shared` should hold protocol types, message schemas, constants, and other consumer-safe contract definitions.

Do not add:

- bridge helpers
- web-specific UI helpers
- client runtime state machines
- anything that pulls shared toward a real dependency graph center

## Versioning matters more than shape

Adding a field is easy. Preserving meaning across bridge and clients is the hard part.

When you change a message or shared type:

- update the protocol doc if the wire contract changed
- update or add the smallest harness that proves both sides still agree
- think about older consumers and reconnect semantics, not just local TypeScript compile success

## Types can lie if docs drift

A type existing in `shared` does not prove the bridge emits it or that every consumer uses it correctly.

The implementation plan remains the source of truth for what is actually shipped.

## Dependency direction is the guardrail

`shared` imports from nothing. Once that boundary softens, every other package gets harder to reason about.
