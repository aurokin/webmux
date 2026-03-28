import {
  RECONNECT_BACKOFF_BASE_MS,
  RECONNECT_BACKOFF_MAX_MS,
  RECONNECT_BACKOFF_MULTIPLIER,
  RECONNECT_MAX_ATTEMPTS,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_TIMEOUT_MS,
  WS_CLOSE,
} from '@webmux/shared';

/**
 * WebSocket connection with automatic reconnection and heartbeat.
 *
 * See docs/client/connection.md for the state machine.
 */
export class Connection {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;
  private lastPongAt = 0;

  onOpen: (() => void) | null = null;
  onMessage: ((data: string | ArrayBuffer) => void) | null = null;
  onClose: ((code: number, reason: string) => void) | null = null;
  onStatusChange: ((status: 'connected' | 'reconnecting' | 'disconnected') => void) | null = null;
  onLatency: ((rtt: number) => void) | null = null;

  constructor(url: string) {
    this.url = url;
  }

  connect(): void {
    this.cleanup();

    try {
      this.ws = new WebSocket(this.url);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.onStatusChange?.('connected');
        this.onOpen?.();
      };

      this.ws.onmessage = (event) => {
        this.onMessage?.(event.data);
      };

      this.ws.onclose = (event: CloseEvent) => {
        this.stopHeartbeat();
        this.onClose?.(event.code, event.reason);

        // Don't reconnect on auth failure
        if (event.code === WS_CLOSE.AUTH_FAILED) {
          this.onStatusChange?.('disconnected');
          return;
        }

        // Don't reconnect on intentional close
        if (event.code === WS_CLOSE.NORMAL) {
          this.onStatusChange?.('disconnected');
          return;
        }

        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        // onerror is always followed by onclose, so reconnection
        // is handled there. Nothing to do here.
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  send(data: string | ArrayBuffer | Uint8Array): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  disconnect(): void {
    this.cleanup();
    this.onStatusChange?.('disconnected');
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= RECONNECT_MAX_ATTEMPTS) {
      this.onStatusChange?.('disconnected');
      return;
    }

    this.onStatusChange?.('reconnecting');

    const delay = Math.min(
      RECONNECT_BACKOFF_BASE_MS * Math.pow(RECONNECT_BACKOFF_MULTIPLIER, this.reconnectAttempts),
      RECONNECT_BACKOFF_MAX_MS,
    );

    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState !== WebSocket.OPEN) return;

      const pingTime = Date.now();

      // WebSocket API doesn't expose ping/pong directly in browsers.
      // We use a JSON ping on the control channel instead.
      // The bridge responds with a pong, and we measure RTT.
      this.send(JSON.stringify({ type: 'ping', t: pingTime }));

      this.heartbeatTimeout = setTimeout(() => {
        // No pong received — connection is dead
        this.ws?.close();
      }, HEARTBEAT_TIMEOUT_MS);
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.heartbeatTimeout) clearTimeout(this.heartbeatTimeout);
    this.heartbeatTimer = null;
    this.heartbeatTimeout = null;
  }

  /**
   * Called when a pong is received. Clears heartbeat timeout and measures RTT.
   */
  handlePong(sentAt: number): void {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
    this.lastPongAt = Date.now();
    this.onLatency?.(this.lastPongAt - sentAt);
  }

  private cleanup(): void {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close(WS_CLOSE.NORMAL);
      }
      this.ws = null;
    }
  }
}
