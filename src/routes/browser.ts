import { Hono } from "hono";
import { getContainer, switchPort } from "@cloudflare/containers";
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

// Title endpoint for debugging - forwards to browser container
browserRoutes.get("/title", async (c) => {
  const container = getContainer(c.env.BROWSER_CONTAINER);
  return await container.fetch(switchPort(c.req.raw, 3000));
});

export default browserRoutes;