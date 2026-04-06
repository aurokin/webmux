# Web App Design Spec

This document defines the visual design, layout, interaction patterns, and component behavior for `@webmux/web`. It supersedes any inline styling or component structure from the scaffold-era validation client.

## Design philosophy

The web app should feel like a local tmux session running in the browser. Every design choice starts from "what does tmux do?" and adds web-native enhancements only where they improve clarity, discoverability, or multi-device workflows. Enhancements are opt-in or unobtrusive — a tmux power user should never feel like the web client is fighting them.

## Tech stack

- React + TypeScript
- Tailwind CSS + shadcn/ui for component primitives
- CSS custom properties for theme tokens (Tailwind consumes these)
- xterm.js for terminal rendering

## Layout structure

```
┌──────────────────────────────────────────────────────┐
│ Tab bar (optional, when tab-position = top)          │
├────────────┬─────────────────────────────────────────┤
│            │                                         │
│  Session   │            Pane area                    │
│  sidebar   │         (tmux layout)                   │
│  (cmux     │                                         │
│   style)   │    ┌──────────┬──────────────┐          │
│            │    │  pane 1  │   pane 2     │          │
│            │    │          ├──────────────┤          │
│            │    │          │   pane 3     │          │
│            │    └──────────┴──────────────┘          │
│            │                                         │
├────────────┴─────────────────────────────────────────┤
│ Status bar                                           │
└──────────────────────────────────────────────────────┘
```

Overlays (rendered above everything):
- Session switcher (center-anchored modal)
- Command palette (center-anchored modal)

## Component tree

```
App
├── Sidebar                    # Left: session/pane navigation (cmux-style)
│   ├── SidebarHeader          # "Sessions" label + collapse button
│   ├── SessionList            # All sessions with status dots
│   │   └── SessionItem        # Name, dot (green/yellow/black), window count
│   ├── PaneList               # Panes in selected session
│   │   └── PaneItem           # Pane id, process, status dot
│   └── SidebarFooter          # New session, kill session actions
├── Main                       # Right: everything else
│   ├── TabBar                 # Window tabs (when tab-position = top)
│   │   ├── TabBarLogo         # "webmux" branding
│   │   ├── WindowTab[]        # Index + name + activity dot + close
│   │   ├── TabAdd             # + button for new window
│   │   └── TabBarActions      # Command palette, layout toggle buttons
│   ├── PaneArea               # Flex layout matching tmux geometry
│   │   └── Pane               # One tmux pane
│   │       ├── PaneHeader     # Dot + process + path + hover actions (optional)
│   │       └── Terminal        # xterm.js instance
│   └── StatusBar              # Bottom bar
│       ├── StatusLeft         # Session badge (or window tabs when tab-position = bottom)
│       ├── StatusCenter       # Pane count, process list, prefix hint
│       └── StatusRight        # Connection, latency, ownership, clock
├── SessionSwitcher            # Center modal: fuzzy search, create, kill
├── CommandPalette             # Center modal: grouped tmux commands with keybinds
└── Settings                   # Font picker, background picker, tab position toggle, etc.
```

## Session sidebar (cmux-style)

The primary navigation surface. Designed to stay open during normal use.

### Behavior

- Shows all tmux sessions with status indicators
- Green dot = idle, yellow dot = busy/working, black dot = unknown
- Clicking a session selects it and shows its panes
- Panes within the selected session are listed below
- Keybinds for direct session jumping (like cmux: number keys, or configurable)
- Collapsible: toggle via keybind or button, collapses to hidden (pane area reclaims space)
- Default state: open

### Session item content

```
🟢 webmux                    3 win
🟡 claude_code_upstream       1 win
⚫ dotfiles                   2 win
```

### Pane item content

```
● zsh     ~/projects/webmux
● nvim    src/App.tsx
● htop    system monitor
```

### Actions

- Click session to select
- Click pane to focus
- Sidebar footer: new session button, kill session button
- Keyboard: number keys to jump, or configurable bindings

## Window tabs

Window tabs represent tmux windows within the selected session.

### Position

