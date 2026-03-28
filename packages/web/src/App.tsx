import { useState, useEffect, useSyncExternalStore } from 'react';
import { WebmuxClient } from '@webmux/client';
import { Workspace } from './components/Workspace';
import { StatusBar } from './components/StatusBar';
import { SessionSwitcher } from './components/SessionSwitcher';
import { HandoffBanner } from './components/HandoffBanner';

/**
 * Read bridge URL and token from URL params or defaults.
 * Example: http://localhost:5173?bridge=ws://localhost:7400&token=abc123
 */
function getConfig() {
  const params = new URLSearchParams(window.location.search);
  return {
    bridgeUrl: params.get('bridge') ?? 'ws://localhost:7400',
    token: params.get('token') ?? '',
    clientId: `web-${crypto.randomUUID().slice(0, 8)}`,
  };
}

export function App() {
  const [client] = useState(() => {
    const config = getConfig();
    return new WebmuxClient({
      url: config.bridgeUrl,
      token: config.token,
      clientId: config.clientId,
      clientType: 'web',
    });
  });

  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [focusedPaneId, setFocusedPaneId] = useState<string | null>(null);

  const sessions = useSyncExternalStore(client.subscribe, client.getSnapshot);

  useEffect(() => {
    if (!getConfig().token) {
      console.warn('[webmux] No token provided. Add ?token=xxx to the URL.');
      return;
    }
    client.connect();
    return () => client.disconnect();
  }, [client]);

  // Prefix key handling
  useEffect(() => {
    let prefixMode = false;
    let prefixTimer: ReturnType<typeof setTimeout>;

    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'b') {
        e.preventDefault();
        prefixMode = true;
        clearTimeout(prefixTimer);
        prefixTimer = setTimeout(() => { prefixMode = false; }, 2000);
        return;
      }

      if (prefixMode) {
        prefixMode = false;
        e.preventDefault();
        switch (e.key) {
          case 's': setSwitcherOpen((o) => !o); break;
          // TODO: Handle other prefix keys (z, ", %, x, c, etc.)
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Derive active session and window
  const activeSession = sessions[0] ?? null; // TODO: track selected session
  const activeWindow = activeSession?.windows.find((w) => w.active) ?? null;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      width: '100vw',
      background: '#080a10',
      color: '#c8d0e0',
      fontFamily: "'Commit Mono', 'JetBrains Mono', monospace",
    }}>
      <HandoffBanner
        client={client}
        activeSession={activeSession}
      />

      <Workspace
        client={client}
        layout={activeWindow?.layout ?? null}
        focusedPaneId={focusedPaneId}
        onFocusPane={setFocusedPaneId}
      />

      <StatusBar
        client={client}
        activeSession={activeSession}
        activeWindow={activeWindow}
        onOpenSwitcher={() => setSwitcherOpen(true)}
      />

      {switcherOpen && (
        <SessionSwitcher
          client={client}
          sessions={sessions}
          onClose={() => setSwitcherOpen(false)}
        />
      )}
    </div>
  );
}
