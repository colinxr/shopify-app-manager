import "@shopify/shopify-app-react-router/adapters/cloudflare";
import { shopifyApp, type ShopifyApp } from "@shopify/shopify-app-react-router";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { getRequestScopedPrisma } from "./db.server";

export interface ShopifyEnv {
  SHOPIFY_API_KEY: string;
  SHOPIFY_API_SECRET: string;
  SHOPIFY_APP_URL: string;
  SCOPES: string;
  SESSION_SECRET: string;
}

let appInstance: ShopifyApp | undefined;

/**
 * Initialize Shopify with runtime environment variables.
 * Must be called at the start of each request in entry.worker.ts.
 */
export function initShopify(env: ShopifyEnv) {
  // Re-initialize on each request since env bindings are request-scoped
  appInstance = shopifyApp({
    apiKey: env.SHOPIFY_API_KEY,
    apiSecretKey: env.SHOPIFY_API_SECRET,
    appUrl: env.SHOPIFY_APP_URL,
    scopes: env.SCOPES?.split(","),
    sessionStorage: new PrismaSessionStorage(getRequestScopedPrisma()),
    isEmbeddedApp: true,
    future: {},
  });
}

function getApp(): ShopifyApp {
  if (!appInstance) {
    throw new Error(
      "Shopify app not initialized. Call initShopify(env) before accessing the app.",
    );
  }
  return appInstance;
}

// Proxy objects that forward to the initialized app instance
export const authenticate = new Proxy({} as ShopifyApp["authenticate"], {
  get(_, prop) {
    return (getApp().authenticate as Record<string, unknown>)[prop as string];
  },
});

export const sessionStorage = new Proxy({} as ShopifyApp["sessionStorage"], {
  get(_, prop) {
    return (getApp().sessionStorage as Record<string, unknown>)[prop as string];
  },
});

export const login = new Proxy((() => {}) as unknown as ShopifyApp["login"], {
  apply(_, __, args) {
    return (getApp().login as Function)(...args);
  },
});

export const unauthenticated = new Proxy(
  {} as ShopifyApp["unauthenticated"],
  {
    get(_, prop) {
      return (getApp().unauthenticated as Record<string, unknown>)[
        prop as string
      ];
    },
  },
);

export default new Proxy({} as ShopifyApp, {
  get(_, prop) {
    return (getApp() as Record<string, unknown>)[prop as string];
  },
});