Configurable: `top` (separate tab bar) or `bottom` (embedded in status bar). Default: `bottom` (matches tmux convention). Setting stored in user preferences.

### Tab bar (top position)

```
[MUX]  | 0 main | 1 server ● | 2 logs |  +  |              [☰] [⌘] [◫]
```

- Logo/branding on the far left
- Tabs show: index + name + optional activity indicator
- Active tab: highlighted background + green bottom border accent
- Hover: close button appears on tab
- `+` button creates new window
- Right side: session panel toggle, command palette, layout buttons

### Status bar (bottom position)

When tabs are in the status bar, they appear in the left/center area:

```
[MAIN] | 0 main | 1 server ● | 2 logs |    ...    | utf-8 | 09:41 | Apr 5
```

## Pane area

Renders the tmux layout tree as nested CSS flex containers, identical to how tmux arranges panes.

### Pane gaps

- 2px gap between panes (CSS gap, not borders)
- Gap area is the resize handle hit target

### Resize handles

- Invisible by default (just the 2px gap)
- On hover: green highlight with subtle glow
- On drag: green highlight sustained, cursor changes to col-resize or row-resize
- Drag updates flex ratios locally for immediate feedback, sends resize to bridge on mouseup

### Focused pane

- Subtle green inset box-shadow: `inset 0 0 0 1px var(--accent-green)`
- Soft glow: `0 0 20px var(--accent-green-glow)`
- Only one pane focused at a time
- Click to focus, or navigate via tmux prefix keys

### Unfocused panes

- No visible border (or very subtle border matching `--border-subtle`)
- Static cursor (no blink)

## Pane headers

Optional, **on by default**. Toggled via user setting.

### Content

```
● zsh  ~/projects/mux-app                          [◨] [◧] [⛶]
```

- Left: colored dot (matches process type or focus state), process name, working path
- Right: action buttons (split horizontal, split vertical, zoom) — hidden by default, visible on pane hover
- Height: 28px
- Background: slightly elevated surface color

### When headers are off

Pane content goes edge-to-edge. Focus is indicated only by the border glow. Process info is available in the sidebar pane list and status bar.

## Status bar

Always visible at the bottom. Dense, tmux-faithful layout.

### Segments

**Left:**
- Session badge: green pill with session name (e.g., `[MAIN]`)
- When tab-position = bottom: window tabs appear here

**Center:**
- Pane count (e.g., `● 3 panes`)
- Running processes (e.g., `■ zsh · nvim · htop`)
- Prefix key hint (e.g., `⌃b prefix`) — useful for onboarding

**Right:**
- Connection status: colored dot + "connected" / "reconnecting" / "offline"
- Latency: e.g., `12ms`
- Ownership mode: `active` (green) / `passive` (yellow) / `unclaimed` (gray)
- Encoding: `utf-8`
- Clock: `09:41`
- Date: `Apr 5`

### Height

36px. Monospace font throughout.

## Session switcher

Center-anchored modal overlay, triggered by keybind (e.g., Ctrl+B s).

### Behavior

- Fuzzy search input at top
- List of all sessions, filtered as you type
- Selected item highlighted
- Match counter (e.g., `8/12`)
- `Enter` = select session (or create new session if no match)
- `Ctrl+N` = always create new session with typed name
- `Ctrl+K` = kill selected session
- `Escape` = close
- Arrow keys = navigate

### Layout

```
┌─────────────────────────────────┐
│ ❯  filter sessions...     ⌃b s │
├─────────────────────────────────┤
│  🟢  webmux              3 win │
│  🟢  claude_code         1 win │
│  🟡  deploy              2 win │
│ ▸⚫  dotfiles             1 win │  ← selected
│  🟢  default             1 win │
│                                 │
│  5/5                            │
├─────────────────────────────────┤
│ ↑↓ navigate  ⏎ select  esc close│
│ ⌃n new  ⌃k kill                │
└─────────────────────────────────┘
```

Width: ~520px. Backdrop blur + dark overlay.

## Command palette

Center-anchored modal overlay, triggered by Ctrl+B : (tmux command prompt equivalent).

### Purpose

Make tmux commands discoverable for users who don't know prefix keys. Grouped by category, each item shows the keybind equivalent.

