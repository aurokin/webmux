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
      style={{
        position: 'absolute',
        top: 8,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(26, 34, 52, 0.95)',
        border: '1px solid rgba(100, 140, 200, 0.10)',
        borderRadius: 8,
        padding: '8px 16px',
        fontFamily: "'IBM Plex Sans', sans-serif",
        fontSize: 12,
        color: '#7a8698',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        zIndex: 200,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(16px)',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontSize: 14 }}>📱</span>
      <span>Session active on</span>
      <span style={{ color: '#e8c660', fontWeight: 500 }}>
        {ownership.ownerType === 'mobile'
          ? 'mobile device'
          : ownership.ownerType === 'electron'
            ? 'desktop app'
            : 'another client'}
      </span>
      <button
        data-testid="take-control-button"
        onClick={() => {
          client.takeControl(activeSession.id)
        }}
        style={{
          padding: '4px 12px',
          borderRadius: 4,
          background: '#56d4a0',
          color: '#080a10',
          fontWeight: 600,
          fontSize: 11,
          cursor: 'pointer',
          border: 'none',
          fontFamily: "'IBM Plex Sans', sans-serif",
        }}
      >
        Take Control
      </button>
    </div>
  )
}
