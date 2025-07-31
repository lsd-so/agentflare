import { Hono } from "hono";
import { loadBalance, getContainer } from "@cloudflare/containers";
import { AppBindings } from "../types";

const webRoutes = new Hono<{ Bindings: AppBindings }>();

// Home route with available endpoints - commented out to allow computer root route
webRoutes.get("/", (c) => {
  return c.text(
    "Available endpoints:\n" +
    "GET /container/<ID> - Start a container for each ID with a 2m timeout\n" +
    "GET /lb - Load balance requests over multiple containers\n" +
    "GET /error - Start a container that errors (demonstrates error handling)\n" +
    "GET /singleton - Get a single specific container instance",
  );
});

// Route requests to a specific container using the container ID
webRoutes.get("/container/:id", async (c) => {
  const id = c.req.param("id");
  const containerId = c.env.BROWSER_CONTAINER.idFromName(`/container/${id}`);
  const container = c.env.BROWSER_CONTAINER.get(containerId);
  return await container.fetch(c.req.raw);
});

// Demonstrate error handling - this route forces a panic in the container
webRoutes.get("/error", async (c) => {
  const container = getContainer(c.env.BROWSER_CONTAINER, "error-test");
  return await container.fetch(c.req.raw);
});

// Load balance requests across multiple containers
webRoutes.get("/lb", async (c) => {
  const container = await loadBalance(c.env.BROWSER_CONTAINER, 3);
  return await container.fetch(c.req.raw);
});

// Get a single container instance (singleton pattern)
webRoutes.get("/singleton", async (c) => {
  const container = getContainer(c.env.BROWSER_CONTAINER);
  const modifiedRequest = new Request(c.req.raw, {
    headers: {
      ...Object.fromEntries(c.req.raw.headers.entries()),
      "host": "localhost"
    }
  });
  return await container.fetch(modifiedRequest);
});

export default webRoutes;
