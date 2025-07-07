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
  .get('/logs', () => {
    return new Response(
      `<!DOCTYPE html>
<html lang="en">
<head>
  <title> Live Logs</title>
  <style>
    body { font-family: monospace; background: #111; color: #0f0; padding: 1rem; }
    #log { white-space: pre-wrap; max-height: 90vh; overflow-y: auto; }
  </style>
</head>
<body>
  <h2> Live Logger</h2>
  <div id="log"></div>
  <script>
    const logEl = document.getElementById('log');
    const ws = new WebSocket("ws://" + location.host + "/log-ws");

    ws.onmessage = (event) => {
      const text = event.data;
      const line = document.createElement('div');
      line.textContent = text;

      if (text.includes('error') || text.includes('❌')) {
        line.style.color = '#ff5555'; // قرمز
      } else if (text.includes('✅') || text.includes('🟢')) {
        line.style.color = '#50fa7b'; // سبز روشن
      } else if (text.includes('⚠️') || text.includes('warn')) {
        line.style.color = '#f1fa8c'; // زرد
      } else if (text.includes('🔌') || text.includes('connect')) {
        line.style.color = '#8be9fd'; // آبی
      } else {
        line.style.color = '#ccc'; // رنگ پیش‌فرض خاکستری روشن
      }

      logEl.appendChild(line);
      logEl.scrollTop = logEl.scrollHeight;
    };
  </script>
</body>
</html>`,
      {
        headers: { 'Content-Type': 'text/html' }
      }
    );
  })
  .ws('/log-ws', {
    open(ws: any) {
      logBroadcaster.register(ws);
      ws.send('🔌 Connected to Logger Stream');
    },
    close(ws: any) {
      logBroadcaster.unregister(ws);
    }
  });

// Example usage:
// logBroadcaster.broadcast('[WS] new payload received!');