// file: plugins/live-logger.ts
import type { WebSocket } from 'bun';
import { Elysia } from 'elysia';

class LogBroadcaster {
  private sockets = new Set<WebSocket>();

  register(ws: WebSocket) {
    this.sockets.add(ws);
  }

  unregister(ws: WebSocket) {
    this.sockets.delete(ws);
  }

  broadcast(message: string) {
    for (const ws of this.sockets) {
      try {
        ws.send(message);
      } catch { }
    }
  }
}

export const logBroadcaster = new LogBroadcaster();

export const liveLoggerPlugin = new Elysia()
  .get('/logs', () => Bun.file('./public/play.html'))
  .ws('/log-ws', {
    open(ws: any) {
      logBroadcaster.register(ws);
      ws.send('🔌 Connected to Logger Stream');
    },
    close(ws: any) {
      logBroadcaster.unregister(ws);
    }
  });
