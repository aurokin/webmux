import type { ITerminalOptions, Terminal } from '@xterm/xterm'

export interface TerminalRuntimeOptions {
  fontFamily: string
  fontSize: number
  theme: NonNullable<ITerminalOptions['theme']>
}

/**
 * Update only runtime-safe xterm options. Constructor-only fields like
 * cols/rows must continue to flow through Terminal() or terminal.resize().
 */
export function applyRuntimeTerminalOptions(
  terminal: Pick<Terminal, 'options'>,
  options: TerminalRuntimeOptions,
) {
  terminal.options.fontFamily = options.fontFamily
  terminal.options.fontSize = options.fontSize
  terminal.options.theme = options.theme
}
