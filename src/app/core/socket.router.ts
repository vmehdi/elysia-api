import { Elysia, t } from 'elysia';
import { saveSingleEvent } from './ingestion.service';
import { jwtTrack } from '@/utils/jwt';

/**
 * This router handles all real-time WebSocket communication,
 * using the 'beforeHandle' hook for robust, type-safe authentication.
 */
const socketRouter = new Elysia()
  .use(jwtTrack)
  .ws('/ws', {
    // This hook runs BEFORE the connection is opened. It's used for authentication.
    beforeHandle: async ({ query, jwtTrack, set }) => {
      const token = query.token;

      if (!token) {
        set.status = 401; // Unauthorized
        return false; // Returning false will terminate the connection
      }

      const payload = await jwtTrack.verify(token);
      if (!payload || payload.type !== 'TRACKING_TOKEN') {
        set.status = 403; // Forbidden
        return false; // Terminate the connection
      }
    },

    open(ws) {
      console.log(`✅ [WS] Client connected and authenticated: ${ws.id}`);
      ws.subscribe('live_feed');
    },

    async message(ws, message) {
      try {
        // Because of 'beforeHandle', any message received here is from an authenticated client.
        const payload = typeof message === 'object' ? message : JSON.parse(message as string);

        // Use the shared service to save the event to the database.
        await saveSingleEvent(payload);

        // Optionally, broadcast the event to other clients.
        ws.publish('live_feed', payload);
      } catch (error) {
        console.error("🚨 [WS] Error processing message:", error);
      }
    },

    close(ws) {
      console.log(`🛑 [WS] Client disconnected: ${ws.id}`);
    }
  });

export default socketRouter;