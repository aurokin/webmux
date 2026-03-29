# Client SDK

`@webmux/client` is the intended framework-agnostic SDK for connecting to the webmux bridge.

This document describes the target SDK shape. The current package source is scaffold material and may not yet expose everything shown below.

## Illustrative API shape

```typescript
import { WebmuxClient } from '@webmux/client';

const client = new WebmuxClient({
  url: 'ws://localhost:7400',
  token: 'abc123...',
  clientId: 'browser-1',
  clientType: 'web',
});

// Connect to bridge
await client.connect();

// Session state (reactive — updates automatically)
client.sessions;          // Session[]
client.connectionIssue;   // 'auth-failed' | 'protocol-error' | null
client.getOwnership(id);  // SessionOwnership | null
client.activeSession;     // Session | null
client.activeWindow;      // Window | null
client.panes;             // Pane[] (of active window)

// Events
client.on('state:sync', (sessions: Session[]) => { ... });
client.on('pane:output', (paneId: string, data: Uint8Array) => { ... });
client.on('pane:added', (pane: Pane) => { ... });
client.on('pane:removed', (paneId: string) => { ... });
client.on('control:changed', (sessionId: string, ownerId: string | null) => { ... });
client.on('connection:status', (status: 'connected' | 'reconnecting' | 'disconnected') => { ... });

// Commands
client.selectWindow(sessionId: string, windowIndex: number);
client.createWindow(sessionId: string);
client.splitPane(paneId: string, direction: 'horizontal' | 'vertical');
client.closePane(paneId: string);
client.resizePane(paneId: string, cols: number, rows: number);
client.takeControl(sessionId: string);
client.releaseControl(sessionId: string);

// Pane I/O
client.connectPane(paneId: string);      // opens data channel WebSocket
client.disconnectPane(paneId: string);   // closes data channel WebSocket
client.sendInput(paneId: string, data: Uint8Array | string);  // write to pane

// Cleanup
client.disconnect();
```

Treat the snippet above as example consumer code, not an authoritative statement that every property or method already exists in `packages/client`.

## Design constraints

### Framework-agnostic

The implemented SDK should not import React, Vue, Angular, xterm.js, or any DOM API. It should run in any JavaScript environment that has WebSocket support (browsers, Node, Bun, React Native).

### Typed events

The event emitter is strongly typed. Adding a new event requires updating the event map type — the compiler enforces that all listeners receive the correct payload types.

### Input accepts both bytes and strings

`sendInput()` accepts `Uint8Array` (single keystrokes, raw bytes) and `string` (full lines for buffered mode). This is by design — see `docs/architecture/latency.md` for why buffered mode needs string input.

### No rendering logic

The client SDK does not know what xterm.js is. It emits `pane:output` events with raw bytes. The consumer decides what to do with them (feed to xterm.js, write to a log, discard, whatever).

### No layout logic

The client SDK does not know about CSS flex, pane positions, or resize handles. It reports pane dimensions as cols/rows. The consumer handles spatial layout.
