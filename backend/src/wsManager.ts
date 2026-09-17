import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';

export type WsEventType =
  | 'track'
  | 'state'
  | 'queue'
  | 'stop'
  | 'seek'
  | 'volume'
  | 'error'
  | 'network'
  | 'senderConnected'
  | 'connection';

export interface WsMessage {
  event: WsEventType;
  data: unknown;
}

type IncomingEventType = 'progress' | 'ended' | 'playbackError';

export interface IncomingMessage {
  event: IncomingEventType;
  data: unknown;
}

type IncomingHandler = (msg: IncomingMessage) => void;

export class WsManager {
  private wss: WebSocketServer;
  private clients: Set<WebSocket> = new Set();
  private incomingHandler: IncomingHandler | null = null;

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server });

    this.wss.on('connection', (ws) => {
      this.clients.add(ws);

      ws.on('message', (raw) => {
        try {
          const msg: IncomingMessage = JSON.parse(raw.toString());
          if (this.incomingHandler) {
            this.incomingHandler(msg);
          }
        } catch {
          // Ignore malformed messages
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
      });
    });
  }

  broadcast(event: WsEventType, data: unknown): void {
    const msg = JSON.stringify({ event, data });
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  }

  onMessage(handler: IncomingHandler): void {
    this.incomingHandler = handler;
  }

  getClientCount(): number {
    return this.clients.size;
  }

  close(): void {
    for (const client of this.clients) {
      client.close();
    }
    this.wss.close();
  }
}