### Layout

```
┌─────────────────────────────────┐
│ ❯  Type a command...            │
├─────────────────────────────────┤
│ PANES                           │
│  ◨  Split Horizontal    ⌃b "   │
│  ◧  Split Vertical      ⌃b %   │
│  ⛶  Zoom Pane           ⌃b z   │
│  ×  Close Pane           ⌃b x   │
│                                 │
│ WINDOWS                         │
│  +  New Window           ⌃b c   │
│  ↔  Swap Window          ⌃b .   │
│                                 │
│ SESSIONS                        │
│  ☰  List Sessions        ⌃b s   │
│  ⎋  Detach Session       ⌃b d   │
├─────────────────────────────────┤
│ ↑↓ navigate  ⏎ run  esc close  │
└─────────────────────────────────┘
```

Fuzzy filterable. Selecting an item executes the action.

## Theme system

### Token structure

All visual values are CSS custom properties consumed by Tailwind. Swapping themes = swapping one set of variables.

```css
:root {
  /* Backgrounds */
  --bg-deep:      /* deepest background (app chrome) */
  --bg-base:      /* pane background */
  --bg-surface:   /* elevated surfaces (headers, sidebar) */
  --bg-elevated:  /* higher elevation (dropdowns, tooltips) */
  --bg-hover:     /* hover state */

  /* Borders */
  --border-subtle:   /* barely visible separators */
  --border-default:  /* standard borders */
  --border-active:   /* interactive element borders */

  /* Text */
  --text-primary:    /* main content */
  --text-secondary:  /* secondary info */
  --text-tertiary:   /* labels, hints */
  --text-ghost:      /* barely visible, decorative */

  /* Accents */
  --accent-green:    /* primary accent, active states */
  --accent-blue:     /* info, links */
  --accent-yellow:   /* warnings, busy state */
  --accent-red:      /* errors, destructive */
  --accent-purple:   /* decorative */

  /* Functional */
  --accent-green-dim:   /* green at ~12% opacity, for backgrounds */
  --accent-green-glow:  /* green at ~6% opacity, for box-shadows */

  /* Typography */
  --font-mono:  /* terminal + code */
  --font-ui:    /* chrome + labels */

  /* Spacing */
  --pane-gap:    /* gap between panes */
  --status-h:    /* status bar height */
  --tab-h:       /* tab bar height */
  --sidebar-w:   /* sidebar width */
  --radius-sm:   /* small border radius */
  --radius-md:   /* medium border radius */
  --radius-lg:   /* large border radius */
}
```

### Tokyo Night (default theme)

```css
[data-theme="tokyo-night"] {
  --bg-deep:       #0a0a0c;
  --bg-base:       #0f1014;
  --bg-surface:    #161820;
  --bg-elevated:   #1c1f2a;
  --bg-hover:      #242836;
  --border-subtle: rgba(255,255,255,0.04);
  --border-default: rgba(255,255,255,0.08);
  --border-active: rgba(255,255,255,0.15);
  --text-primary:  #e4e4e8;
  --text-secondary: #8b8d98;
  --text-tertiary: #5c5e6a;
  --text-ghost:    #3a3c48;
  --accent-green:  #3dd68c;
  --accent-blue:   #5b9df5;
  --accent-yellow: #f5c542;
  --accent-red:    #f55b5b;
  --accent-purple: #b07df5;
}
```

## Backgrounds

Independent of theme. The user can choose a background style:

- **Solid** (default): uses `--bg-deep` from the active theme
- **Gradient**: subtle radial or linear gradient using theme colors
- **Pattern**: minimal geometric patterns (dots, grid) at very low opacity
- **Custom color**: user-specified hex value

Background selection is stored in user preferences and does not affect theme tokens.

## Typography

### Defaults

- **Terminal content:** JetBrains Mono, 13px, line-height 1.5
- **UI chrome:** DM Sans, variable sizes (10-13px)

### User-selectable

A font picker in settings allows the user to choose from a curated list of monospace fonts for terminal rendering:

- JetBrains Mono (default)
- Fira Code
- Berkeley Mono
- SF Mono
- Commit Mono
- IBM Plex Mono
- Source Code Pro
- Cascadia Code

