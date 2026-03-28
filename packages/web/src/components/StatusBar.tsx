import type { WebmuxClient } from '@webmux/client';
import type { Session, Window } from '@webmux/shared';

interface StatusBarProps {
  client: WebmuxClient;
  activeSession: Session | null;
  activeWindow: Window | null;
  onOpenSwitcher: () => void;
}

export function StatusBar({ client, activeSession, activeWindow, onOpenSwitcher }: StatusBarProps) {
  return (
    <div style={{
      height: 30,
      background: 'rgba(18, 24, 38, 0.92)',
      borderTop: '1px solid rgba(100, 140, 200, 0.06)',
      display: 'flex',
      alignItems: 'center',
      fontSize: 11.5,
      fontFamily: "'Commit Mono', monospace",
      flexShrink: 0,
      userSelect: 'none',
      backdropFilter: 'blur(20px)',
    }}>
      {/* Session indicator */}
      <div
        onClick={onOpenSwitcher}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '0 14px',
          height: '100%',
          background: 'rgba(86, 212, 160, 0.12)',
          borderRight: '1px solid rgba(100, 140, 200, 0.06)',
          color: '#56d4a0',
          fontWeight: 700,
          fontSize: 11,
          cursor: 'pointer',
        }}
      >
        <div style={{
          width: 7, height: 7, borderRadius: '50%',
          background: '#56d4a0',
          boxShadow: '0 0 6px rgba(86, 212, 160, 0.12)',
        }} />
        {activeSession?.name ?? 'no session'}
      </div>

      {/* Window tabs */}
      <div style={{ display: 'flex', alignItems: 'stretch', height: '100%' }}>
        {activeSession?.windows.map((win) => (
          <div
            key={win.id}
            onClick={() => client.selectWindow(activeSession.id, win.index)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '0 14px',
              height: '100%',
              color: win.active ? '#c8d0e0' : '#4a5568',
              background: win.active ? 'rgba(26, 34, 52, 0.95)' : 'transparent',
              cursor: 'pointer',
              borderRight: '1px solid rgba(100, 140, 200, 0.06)',
              transition: 'color 0.12s, background 0.12s',
            }}
          >
            {win.active && <span style={{ fontSize: 9, color: '#56d4a0' }}>❯</span>}
            <span style={{ fontSize: 10, color: '#2d3748' }}>{win.index}</span>
            {win.name}
          </div>
        ))}
      </div>

      {/* Right side */}
      <div style={{
        marginLeft: 'auto',
        display: 'flex',
        alignItems: 'center',
        height: '100%',
        color: '#4a5568',
        fontSize: 11,
      }}>
        <div style={{
          padding: '0 12px',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          borderLeft: '1px solid rgba(100, 140, 200, 0.06)',
        }}>
          <span style={{
            fontSize: 10,
            padding: '3px 8px',
            borderRadius: 4,
            cursor: 'pointer',
            color: '#c8d0e0',
          }}>
            ⌃b s
          </span>
        </div>
        <div style={{
          padding: '0 12px',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          borderLeft: '1px solid rgba(100, 140, 200, 0.06)',
        }}>
          <Clock />
        </div>
      </div>
    </div>
  );
}

function Clock() {
  // Simple clock - update every minute
  const now = new Date();
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

  return <span>{time}</span>;
}
