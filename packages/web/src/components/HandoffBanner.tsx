import type { WebmuxClient } from '@webmux/client'
import type { Session } from '@webmux/shared'
import type { OwnershipState } from '../hooks/useOwnership'

interface HandoffBannerProps {
  client: WebmuxClient
  activeSession: Session | null
  ownership: OwnershipState
}

export function HandoffBanner({ client, activeSession, ownership }: HandoffBannerProps) {
  if (!activeSession) return null
  if (ownership.mode !== 'passive' && ownership.mode !== 'unclaimed') return null

  const isUnclaimed = ownership.mode === 'unclaimed'
  const ownerLabel =
    ownership.ownerType === 'mobile'
      ? 'mobile device'
      : ownership.ownerType === 'electron'
        ? 'desktop app'
        : 'another client'

  return (
    <div
      data-testid="handoff-banner"
      data-mode={ownership.mode}
      className="absolute top-2 left-2 right-2 bg-bg-elevated/95 border border-border-default rounded-lg px-3 py-2 font-ui text-[12px] text-text-secondary flex flex-wrap items-center justify-center gap-2.5 z-[200] shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-md sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:flex-nowrap sm:px-4 sm:whitespace-nowrap"
    >
      {isUnclaimed ? (
        <>
          <span className="text-sm">🔒</span>
          <span>
            No client is controlling this session — Take Control to interact and resize tmux to your
            viewport
          </span>
        </>
      ) : (
        <>
          <span className="text-sm">📱</span>
          <span>Session active on</span>
          <span className="text-accent-yellow font-medium">{ownerLabel}</span>
          <span className="text-text-tertiary">— Take Control to resize tmux to your viewport</span>
        </>
      )}
      <button
        data-testid="take-control-button"
        onClick={() => client.takeControl(activeSession.id)}
        className="focus-ring px-3 py-1 rounded-sm bg-accent-green text-bg-deep font-semibold text-[11px] cursor-pointer border-none font-ui hover:brightness-110 transition-all"
      >
        Take Control
      </button>
    </div>
  )
}
