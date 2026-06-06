import type { RichPaneState } from '@webmux/client'
import type { Pane, Session } from '@webmux/shared'

const AGENT_NAME_PREFIX_RE = /^(agent|ai):\s*(.+)$/i
const KNOWN_AGENT_COMMANDS = new Set([
  'agentscan',
  'aider',
  'claude',
  'codex',
  'cursor-agent',
  'gemini',
  'opencode',
])

export interface AgentTarget {
  id: string
  testId: string
  label: string
  source: 'session' | 'window' | 'command'
  sessionId: string
  sessionName: string
  windowId: string
  windowIndex: number
  windowName: string
  windowActive: boolean
  paneId: string
  command: string
  richPane: RichPaneState | null
}

export function deriveAgentTargets(
  sessions: Session[],
  richPaneStates: RichPaneState[],
): AgentTarget[] {
  const richPanes = new Map(richPaneStates.map((state) => [state.paneId, state]))
  const targets: AgentTarget[] = []

  for (const session of sessions) {
    const sessionSignal = parseAgentNameSignal(session.name)
    for (const window of session.windows) {
      const windowSignal = parseAgentNameSignal(window.name)
      for (const pane of window.panes) {
        const signal = getPaneAgentSignal({ sessionSignal, windowSignal, pane })
        if (!signal) continue

        const id = `${session.id}:${window.id}:${pane.id}`
        targets.push({
          id,
          testId: toAgentTestId(id),
          label: signal.label,
          source: signal.source,
          sessionId: session.id,
          sessionName: session.name,
          windowId: window.id,
          windowIndex: window.index,
          windowName: window.name,
          windowActive: window.active,
          paneId: pane.id,
          command: pane.currentCommand,
          richPane: richPanes.get(pane.id) ?? null,
        })
      }
    }
  }

  return targets
}

export function formatAgentLocation(target: AgentTarget): string {
  return `${target.sessionName}:${target.windowIndex}.${target.paneId}`
}

function getPaneAgentSignal({
  sessionSignal,
  windowSignal,
  pane,
}: {
  sessionSignal: string | null
  windowSignal: string | null
  pane: Pane
}): { label: string; source: AgentTarget['source'] } | null {
  if (windowSignal) {
    return { label: windowSignal, source: 'window' }
  }

  if (sessionSignal) {
    return { label: sessionSignal, source: 'session' }
  }

  const command = normalizeCommand(pane.currentCommand)
  if (command && KNOWN_AGENT_COMMANDS.has(command)) {
    return { label: command, source: 'command' }
  }

  return null
}

function parseAgentNameSignal(name: string): string | null {
  const match = name.trim().match(AGENT_NAME_PREFIX_RE)
  if (!match) {
    return null
  }

  const label = match[2]?.trim()
  return label || null
}

function normalizeCommand(command: string): string {
  return command.trim().toLowerCase()
}

function toAgentTestId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '')
}
