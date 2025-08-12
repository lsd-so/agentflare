import { Hono } from "hono";
import { getContainer } from "@cloudflare/containers";
import { AppBindings } from "../types";
import { createMainAgent } from "../agents/agent";

const webRoutes = new Hono<{ Bindings: AppBindings }>();

// Chat endpoint to handle messages from the frontend
webRoutes.post("/chat", async (c) => {
  try {
    const { message, apiKey } = await c.req.json();

    if (!message || typeof message !== 'string') {
      return c.json({ success: false, error: 'Message is required' });
    }

    if (!apiKey || typeof apiKey !== 'string') {
      return c.json({ success: false, error: 'API key is required' });
    }

    const agent = await createMainAgent(c.env, apiKey);
    const response = await agent.processNaturalLanguageRequest(message);

    return c.json({
      success: response.success,
      message: response.message,
      taskType: response.taskType,
      data: response.data,
      error: response.error,
      executionTime: response.executionTime,
      response,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
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
