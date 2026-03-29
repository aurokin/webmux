# Web Components

The web app (`@webmux/web`) is a React application. Here's the component tree and ownership model.

## Component tree

```
App
├── SessionSwitcher          # Overlay: fuzzy-searchable session list
├── Workspace                # The pane layout area
│   ├── PaneColumn           # Vertical stack of panes (maps to tmux layout)
│   │   ├── Pane             # One tmux pane
│   │   │   ├── PaneChrome   # Header: title, path, split/zoom controls
│   │   │   └── Terminal     # xterm.js instance (see terminal.md)
│   │   ├── ResizeHandle     # Horizontal resize between panes
│   │   └── Pane
│   ├── ResizeHandle         # Vertical resize between columns
│   └── PaneColumn
├── StatusBar                # Bottom bar: session name, window tabs, ownership, clock
│   ├── SessionIndicator     # Green dot + session name, opens SessionSwitcher
│   ├── WindowTabs           # List of windows with active indicator
│   └── StatusRight          # Ownership mode, release button, latency, keybind hints
└── HandoffBanner            # Top banner when another client owns the session
```

## State ownership

### What comes from `@webmux/client`

All session/window/pane data flows from the client SDK. The web app does NOT maintain its own model of tmux state. It subscribes to client SDK events and renders accordingly.

```typescript
// In a React context provider
const client = useMuxClient()
const sessions = useSyncExternalStore(client.subscribe, () => client.sessions)
```

### What lives in React state

- **UI state:** which pane is focused and whether the session switcher is open.
- **Layout state:** pane flex ratios after drag-resizing. These are local to the web app — tmux doesn't know about CSS flex. When the user drags a resize handle, we update flex ratios locally AND send a `pane.resize` to the bridge so tmux updates the pane dimensions.
- **Input mode:** direct vs buffered, per pane.

### What lives nowhere (derived)

- Window tab active state: derived from `client.activeWindow`.
- Pane count in status bar: derived from `client.panes.length`.
- Owner status: derived from `client.isOwner()` and `client.getOwnership()`.

## Key components

### Workspace

The most complex component. It takes the pane tree from the client SDK and converts it to nested flex containers. See `docs/web/layout.md` for the conversion algorithm.

Responsibilities:

- Render pane columns and rows based on tmux layout.
- Place resize handles between panes.
- Track flex ratios for drag resize.
- Handle pane focus (click to focus).

### Pane

Wraps a `Terminal` (xterm.js) instance with `PaneChrome` (the header bar). Manages the data channel lifecycle — calls `client.connectPane()` on mount, `client.disconnectPane()` on unmount.

The pane must unmount cleanly: dispose xterm.js instance, disconnect data channel, remove event listeners. Panes mount and unmount frequently as the user switches windows.

### SessionSwitcher

An overlay triggered by clicking the session name in the status bar or pressing `Ctrl+B S`. Shows all sessions from `client.sessions` with fuzzy search. Selecting a session triggers `client.selectSession()`.

Keyboard-navigable: arrow keys to move, Enter to select, Escape to close. Must capture keyboard focus when open and release it on close.

### StatusBar

Static layout with a small amount of ownership behavior. Reads from client SDK state. The window tabs are clickable — each calls `client.selectWindow()`. The session indicator opens the `SessionSwitcher`. The right side shows whether the selected session is `active`, `passive`, or `unclaimed`, and exposes a release button when the current client owns the session.

### HandoffBanner

Shown when the selected session is in passive mode. Displays which client/device currently owns the session. "Take Control" button calls `client.takeControl()`.
