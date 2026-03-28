# Terminal Integration (xterm.js)

Each pane renders an xterm.js `Terminal` instance. This doc covers how xterm.js connects to the webmux data flow.

## Setup

```typescript
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';

const terminal = new Terminal({
  cursorBlink: true,
  cursorStyle: 'block',
  fontFamily: "'Commit Mono', 'JetBrains Mono', monospace",
  fontSize: 13,
  lineHeight: 1.2,
  theme: {
    background: 'transparent',  // pane background shows through
    // ... color scheme matching the webmux UI
  },
});

terminal.loadAddon(new FitAddon());
terminal.loadAddon(new WebLinksAddon());
terminal.open(containerElement);
fitAddon.fit();
```

## Data flow

### Output (bridge → screen)

```typescript
client.on('pane:output', (paneId: string, data: Uint8Array) => {
  if (paneId === currentPaneId) {
    terminal.write(data);
  }
});
```

`terminal.write()` accepts `Uint8Array` directly. xterm.js parses escape sequences, handles cursor positioning, alternate screen mode, colors — everything. We don't process the data at all.

### Input (keyboard → bridge)

```typescript
terminal.onData((data: string) => {
  client.sendInput(paneId, data);
});
```

`onData` fires for every keystroke, including special keys (arrow keys emit escape sequences like `\x1b[A`). We pass them straight through.

### Resize

```typescript
// When the pane container resizes (window resize, drag handle, etc.)
const resizeObserver = new ResizeObserver(() => {
  fitAddon.fit();
  const { cols, rows } = terminal;
  client.resizePane(paneId, cols, rows);
});
resizeObserver.observe(containerElement);
```

`fitAddon.fit()` recalculates how many cols/rows fit in the container and resizes the terminal. We then tell the bridge the new dimensions, which triggers a tmux pane resize and `SIGWINCH`.

## Lifecycle

### Mount

1. Create `Terminal` instance.
2. Load addons.
3. Open terminal in container element.
4. Fit to container.
5. Call `client.connectPane(paneId)` to open data channel.
6. Subscribe to `pane:output` events.
7. Attach `onData` listener for input.
8. Set up `ResizeObserver` for dynamic resizing.

### Unmount

1. Unsubscribe from `pane:output` events.
2. Remove `onData` listener.
3. Disconnect `ResizeObserver`.
4. Call `client.disconnectPane(paneId)`.
5. Call `terminal.dispose()`.

This happens when the user switches windows (old panes unmount, new panes mount) or when a pane is closed.

### Important: dispose everything

xterm.js leaks memory if not properly disposed. Every addon, every listener, every observer must be cleaned up. The `useTerminal` hook should return a cleanup function that handles all of this.

## Focus

Only one pane is focused at a time. The focused pane:
- Has a visible border highlight.
- Receives keyboard input (xterm.js `terminal.focus()`).
- Has a blinking cursor.

Unfocused panes show a static cursor and do not capture keyboard events.

When the user clicks a pane, the web app calls `terminal.focus()` on the clicked pane and `terminal.blur()` on the previously focused pane.

## Prefix key interception

`Ctrl+B` is the tmux prefix. The web app must intercept it before xterm.js processes it:

```typescript
terminal.attachCustomKeyEventHandler((event: KeyboardEvent) => {
  if (event.ctrlKey && event.key === 'b') {
    enterPrefixMode();
    return false;  // prevent xterm.js from processing this key
  }
  if (inPrefixMode) {
    handlePrefixKey(event.key);
    return false;
  }
  return true;  // let xterm.js handle normally
});
```

Prefix mode keys (`s` for session switcher, `z` for zoom, `"` for split, etc.) are handled by the web app, not sent to the terminal.

## Theme

The xterm.js theme should match the webmux UI. Colors are defined as CSS variables and passed to xterm.js's theme option. When the user changes themes (future), both the UI chrome and the terminal colors update together.

Background should be transparent so the pane's background (which may include the atmospheric gradient) shows through slightly, matching the aesthetic of the user's terminal setup.
