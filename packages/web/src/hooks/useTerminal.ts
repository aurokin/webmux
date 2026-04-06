import { useEffect, useRef, useCallback, type RefObject } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import type { WebmuxClient } from '@webmux/client'
import { usePreferences } from './usePreferences'
import { getTheme } from '../lib/themes'

/**
 * Manages an xterm.js Terminal instance lifecycle.
 *
 * - Creates and disposes the terminal.
 * - Connects/disconnects the pane data channel.
 * - Wires output events to terminal.write().
 * - Wires terminal.onData to client.sendInput().
 * - Handles resize via FitAddon + ResizeObserver.
 * - Reads font/theme from user preferences.
 */
export function useTerminal(
  client: WebmuxClient,
  paneId: string,
  containerRef: RefObject<HTMLDivElement | null>,
) {
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { preferences } = usePreferences()

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const theme = getTheme(preferences.theme)
    const fontFamily = `'${preferences.terminalFont}', 'JetBrains Mono', 'SF Mono', monospace`

    const terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily,
      fontSize: preferences.terminalFontSize,
      lineHeight: 1.2,
      allowProposedApi: true,
      theme: theme.xterm,
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.loadAddon(new WebLinksAddon())
    terminal.open(container)
    fitAddon.fit()

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    // Connect pane data channel
    client.connectPane(paneId)

    const unsubConnection = client.on('connection:status', (status) => {
      if (status === 'connected') {
        client.connectPane(paneId)
      }
    })

    // Output: bridge -> xterm.js
    const unsubOutput = client.on('pane:output', (id, data) => {
      if (id === paneId) {
        terminal.write(data)
      }
    })

    // Input: xterm.js -> bridge
    const inputDisposable = terminal.onData((data) => {
      client.sendInput(paneId, data)
    })

    // Prefix key interception
    terminal.attachCustomKeyEventHandler((event) => {
      if (event.ctrlKey && event.key === 'b' && event.type === 'keydown') {
        return false // let App handle it
      }
      return true
    })

    // Resize: container changes -> fit -> notify bridge
    let lastCols = terminal.cols
    let lastRows = terminal.rows

    const resizeObserver = new ResizeObserver(() => {
      if (resizeTimerRef.current) {
        clearTimeout(resizeTimerRef.current)
      }

      resizeTimerRef.current = setTimeout(() => {
        fitAddon.fit()
        if (terminal.cols === lastCols && terminal.rows === lastRows) {
          return
        }

        lastCols = terminal.cols
        lastRows = terminal.rows
        client.resizePane(paneId, terminal.cols, terminal.rows)
      }, 50)
    })
    resizeObserver.observe(container)

    // Cleanup
    return () => {
      if (resizeTimerRef.current) {
        clearTimeout(resizeTimerRef.current)
        resizeTimerRef.current = null
      }
      resizeObserver.disconnect()
      inputDisposable.dispose()
      unsubOutput()
      unsubConnection()
      client.disconnectPane(paneId)
      terminal.dispose()
      terminalRef.current = null
      fitAddonRef.current = null
    }
  }, [client, paneId, containerRef, preferences.terminalFont, preferences.terminalFontSize, preferences.theme])

  const focus = useCallback(() => {
    terminalRef.current?.focus()
  }, [])

  const blur = useCallback(() => {
    terminalRef.current?.blur()
  }, [])

  return { focus, blur, terminalRef }
}
