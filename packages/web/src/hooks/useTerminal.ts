import { useEffect, useRef, useCallback, type RefObject } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import type { WebmuxClient } from '@webmux/client'
import { usePreferences } from './usePreferences'
import { getTheme } from '../lib/themes'
import { getPassivePaneSize, type TerminalMode } from './terminalSizing'
import { applyRuntimeTerminalOptions } from './terminalOptions'

export type { TerminalMode } from './terminalSizing'

/**
 * Manages an xterm.js Terminal instance lifecycle.
 *
 * - Active mode: FitAddon drives sizing from the container; ResizeObserver fires resize-pane.
 * - Passive mode: terminal is constructed at the canonical pane dims (driven by the owner)
 *   and never refits; the parent renders it inside a transform-scale letterbox.
 */
export function useTerminal(
  client: WebmuxClient,
  paneId: string,
  containerRef: RefObject<HTMLDivElement | null>,
  mode: TerminalMode,
  paneDims: { cols: number; rows: number },
) {
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const modeRef = useRef(mode)
  const { preferences } = usePreferences()
  modeRef.current = mode

  const resizeActiveTerminal = useCallback(
    (terminal: Terminal, fitAddon: FitAddon) => {
      const prevCols = terminal.cols
      const prevRows = terminal.rows
      fitAddon.fit()
      if (terminal.cols === prevCols && terminal.rows === prevRows) {
        return
      }

      client.resizePane(paneId, terminal.cols, terminal.rows)
    },
    [client, paneId],
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const theme = getTheme(preferences.theme)
    const fontFamily = `'${preferences.terminalFont}', 'JetBrains Mono', 'SF Mono', monospace`
    const passivePaneSize = getPassivePaneSize(mode, paneDims)

    const terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily,
      fontSize: preferences.terminalFontSize,
      lineHeight: 1.2,
      allowProposedApi: true,
      theme: theme.xterm,
      cols: passivePaneSize?.cols,
      rows: passivePaneSize?.rows,
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.loadAddon(new WebLinksAddon())
    terminal.open(container)

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    client.connectPane(paneId)

    const unsubConnection = client.on('connection:status', (status) => {
      if (status === 'connected') {
        client.connectPane(paneId)
      }
    })

    const unsubOutput = client.on('pane:output', (id, data) => {
      if (id === paneId) {
        terminal.write(data)
      }
    })

    const inputDisposable = terminal.onData((data) => {
      if (modeRef.current === 'passive') return
      client.sendInput(paneId, data)
    })

    terminal.attachCustomKeyEventHandler((event) => {
      if (event.ctrlKey && event.key === 'b' && event.type === 'keydown') {
        return false
      }
      return true
    })

    return () => {
      if (resizeTimerRef.current) {
        clearTimeout(resizeTimerRef.current)
        resizeTimerRef.current = null
      }
      inputDisposable.dispose()
      unsubOutput()
      unsubConnection()
      client.disconnectPane(paneId)
      terminal.dispose()
      terminalRef.current = null
      fitAddonRef.current = null
    }
  }, [
    client,
    paneId,
    containerRef,
  ])

  useEffect(() => {
    const terminal = terminalRef.current
    const fitAddon = fitAddonRef.current
    if (!terminal) {
      return
    }

    const theme = getTheme(preferences.theme)
    const fontFamily = `'${preferences.terminalFont}', 'JetBrains Mono', 'SF Mono', monospace`
    applyRuntimeTerminalOptions(terminal, {
      fontFamily,
      fontSize: preferences.terminalFontSize,
      theme: theme.xterm,
    })

    if (mode === 'active' && fitAddon) {
      resizeActiveTerminal(terminal, fitAddon)
    }
  }, [
    mode,
    preferences.terminalFont,
    preferences.terminalFontSize,
    preferences.theme,
    resizeActiveTerminal,
  ])

  useEffect(() => {
    const terminal = terminalRef.current
    const fitAddon = fitAddonRef.current
    const container = containerRef.current
    if (!terminal || !fitAddon || !container || mode !== 'active') {
      return
    }

    resizeActiveTerminal(terminal, fitAddon)

    const resizeObserver = new ResizeObserver(() => {
      if (resizeTimerRef.current) {
        clearTimeout(resizeTimerRef.current)
      }

      resizeTimerRef.current = setTimeout(() => {
        resizeActiveTerminal(terminal, fitAddon)
      }, 50)
    })

    resizeObserver.observe(container)

    return () => {
      if (resizeTimerRef.current) {
        clearTimeout(resizeTimerRef.current)
        resizeTimerRef.current = null
      }
      resizeObserver.disconnect()
    }
  }, [containerRef, mode, resizeActiveTerminal])

  useEffect(() => {
    const terminal = terminalRef.current
    if (!terminal) {
      return
    }

    const passivePaneSize = getPassivePaneSize(mode, paneDims)
    if (!passivePaneSize) {
      return
    }

    if (terminal.cols === passivePaneSize.cols && terminal.rows === passivePaneSize.rows) {
      return
    }

    terminal.resize(passivePaneSize.cols, passivePaneSize.rows)
  }, [mode, paneDims.cols, paneDims.rows])

  const focus = useCallback(() => {
    terminalRef.current?.focus()
  }, [])

  const blur = useCallback(() => {
    terminalRef.current?.blur()
  }, [])

  return { focus, blur, terminalRef }
}
