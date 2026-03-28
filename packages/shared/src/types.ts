// ── Session / Window / Pane ──

export interface Session {
  id: string;
  name: string;
  windowCount: number;
  attached: boolean;
  windows: Window[];
}

export interface Window {
  id: string;
  index: number;
  name: string;
  active: boolean;
  paneCount: number;
  panes: Pane[];
  layout: LayoutNode;
}

export interface Pane {
  id: string;
  index: number;
  cols: number;
  rows: number;
  currentCommand: string;
  pid: number;
  ttyPath: string;
  zoomed: boolean;
}

// ── Layout tree ──

export interface LayoutContainer {
  type: 'horizontal' | 'vertical';
  children: LayoutNode[];
  ratios: number[];
}

export interface LayoutLeaf {
  type: 'pane';
  paneId: string;
  cols: number;
  rows: number;
}

export type LayoutNode = LayoutContainer | LayoutLeaf;

// ── Client identity ──

export type ClientType = 'web' | 'electron' | 'mobile' | 'cli';

export interface ClientInfo {
  clientId: string;
  clientType: ClientType;
  cols: number;
  rows: number;
}

// ── Session ownership ──

export interface SessionOwnership {
  sessionId: string;
  ownerId: string | null;
  ownerType: ClientType | null;
  acquiredAt: number;
}

// ── Connection status ──

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
