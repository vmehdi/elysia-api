import { PrismaClient, Prisma } from "@prisma/client";
import { createPaginator } from "prisma-extension-pagination";
import { createSoftDeleteExtension } from "prisma-extension-soft-delete";

const allModelNames = Object.values(Prisma.ModelName);

const paginate = createPaginator({
  pages: {
    limit: 12,
    includePageCount: true,
  },
});

export const prisma = new PrismaClient()
  .$extends(
    createSoftDeleteExtension({
      models: {
        User: true,
        Organization: true,
        Customer: true,
        Membership: true,
        DomainRule: true,
        DomainTracker: true,
        Domain: true,
        Visitor: true,
        Event: true,
      },
      defaultConfig: {
        field: "deletedAt",
        createValue: (deleted) => {
          if (deleted) return new Date();
          return null;
        },
      },
    }),
  )
  .$extends({
    model: {
      $allModels: { paginate },
    },
    query: {
      $allModels: {
        findMany: async ({ model, args, query }) => {
          if (allModelNames.includes(model)) {
            if (!args) {
              args = {};
            }
            if (!args.orderBy) {
              args.orderBy = {};
            }
            args.orderBy = {
              ...args.orderBy,
              updatedAt: "desc",
            };
          }
          return query(args);
        },
      },
    },
  });