The selected font applies to all terminal panes. UI chrome font stays fixed (DM Sans).

## User preferences

Stored locally (localStorage), synced to bridge if/when user accounts exist.

| Setting | Default | Options |
|---|---|---|
| Tab position | `bottom` | `top`, `bottom` |
| Pane headers | `on` | `on`, `off` |
| Sidebar open | `true` | `true`, `false` |
| Terminal font | `JetBrains Mono` | (see font list) |
| Terminal font size | `13` | `10`-`20` |
| Theme | `tokyo-night` | (theme list) |
| Background style | `solid` | `solid`, `gradient`, `pattern`, `custom` |
| Background custom color | — | hex value |

## Keybinds

All tmux prefix keys (Ctrl+B + key) work as expected and are intercepted before xterm.js. Web-specific additions:

| Keybind | Action |
|---|---|
| `Ctrl+B s` | Open session switcher |
| `Ctrl+B :` | Open command palette |
| `Ctrl+B b` | Toggle sidebar |
| `Ctrl+B 0-9` | Jump to session by index (sidebar ordering) |
| `Ctrl+B "` | Split horizontal |
| `Ctrl+B %` | Split vertical |
| `Ctrl+B z` | Zoom pane |
| `Ctrl+B x` | Close pane |
| `Ctrl+B c` | New window |
| `Ctrl+B n/p` | Next/previous window |
| `Ctrl+B d` | Detach (close web client) |
| `Escape` | Close any open overlay |

## Keybind customization

All keybinds are fully rebindable from the Settings panel (Keybinds tab). The system is implemented in `packages/web/src/lib/keybinds.ts`.

### Architecture

- **ActionId:** A union type covering every bindable action (`toggleSwitcher`, `splitHorizontal`, `jumpToSession0`..`jumpToSession9`, `settings`, etc.).
- **DEFAULT_KEYBINDS:** A record mapping each `ActionId` to its default key, label, and category.
- **User overrides:** Stored in `localStorage` under `webmux:keybinds` (per-action overrides) and `webmux:prefix` (prefix key config). Only changed keys are stored — missing keys fall back to defaults.
- **buildKeyMap():** Builds a reverse lookup (`Map<key, ActionId>`) used by the keybind handler at runtime.
- **useKeybinds hook:** Reads the config once via `useMemo`, listens for prefix key, then dispatches the matched action.

### Prefix key

The prefix key (default: `Ctrl+B`) is customizable. Users can set any key, with or without Ctrl. The prefix config stores `{ key, ctrl, display }`.

After pressing the prefix key, the user has 2 seconds to press the action key. If the timer expires, prefix mode resets.

### Settings UI

The Keybinds tab in Settings shows:

- **Prefix key** at the top with click-to-record and reset to default
- **Action groups** organized by category (Sessions, Panes, Windows, View)
- **Per-action rows:** Click the current key badge to enter recording mode. A green pulsing "press a key..." badge appears. Press any key to bind, Escape to unbind, Backspace to cancel.
- **Per-action reset:** Appears on hover when a binding differs from the default.
- **Session jump keys (0-9):** Collapsed in a `<details>` element to keep the list clean.
- **Reset all:** Button at the bottom to restore all defaults.

### Command palette integration

The command palette (`CommandPalette.tsx`) dynamically reads keybind display strings from the config system via `getCommands()` in `lib/commands.ts`. Rebinding a key in Settings is immediately reflected in the palette's keybind hints.

### Persistence

All customizations persist in `localStorage` and survive page reloads. There is no server-side sync yet — that would come with user accounts.

## Responsive behavior

For v0, the web app targets desktop browsers (1280px+ viewport). Mobile and tablet layouts are deferred to the mobile consumer phase.

Sidebar collapses automatically below a breakpoint (~900px) and can be toggled back.

## Accessibility

- All interactive elements are keyboard-navigable
- Focus rings on interactive elements
- ARIA labels on icon-only buttons
- Sufficient contrast ratios within each theme
- Reduced motion: respect `prefers-reduced-motion` for animations
