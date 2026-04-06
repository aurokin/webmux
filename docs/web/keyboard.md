# Keyboard Strategy

The web app runs in a normal browser window (not fullscreen). Most terminal keybinds work without any special handling. A small number of browser-reserved shortcuts conflict, and we handle them with graceful degradation and an optional companion extension.

## Why this works

tmux keybinds use the Ctrl+B prefix. After pressing Ctrl+B, the next key is a plain letter (s, z, c, d, x, %, ", etc.). None of these conflict with any browser shortcut because the prefix key consumes the Ctrl modifier before the action key is pressed.

Terminal application keybinds (Ctrl+C, Ctrl+D, Ctrl+Z, Ctrl+A, Ctrl+E, Ctrl+L, Ctrl+R, arrow keys, etc.) are not reserved by any browser and work without intervention.

## Known conflicts

| Shortcut | Browser action       | Terminal use                 | Impact                                                 |
| -------- | -------------------- | ---------------------------- | ------------------------------------------------------ |
| Ctrl+W   | Close tab            | Vim window prefix            | High for vim users, irrelevant for Claude Code / shell |
| Ctrl+S   | Save page            | Some editors use for save    | Low — most terminal apps don't use it                  |
| Ctrl+T   | New tab              | Rarely used in terminal apps | Low                                                    |
| Ctrl+N   | New window           | Rarely used in terminal apps | Low                                                    |
| Ctrl+Tab | Switch tabs          | tmux doesn't use this        | None                                                   |
| Ctrl+Q   | Quit browser (Linux) | Rarely used                  | Low                                                    |

In practice, **Ctrl+W is the only shortcut that matters**, and only for users running vim inside webmux panes. For Claude Code, shell usage, and most terminal workflows, there are zero conflicts.

## Companion extension (optional, post-v0)

A lightweight browser extension that intercepts conflicting shortcuts and forwards them to the webmux web app when the webmux tab is focused. Browser keybinds are automatically restored when the user switches to any other tab.

### Chrome / Chromium browsers

The extension defines commands in manifest.json for each conflicting shortcut. The user assigns the keybinds once via `chrome://extensions/shortcuts`. This is a one-time setup. Once configured, the extension reliably overrides Ctrl+W etc. in normal windowed mode — no fullscreen required.

The extension cannot programmatically assign these shortcuts. It can open the shortcuts settings page and guide the user through the setup.

### Firefox / Zen

Firefox's `commands` API does not reliably override hard-reserved shortcuts like Ctrl+W. The standard WebExtension approach doesn't work here.

Possible paths:

- **Zen-specific:** Zen has customizable keyboard shortcuts. A "terminal mode" or per-site keyboard override could be proposed to the Zen team. This aligns with Zen's philosophy of browsers as app platforms.
- **Firefox per-site permission:** Firefox has a per-site "Override Keyboard Shortcuts" permission (Page Info → Permissions). This handles some but not all reserved keys.
- **Accept the limitation:** For Zen/Firefox users, Ctrl+W in vim doesn't work. Everything else works fine. This is a documented, known limitation.

### Extension architecture

The extension would live in a separate repo or in a `packages/extension` directory (not a workspace dependency — it has its own build/publish lifecycle). It communicates with the webmux web app via `window.postMessage` or by detecting the webmux page URL and injecting a content script.

The extension is fully optional. The webmux web app must work perfectly without it. The extension only enhances the experience for users who need the conflicting keybinds.

## Prefix key interception

The web app intercepts the prefix key before xterm.js processes it using a global `keydown` listener in the `useKeybinds` hook. When in prefix mode, the next keypress is matched against the user's keybind config and dispatched as an action rather than being sent to the terminal.

The handler uses `matchesPrefix()` from `lib/keybinds.ts` to detect the prefix key and `buildKeyMap()` to resolve the action key to an `ActionId`. Prefix mode expires after 2 seconds if no action key is pressed.

This works identically on all browsers because Ctrl+B (the default prefix) is not a reserved browser shortcut.

## Keybind customization

All keybinds — including the prefix key itself — are fully rebindable via the Settings panel (Keybinds tab). The configuration system lives in `packages/web/src/lib/keybinds.ts`.

### What's customizable

- **Prefix key:** Any key, with or without Ctrl. Default: `Ctrl+B`.
- **Every action key:** Split, close, zoom, window navigation, session switching, sidebar toggle, command palette, settings, session jump (0-9), and detach.
- **Unbinding:** Any action can be unbound entirely (set to `none`).

### How it works

- User overrides are stored in `localStorage` (`webmux:keybinds` for action keys, `webmux:prefix` for the prefix key).
- Only changed keys are persisted — unmodified actions fall back to `DEFAULT_KEYBINDS`.
- The `useKeybinds` hook reads the merged config once at mount via `useMemo` and builds a reverse key-to-action map.
- The command palette dynamically reads display strings from the config, so rebinding a key is immediately reflected in the palette's hints.

### Settings UI

The Keybinds tab provides a click-to-record interface: click a keybind badge, press the desired key, done. Escape unbinds, Backspace cancels. Individual and global reset buttons are available. See `docs/web/design.md` for full UI details.

## Keyboard Lock API (not used)

The Keyboard Lock API (`navigator.keyboard.lock()`) can capture all keys including OS-reserved shortcuts, but it only works during JavaScript-initiated fullscreen mode and is only supported on Chromium browsers (not Firefox/Zen). Since webmux is designed to work in a normal maximized window, and the primary target browser is Zen (Firefox-based), this API is not applicable.
