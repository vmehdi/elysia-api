// file: plugins/live-play.ts
import { Elysia } from 'elysia';
import type { ServerWebSocket } from 'bun';
import { registerSocket, unregisterSocket, getSocketsByFingerprint } from '@/utils/socket-fingerprint-map';


export const setupLivePlyer: any = {
  open(ws: ServerWebSocket) {
    const urlString = (ws.data as any)?.url || '';
    const url = new URL(urlString || 'http://localhost');
    const fp = url.searchParams.get('fp');
    if (fp) {
      registerSocket(fp, ws, 'player');
      ws.send(JSON.stringify({ status: 'connected', fp }));
    } else {
      ws.send(JSON.stringify({ error: 'Missing fingerprint' }));
      ws.close();
    }
  },

  close(ws: ServerWebSocket) {
    unregisterSocket(ws);
  }
}

export function streamToPlayer(fp: string, data: any) {
  const sockets = getSocketsByFingerprint(fp, 'player');
  if (!sockets?.length) return;

  const payload = JSON.stringify({ type: 'recording', data });
  for (const ws of sockets) {
    try {
      ws.send(payload);
    } catch { }
  }
}

export const livePlayerPlugin = new Elysia()
  .get('/play', () => {
    return new Response(`<!DOCTYPE html>
<html>
<head>
  <title>Live Session Viewer</title>
  <script src="https://unpkg.com/rrweb-player@latest/dist/index.js"></script>
  <link href="https://unpkg.com/rrweb-player@latest/dist/style.css" rel="stylesheet" />
  <style>
    body { background: #111; color: white; padding: 1rem; font-family: sans-serif; }
    #player { max-width: 800px; margin: auto; }
  </style>
</head>
<body>
  <h2>Live RRWeb Session</h2>
  <div id="player"></div>
  <script>
    const urlParams = new URLSearchParams(location.search);
    const fp = urlParams.get("fp");
    if (!fp) {
      document.body.innerHTML = "<p style='color:red;'>Missing fingerprint in URL (?fp=...)</p>";
    } else {
      const ws = new WebSocket("ws://" + location.host + "/play-ws?fp=" + fp);
      let player;
      let initialized = false;
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'recording') {
            const mappedEvents = msg.data.rr_events.map(ev => ({
              type: ev.t,
              timestamp: ev.ts,
              data: ev.d
            }));

            // فقط یکبار player ساخته بشه
            if (!initialized) {
              player = new rrwebPlayer({
                target: document.getElementById('player'),
                props: { events: [], autoPlay: true }
              });
              initialized = true;
            }

            player.addEvent(...mappedEvents);
          } else if (msg.error) {
            console.error("Error:", msg.error);
          }
        } catch (err) {
          console.warn("Invalid WS message", e.data);
        }
      };
    }
  </script>
</body>
</html>`, {
      headers: { 'Content-Type': 'text/html' }
    });
  });