import { Elysia, t } from 'elysia';
import { cors } from "@elysiajs/cors";
import { serverTiming } from "@elysiajs/server-timing";
import { staticPlugin } from "@elysiajs/static";
import { swagger } from "@elysiajs/swagger";
import { AppRoutes } from '@/app/app.router';
import { transformResult } from '@/utils/helper';
import logger from '@/utils/logger';
import { jwtTrack } from '@/utils/jwt';
import socketRouter from '@/app/core/socket.router';

const app = new Elysia()
  .use(cors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    preflight: true,
  }))
  .use(serverTiming())
  .use(staticPlugin())
  .use(
    swagger({
      documentation: {
        info: {
          title: "Afito Documentation",
          version: "1.0.0",
        },
      },
    }),
  )
  .use(jwtTrack)
  .use(AppRoutes)
  .use(socketRouter)
  .onRequest(({ request }) => {
    const { url, method } = request;
    logger.info(`Request received: ${method} ${url}`);
  })
  .onError(({ code, set, error }) => {
    set.status = 404;
    if (code === "VALIDATION") {
      set.status = 422;
      return transformResult(null, error.message, false);
    }
    return transformResult(null, "پیدا نشد! یا خطایی بوجود آمد", false);
  })
  .listen({ port: Bun.env.PORT || 3000 });

logger.info(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
