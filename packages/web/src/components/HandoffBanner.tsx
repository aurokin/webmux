import type { WebmuxClient } from '@webmux/client'
import type { Session } from '@webmux/shared'
import type { OwnershipState } from '../hooks/useOwnership'

interface HandoffBannerProps {
  client: WebmuxClient
  activeSession: Session | null
  ownership: OwnershipState
}

export function HandoffBanner({ client, activeSession, ownership }: HandoffBannerProps) {
  if (!activeSession || ownership.mode !== 'passive') return null

  return (
    <div
      data-testid="handoff-banner"
      className="absolute top-2 left-1/2 -translate-x-1/2 bg-bg-elevated/95 border border-border-default rounded-lg px-4 py-2 font-ui text-[12px] text-text-secondary flex items-center gap-2.5 z-[200] shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-md whitespace-nowrap"
    >
      <span className="text-sm">📱</span>
      <span>Session active on</span>
      <span className="text-accent-yellow font-medium">
        {ownership.ownerType === 'mobile'
          ? 'mobile device'
          : ownership.ownerType === 'electron'
            ? 'desktop app'
            : 'another client'}
      </span>
      <button
        data-testid="take-control-button"
        onClick={() => client.takeControl(activeSession.id)}
        className="px-3 py-1 rounded-sm bg-accent-green text-bg-deep font-semibold text-[11px] cursor-pointer border-none font-ui hover:brightness-110 transition-all"
      >
        Take Control
      </button>
    </div>
  )
}
