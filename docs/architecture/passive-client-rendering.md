# Passive Client Rendering (Option A)

A single tmux session has one canonical size, set by the active owner. Multiple browser/native clients can attach concurrently. This document describes how passive clients render the owner's view without distortion, and how take-control transitions feel.

## Decisions (locked)

1. **Unclaimed = fully passive.** Sessions with no owner accept no input. Bridge already enforces this via `canSendInput`/`canMutateSession`. The UI must clearly communicate the unclaimed state and present an explicit Take Control affordance. No auto-claim on connect.
2. **Canonical pane dims = tmux's reported `pane_width × pane_height`.** Already in `Pane.cols`/`Pane.rows` from `tmux list-panes`. Broadcast on every `state.sync`. Adaptable to native clients (mobile, electron) — the protocol carries enough information for any client to render at the correct dims.
3. **Letterbox passive rendering.** Passive clients construct xterm at exactly `pane.cols × pane.rows`, skip `FitAddon.fit()`, and a wrapper applies `transform: scale()` to fit the available container. Background bars use `bg-bg-deep` to match the existing pane gap color. Fonts stay crisp at the cost of unused space when aspect ratios diverge.
4. **Take-control transition.** On click: freeze current xterm as a static overlay → bridge resize-window tmux to client dims → wait for first live byte → crossfade overlay out (~200ms) → xterm switches into active mode (FitAddon drives sizing).
5. **No auto-clear after resize.** Apps that handle SIGWINCH (vim, claude code, neovim) reflow naturally. Bare shells with stale wrap behavior stay stale until the user issues `Ctrl+L`.

## Non-decisions deferred for later

- Mobile-specific scale-to-fill (vs letterbox) once we have a real mobile consumer.
- Snapshot pre-roll on initial connect when no owner exists yet (best-effort behavior is fine — the snapshot reflects whatever tmux's last-set dims are).
- Dynamic font resizing for very small viewports.
- Animation polish on the crossfade beyond opacity.

## Implementation steps

### Step 1 — Surface unclaimed state in the UI

**Status:** done

Backend policy is already correct (`canSendInput` returns false for unclaimed sessions). The gap is UI: a passive client connecting to an unclaimed session sees no clear signal that input is being dropped. Add a visible "Take Control to interact" banner/overlay for the unclaimed mode mirroring the existing `HandoffBanner` used for `passive`. Confirm there is no code path that auto-calls `client.takeControl()` on connect.

Files:

- `packages/web/src/components/HandoffBanner.tsx` — render for `unclaimed` mode in addition to `passive`, with appropriate copy.
- `packages/web/src/App.tsx` and any consumers — verify no auto-claim.
- `packages/web/src/hooks/useOwnership.ts` — confirm `mode === 'unclaimed'` semantics; no change expected.

### Step 2 — Confirm `Pane.cols`/`Pane.rows` propagate end-to-end

**Status:** done — `Pane` and `LayoutLeaf` both carry `cols`/`rows`, populated by `tmux list-panes` and the layout parser. No protocol or bridge changes needed.

Shape and bridge query are already in place (`Pane.cols`, `Pane.rows` in shared types; tmux.ts queries `pane_width` and `pane_height`). Verify the values reach the web client through `state.sync`, are exposed by `useSessions`/`useSession`, and are accessible from the `Pane` component. Add a typed accessor if needed.

Files:

- `packages/shared/src/types.ts` — already has the fields.
- `packages/bridge/src/tmux.ts` — already queries them.
- `packages/web/src/hooks/useSession.ts` — verify pane data is reachable for components.
- `packages/web/src/components/Pane.tsx` — confirm we can pull `cols`/`rows` from the pane object. Wire as props if missing.

### Step 3 — Passive rendering with letterbox

**Status:** done

Branch `useTerminal` on owner mode:

- **Active:** existing behavior — xterm sized to container, FitAddon drives `cols × rows`, ResizeObserver fires `resize-pane`.
- **Passive/unclaimed:** xterm constructed at `pane.cols × pane.rows`, no FitAddon. Wrapper computes scale via `Math.min(containerW / xtermW, containerH / xtermH)` and applies `transform: scale(s)`. Wrapper is centered with `bg-bg-deep` letterbox bars.

Files:

- `packages/web/src/hooks/useTerminal.ts` — accept a `mode: 'active' | 'passive'` arg, branch construction and resize logic.
- `packages/web/src/components/Pane.tsx` — pass mode based on `useSessionOwnership`. Add letterbox wrapper that measures container and computes scale.
- New CSS for the letterbox container (likely inline in Pane.tsx via Tailwind).

### Step 4 — Take-control transition

**Status:** done (simplified — no crossfade)

Original plan was a freeze-and-crossfade overlay during the passive→active transition. In practice the overlay introduced a DOM-capture bug (the `transform: scale()` lived on a wrapper, not on the captured `innerHTML`, so the frozen frame rendered at the unscaled owner dims and dominated the viewport). The visual discontinuity it was meant to hide was also minor in practice, so the overlay was removed instead of papering over it with a pane snapshot replay.

Current behavior:

1. User clicks **Take Control** (or the banner's button).
2. `session.takeControl` goes out; bridge resizes tmux to the client's dims once it switches into active mode.
3. `useTerminal` keeps the same xterm instance and pane data channel alive, switches into active mode in place, runs FitAddon, and publishes the new client dims to the bridge.
4. No overlay, no fade, no fallback timer.

The banner copy in `HandoffBanner.tsx` now explicitly frames Take Control as the way to make a too-small letterbox readable (tmux gets resized to the client's viewport), so the UX gap the crossfade was papering over is addressed at the intent level instead.

## Risks and open edges

- **No initial screen replay for late subscribers.** A passive client that joins a quiet pane sees live output only. If we want instant first paint later, it needs a dedicated snapshot protocol rather than `capture-pane` bytes injected into the PTY stream.
- **Multiple passive clients with different aspect ratios.** Each computes its own scale independently. No coordination needed — passive is read-only.
- **Owner xterm vs owner pane dims.** Use pane dims (set by tmux). Owner's xterm dims drive what tmux gets resized to, but once tmux is resized, the pane dims are the truth for everyone.
