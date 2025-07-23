// src/workers/browser-rendering/binding.worker.ts
import assert from "node:assert";
import { DurableObject } from "cloudflare:workers";

// src/workers/core/constants.ts
var CoreBindings = {
  SERVICE_LOOPBACK: "MINIFLARE_LOOPBACK",
  SERVICE_USER_ROUTE_PREFIX: "MINIFLARE_USER_ROUTE_",
  SERVICE_USER_FALLBACK: "MINIFLARE_USER_FALLBACK",
  TEXT_CUSTOM_SERVICE: "MINIFLARE_CUSTOM_SERVICE",
  IMAGES_SERVICE: "MINIFLARE_IMAGES_SERVICE",
  TEXT_UPSTREAM_URL: "MINIFLARE_UPSTREAM_URL",
  JSON_CF_BLOB: "CF_BLOB",
  JSON_ROUTES: "MINIFLARE_ROUTES",
  JSON_LOG_LEVEL: "MINIFLARE_LOG_LEVEL",
  DATA_LIVE_RELOAD_SCRIPT: "MINIFLARE_LIVE_RELOAD_SCRIPT",
  DURABLE_OBJECT_NAMESPACE_PROXY: "MINIFLARE_PROXY",
  DATA_PROXY_SECRET: "MINIFLARE_PROXY_SECRET",
  DATA_PROXY_SHARED_SECRET: "MINIFLARE_PROXY_SHARED_SECRET",
  TRIGGER_HANDLERS: "TRIGGER_HANDLERS",
  LOG_REQUESTS: "LOG_REQUESTS"
};

// src/workers/browser-rendering/binding.worker.ts
var BrowserSession = class extends DurableObject {
  endpoint;
  async fetch(_request) {
    let webSocketPair = new WebSocketPair(), [client, server] = Object.values(webSocketPair);
    server.accept(), assert(this.endpoint !== void 0);
    let response = await fetch(this.endpoint, {
      headers: {
        Upgrade: "websocket"
      }
    });
    assert(response.webSocket !== null);
    let ws = response.webSocket;
    return ws.accept(), ws.addEventListener("message", (m) => {
      let string = new TextEncoder().encode(m.data), data = new Uint8Array(string.length + 4);
      new DataView(data.buffer).setUint32(0, string.length, !0), data.set(string, 4), server.send(data);
    }), server.addEventListener("message", (m) => {
      m.data !== "ping" && ws.send(new TextDecoder().decode(m.data.slice(4)));
    }), new Response(null, {
      status: 101,
      webSocket: client
    });
  }
  async setEndpoint(endpoint) {
    this.endpoint = endpoint.replace("ws://", "http://");
  }
}, binding_worker_default = {
  async fetch(request, env) {
    let url = new URL(request.url);
    switch (url.pathname) {
      case "/v1/acquire": {
        let wsEndpoint = await (await env[CoreBindings.SERVICE_LOOPBACK].fetch(
          "http://example.com/browser/launch"
        )).text(), sessionId = crypto.randomUUID(), id = env.BrowserSession.idFromName(sessionId);
        return await env.BrowserSession.get(id).setEndpoint(wsEndpoint), Response.json({ sessionId });
      }
      case "/v1/connectDevtools": {
        let sessionId = url.searchParams.get("browser_session");
        assert(sessionId !== null);
        let id = env.BrowserSession.idFromName(sessionId);
        return env.BrowserSession.get(id).fetch(request);
      }
      default:
        return new Response("Not implemented", { status: 405 });
    }
  }
};
export {
  BrowserSession,
  binding_worker_default as default
};
//# sourceMappingURL=binding.worker.js.map
