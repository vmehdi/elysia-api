import { Elysia } from 'elysia';
import { saveBatchedEvents } from './ingestion.service';

/**
 * This router handles all real-time WebSocket communication.
 */
const socketRouter = new Elysia()
    .ws('/ws', {
        open(ws) {
            console.log(`✅ [WS] Client connected: ${ws.id}`);
            ws.subscribe('live_feed');
        },

        async message(ws, message) {
            try {
                // For now, we assume any message is a valid batched payload
                // In a real scenario, you'd add authentication and validation here

                const payload = typeof message === 'object' ? message : JSON.parse(message as string);

                // Use the shared service to save the events to the database
                await saveBatchedEvents(payload);

                // Optionally, broadcast that a new batch was received
                ws.publish('live_feed', `Received a batch of ${payload.events.length} events.`);

            } catch (error) {
                console.error("🚨 [WS] Error processing message:", error);
            }
        },

        close(ws) {
            console.log(`🛑 [WS] Client disconnected: ${ws.id}`);
            ws.unsubscribe('live_feed');
        }
    });

export default socketRouter;