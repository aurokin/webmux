interface PaneChromeProps {
  paneId: string;
  currentCommand: string;
  focused: boolean;
}

export function PaneChrome({ paneId, currentCommand, focused }: PaneChromeProps) {
  return (
    <div style={{
      height: 26,
      display: 'flex',
      alignItems: 'center',
      padding: '0 10px',
      background: 'rgba(0, 0, 0, 0.15)',
      borderBottom: '1px solid rgba(100, 140, 200, 0.06)',
      fontSize: 10.5,
      color: '#4a5568',
      gap: 7,
      flexShrink: 0,
      userSelect: 'none',
    }}>
      <div style={{
        width: 5,
        height: 5,
        borderRadius: '50%',
        background: focused ? '#56d4a0' : '#4a5568',
        transition: 'background 0.2s',
      }} />
      <span style={{ color: '#7a8698', fontWeight: 500 }}>
        {currentCommand || 'zsh'}
      </span>
      <span style={{ color: '#2d3748', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {paneId}
      </span>
    </div>
  );
}
