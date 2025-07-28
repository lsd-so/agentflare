import { Hono } from "hono";
import { BrowserContainer, ComputerContainer } from "./containers";
import { AppBindings } from "./types";
import webRoutes from "./routes/web";
import browserRoutes from "./routes/browser";
import computerRoutes from "./routes/computer";

/*
  - Return a web page with an input like chat.com
  - Handle submission of "task" with agent loop using two containers (as necessary)

  - May require strategy or tools for respective containers
 */

// Create Hono app with proper typing for Cloudflare Workers
const app = new Hono<{ Bindings: AppBindings }>();

// Mount route handlers
app.route("/", webRoutes);
app.route("/", browserRoutes);
app.route("/", computerRoutes);

// Export container classes for Cloudflare Workers runtime
export { BrowserContainer, ComputerContainer };

export default app;
