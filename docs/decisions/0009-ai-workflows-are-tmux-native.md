# 0009 AI Workflows Are Tmux-Native

Status: Accepted
Date: 2026-06-06

## Context

AI-heavy workflows are a meaningful direction for webmux, but webmux is still a
tmux-backed product. Agent workflows need a model that improves navigation and
visibility without replacing sessions, windows, panes, ownership, or the bridge
contract.

The rich-pane primitive already exists for upgraded browser-side views. The
remaining question is what AI work maps to normal panes, upgraded panes, and
browser-side UI.

## Decision

AI workflows are additive browser-side workflows over tmux-native state.

- AI agents are represented by tmux sessions, windows, and panes.
- Agent terminal interaction remains a normal tmux pane.
- The web app may derive an agent navigation surface from explicit tmux names
  and a narrow known-agent command allowlist.
- Rich AI surfaces reuse the existing rich-pane primitive. They are appropriate
  for durable artifacts such as local previews, GitHub pull requests, Linear
  issues, dashboards, or generated reports.
- The bridge and client SDK remain generic. They must not bind to one AI backend
  or expose AI-specific protocol messages for this slice.

The initial agent signal is intentionally narrow:

- session or window names prefixed with `agent:` or `ai:`
- pane commands in a small known-agent allowlist

Ordinary shells, editors, empty commands, and broad process-name guesses are not
agent targets. Duplicate labels are disambiguated by their tmux location.

## Consequences

- The ordinary tmux UI remains the complete fallback when no AI context is
  available.
- Users can move between agents faster, but the target remains a tmux
  session/window/pane.
- AI-rich behavior is an annotation of existing rich panes, not a new surface
  type.
- Missing rich-pane state on late join or reconnect is a valid plain tmux
  fallback for this phase.
- Future integrations such as agentscan can provide stronger explicit signals,
  but they should still map back to tmux state and generic pane upgrades.

## Alternatives Considered

- **AI-specific bridge model** - rejected because it couples the backend to one
  workflow category and weakens the generic WebSocket contract.
- **Broad command/process inference** - rejected for the first slice because it
  would create false positives and turn ordinary tmux usage into AI UI.
- **Separate AI surface type** - rejected because rich panes already provide the
  generic upgraded-pane primitive.

## Proof / Harness Impact

- Agent target derivation should be covered by unit tests, including positive
  signals, negative examples, duplicate labels, empty commands, and rich/plain
  states.
- Browser E2E should prove agent navigation without breaking normal tmux
  behavior.
- Rich AI surfaces need E2E coverage plus manual workflow validation, because
  the value is partly navigational and experiential.

## Related Docs

- [overview.md](../architecture/overview.md)
- [implementation-plan.md](../architecture/implementation-plan.md)
- [harnesses.md](../architecture/harnesses.md)
- [stub-protocol.md](../cli/stub-protocol.md)
- [components.md](../web/components.md)
- [0003-split-control-and-pane-data-channels.md](./0003-split-control-and-pane-data-channels.md)
- [0005-bridge-is-consumer-agnostic.md](./0005-bridge-is-consumer-agnostic.md)
