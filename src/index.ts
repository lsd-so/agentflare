import { Container, loadBalance, getContainer } from "@cloudflare/containers";
import { Hono } from "hono";

/*
  - Return a web page with an input like chat.com
  - Handle submission of "task" with agent loop using two containers (as necessary)

  - May require strategy or tools for respective containers
 */

export class BrowserContainer extends Container {
  // Port the container listens on (default: 8080)
  defaultPort = 8080;
  // Time before container sleeps due to inactivity (default: 30s)
  sleepAfter = "2m";
  // Environment variables passed to the container
  envVars = {
    MESSAGE: "I was passed in via the container class!",
  };

  // Optional lifecycle hooks
  override onStart() {
    console.log("Container successfully started");
  }

  override onStop() {
    console.log("Container successfully shut down");
  }

  override onError(error: unknown) {
    console.log("Container error:", error);
  }
}

export class ComputerContainer extends Container {
  defaultPort = 8000;
  sleepAfter = '2m';

  // Optional lifecycle hooks
  override onStart() {
    console.log("Container successfully started");
  }

  override onStop() {
    console.log("Container successfully shut down");
  }

  override onError(error: unknown) {
    console.log("Container error:", error);
  }
}

// Create Hono app with proper typing for Cloudflare Workers
const app = new Hono<{
  Bindings: { BROWSER_CONTAINER: DurableObjectNamespace<BrowserContainer> };
}>();

// Home route with available endpoints
app.get("/", (c) => {
  return c.text(
    "Available endpoints:\n" +
    "GET /container/<ID> - Start a container for each ID with a 2m timeout\n" +
    "GET /lb - Load balance requests over multiple containers\n" +
    "GET /error - Start a container that errors (demonstrates error handling)\n" +
    "GET /singleton - Get a single specific container instance",
  );
});

// Route requests to a specific container using the container ID
app.get("/container/:id", async (c) => {
  const id = c.req.param("id");
  const containerId = c.env.BROWSER_CONTAINER.idFromName(`/container/${id}`);
  const container = c.env.BROWSER_CONTAINER.get(containerId);
  return await container.fetch(c.req.raw);
});

// Demonstrate error handling - this route forces a panic in the container
app.get("/error", async (c) => {
  const container = getContainer(c.env.BROWSER_CONTAINER, "error-test");
  return await container.fetch(c.req.raw);
});

// Load balance requests across multiple containers
app.get("/lb", async (c) => {
  const container = await loadBalance(c.env.BROWSER_CONTAINER, 3);
  return await container.fetch(c.req.raw);
});

// Get a single container instance (singleton pattern)
app.get("/singleton", async (c) => {
  const container = getContainer(c.env.BROWSER_CONTAINER);
  const modifiedRequest = new Request(c.req.raw, {
    headers: {
      ...Object.fromEntries(c.req.raw.headers.entries()),
      "host": "localhost"
    }
  });
  return await container.fetch(modifiedRequest);
});

/* Endpoints relating to browser control */
app.get("/json/version", async (c) => {
  const container = getContainer(c.env.BROWSER_CONTAINER);
  return await container.fetch(c.req.raw);
});

app.get("/devtools/browser/*", async (c) => {
  const container = getContainer(c.env.BROWSER_CONTAINER);
  return await container.fetch(c.req.raw);
});

export default app;
