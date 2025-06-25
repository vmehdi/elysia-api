import { Elysia, t } from "elysia";
import { isAuthenticated } from "@/middleware/auth";
import { createDomainWithDefaults } from "./domain.controller";

const domainRouter = new Elysia({ prefix: '/domains' })
  .use(isAuthenticated) // Protect all routes in this router
  .post(
    '/',
    createDomainWithDefaults,
    {
      body: t.Object({
        name: t.String(),
        url: t.String(),
        organizationId: t.String(),
      })
    }
  );

export default domainRouter;