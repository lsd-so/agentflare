import { Hono } from "hono";
import { getContainer, switchPort } from "@cloudflare/containers";
import { AppBindings } from "../types";

const computerRoutes = new Hono<{ Bindings: AppBindings }>();

// VNC web interface endpoint
computerRoutes.get("/vnc", async (c) => {
  const container = getContainer(c.env.COMPUTER_CONTAINER);

  const url = new URL(c.req.url);
  url.pathname = url.pathname.replace(/^\/vnc/, "") || "/";
  const modifiedRequest = new Request(url, c.req.raw);

  return await container.fetch(switchPort(modifiedRequest, 6080));
});

// Websockify endpoint
computerRoutes.get("/websockify", async (c) => {
  const container = getContainer(c.env.COMPUTER_CONTAINER);
  return await container.fetch(switchPort(c.req.raw, 6080));
});

// VNC HTML page
computerRoutes.get("vnc.html", async (c) => {
  const container = getContainer(c.env.COMPUTER_CONTAINER);
  return await container.fetch(switchPort(c.req.raw, 6080));
});

// JSON configuration files
computerRoutes.get("/defaults.json", async (c) => {
  const container = getContainer(c.env.COMPUTER_CONTAINER);
  return await container.fetch(switchPort(c.req.raw, 6080));
});

computerRoutes.get("/mandatory.json", async (c) => {
  const container = getContainer(c.env.COMPUTER_CONTAINER);
  return await container.fetch(switchPort(c.req.raw, 6080));
});

computerRoutes.get("/package.json", async (c) => {
  const container = getContainer(c.env.COMPUTER_CONTAINER);
  return await container.fetch(switchPort(c.req.raw, 6080));
});

// noVNC application styles
computerRoutes.get("/app/styles/*", async (c) => {
  const container = getContainer(c.env.COMPUTER_CONTAINER);
  return await container.fetch(switchPort(c.req.raw, 6080));
});

// noVNC application resources
computerRoutes.get("/app/*", async (c) => {
  const container = getContainer(c.env.COMPUTER_CONTAINER);
  return await container.fetch(switchPort(c.req.raw, 6080));
});

// noVNC core resources
computerRoutes.get("/core/*", async (c) => {
  const container = getContainer(c.env.COMPUTER_CONTAINER);
  return await container.fetch(switchPort(c.req.raw, 6080));
});

// Vendor pako resources
computerRoutes.get("/vendor/pako/*", async (c) => {
  const container = getContainer(c.env.COMPUTER_CONTAINER);
  return await container.fetch(switchPort(c.req.raw, 6080));
});

// noVNC application images
computerRoutes.get("/app/images/*", async (c) => {
  const container = getContainer(c.env.COMPUTER_CONTAINER);
  return await container.fetch(switchPort(c.req.raw, 6080));
});

// Audio file support
computerRoutes.get("/app/sounds/*", async (c) => {
  const container = getContainer(c.env.COMPUTER_CONTAINER);
  return await container.fetch(switchPort(c.req.raw, 6080));
});

export default computerRoutes;
