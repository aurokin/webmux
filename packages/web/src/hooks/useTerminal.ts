import { useEffect, useRef, useCallback, type RefObject } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import type { WebmuxClient } from '@webmux/client';

/**
 * Manages an xterm.js Terminal instance lifecycle.
 *
 * - Creates and disposes the terminal.
 * - Connects/disconnects the pane data channel.
 * - Wires output events to terminal.write().
 * - Wires terminal.onData to client.sendInput().
 * - Handles resize via FitAddon + ResizeObserver.
 *
 * See docs/web/terminal.md for details.
 */
export function useTerminal(
  client: WebmuxClient,
  paneId: string,
  containerRef: RefObject<HTMLDivElement | null>,
) {
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Create terminal
    const terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: "'Commit Mono', 'JetBrains Mono', 'SF Mono', monospace",
      fontSize: 13,
      lineHeight: 1.2,
      allowProposedApi: true,
      theme: {
        background: 'transparent',
        foreground: '#c8d0e0',
        cursor: '#56d4a0',
        selectionBackground: 'rgba(100, 140, 200, 0.3)',
        black: '#1a1e2e',
        red: '#e06070',
        green: '#56d4a0',
        yellow: '#e8c660',
        blue: '#6cacf0',
        magenta: '#a888e0',
        cyan: '#56c8d0',
        white: '#c8d0e0',
        brightBlack: '#4a5568',
        brightRed: '#f07080',
        brightGreen: '#66e4b0',
        brightYellow: '#f8d670',
        brightBlue: '#7cbcff',
        brightMagenta: '#b898f0',
        brightCyan: '#66d8e0',
        brightWhite: '#e8ecf0',
      },
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebLinksAddon());
    terminal.open(container);
    fitAddon.fit();

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Connect pane data channel
    client.connectPane(paneId);

    // Output: bridge → xterm.js
    const unsubOutput = client.on('pane:output', (id, data) => {
      if (id === paneId) {
        terminal.write(data);
      }
    });

    // Input: xterm.js → bridge
    const inputDisposable = terminal.onData((data) => {
      client.sendInput(paneId, data);
    });

    // Prefix key interception
    terminal.attachCustomKeyEventHandler((event) => {
      if (event.ctrlKey && event.key === 'b' && event.type === 'keydown') {
        return false; // let App handle it
      }
      return true;
    });

    // Resize: container changes → fit → notify bridge
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      client.resizePane(paneId, terminal.cols, terminal.rows);
    });
    resizeObserver.observe(container);

    // Cleanup
    return () => {
      resizeObserver.disconnect();
      inputDisposable.dispose();
      unsubOutput();
      client.disconnectPane(paneId);
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [client, paneId, containerRef]);

  const focus = useCallback(() => {
    terminalRef.current?.focus();
  }, []);

  const blur = useCallback(() => {
    terminalRef.current?.blur();
  }, []);

  return { focus, blur, terminalRef };
}
