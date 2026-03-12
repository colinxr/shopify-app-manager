import { createRequestHandler } from "@react-router/cloudflare";
import { initShopify, type ShopifyEnv } from "./shopify.server.worker";
import { createPrismaClient, prismaStorage } from "./db.server";

// Cloudflare Workers fetch handler
export default {
  async fetch(
    request: Request,
    env: ShopifyEnv & { DB: D1Database },
    ctx: ExecutionContext,
  ): Promise<Response> {
    // Initialize Shopify with runtime env vars (not available at module scope)
    initShopify(env);

    // Create a request-scoped Prisma client with D1 binding
    const prisma = createPrismaClient({ DB: env.DB });

    // Run the request handler within the Prisma async context
    return prismaStorage.run(prisma, () => {
      const handler = createRequestHandler(
        // @ts-expect-error - virtual module from react-router build
        () => import("virtual:react-router/server-build"),
        "production",
      );
      return handler(request, {
        env,
        ctx,
      });
    });
  },
};
