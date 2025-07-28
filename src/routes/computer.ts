import { Hono } from "hono";
import { getContainer, switchPort } from "@cloudflare/containers";
import { AppBindings } from "../types";

const computerRoutes = new Hono<{ Bindings: AppBindings }>();

// Main computer control endpoint
computerRoutes.get("/computer", async (c) => {
  const container = getContainer(c.env.COMPUTER_CONTAINER);

  const url = new URL(c.req.url);
  url.pathname = url.pathname.replace(/^\/computer/, "") || "/";
  const modifiedRequest = new Request(url, c.req.raw);

  return await container.fetch(modifiedRequest);
});

// VNC web interface endpoint
computerRoutes.get("/vnc", async (c) => {
  const container = getContainer(c.env.COMPUTER_CONTAINER);

  const url = new URL(c.req.url);
  url.pathname = url.pathname.replace(/^\/vnc/, "") || "/";
  const modifiedRequest = new Request(url, c.req.raw);

  return await container.fetch(switchPort(modifiedRequest, 6080));
});

// VNC HTML page
computerRoutes.get("vnc.html", async (c) => {
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

// noVNC core utilities
computerRoutes.get("/core/util/*", async (c) => {
  const container = getContainer(c.env.COMPUTER_CONTAINER);
  return await container.fetch(switchPort(c.req.raw, 6080));
});

// noVNC application images
computerRoutes.get("/app/images/*", async (c) => {
  const container = getContainer(c.env.COMPUTER_CONTAINER);
  return await container.fetch(switchPort(c.req.raw, 6080));
});

// Audio file support (OGA format)
computerRoutes.get("*oga", async (c) => {
  const container = getContainer(c.env.COMPUTER_CONTAINER);
  return await container.fetch(switchPort(c.req.raw, 6080));
});

// Audio file support (MP3 format)
computerRoutes.get("*mp3", async (c) => {
  const container = getContainer(c.env.COMPUTER_CONTAINER);
  return await container.fetch(switchPort(c.req.raw, 6080));
});

export default computerRoutes;