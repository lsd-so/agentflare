import { Hono } from "hono";
import { getContainer } from "@cloudflare/containers";
import { AppBindings } from "../types";

const browserRoutes = new Hono<{ Bindings: AppBindings }>();

// Browser DevTools version endpoint
browserRoutes.get("/json/version", async (c) => {
  const container = getContainer(c.env.BROWSER_CONTAINER);
  return await container.fetch(c.req.raw);
});

// Browser DevTools endpoints
browserRoutes.get("/devtools/browser/*", async (c) => {
  const container = getContainer(c.env.BROWSER_CONTAINER);
  return await container.fetch(c.req.raw);
});

export default browserRoutes;