## AGENT TODO

- Architecture
  - Top level agent (that does the work)
  - call_browser_agent (tool that starts off agent for working with a browser)
  - call_computer_agent (tool that starts off agent for working with a computer)
  - call_serp_agent (tool that starts off agent for making requests to brave/duckduckgo)
  
- browser_agent
  - has tools relating to iterating on puppeteer
  - clears screenshot tool call and tool output when requesting a new screenshot

- computer_agent
  - has tools relating to iterating on computer with vnc
  - clears screenshot tool call and tool output when requesting a new screenshot
  
- serp agent
  - has one tool to perform request for SERP
  - does NOT clear previous results (google fu)

- Set up HTTP endpoints for computer container to
  - Get screenshot as base64 string
  - Do other actions as defined by computer use
- Set up agent for specifically handling computer container usage (and ends up with string output)
- Set up tools for interfacing with browser container

- Make HTTP web app as part of supervisord
  - This is interface to doing/reading things with computer
- Make tools for interfacing with containers
- Make tool for brave SERP (doesn't block bots)
- Make simple loop to carry out a simple task (that's accessible via web app)
- Bundle into MCP server that can also be deployed onto cloudflare or run locally

# Containers Starter

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/cloudflare/templates/tree/main/containers-template)

![Containers Template Preview](https://imagedelivery.net/_yJ02hpOMj_EnGvsU2aygw/5aba1fb7-b937-46fd-fa67-138221082200/public)

<!-- dash-content-start -->

This is a [Container](https://developers.cloudflare.com/containers/) starter template.

It demonstrates basic Container coniguration, launching and routing to individual container, load balancing over multiple container, running basic hooks on container status changes.

<!-- dash-content-end -->

Outside of this repo, you can start a new project with this template using [C3](https://developers.cloudflare.com/pages/get-started/c3/) (the `create-cloudflare` CLI):

```bash
npm create cloudflare@latest -- --template=cloudflare/templates/containers-template
```

## Getting Started

First, run:

```bash
npm install
# or
yarn install
# or
pnpm install
# or
bun install
```

Then run the development server (using the package manager of your choice):

```bash
npm run dev
```

Open [http://localhost:8787](http://localhost:8787) with your browser to see the result.

You can start editing your Worker by modifying `src/index.ts` and you can start
editing your Container by editing the content of `container_src`.

## Deploying To Production

| Command          | Action                                |
| :--------------- | :------------------------------------ |
| `npm run deploy` | Deploy your application to Cloudflare |

## Learn More

To learn more about Containers, take a look at the following resources:

- [Container Documentation](https://developers.cloudflare.com/containers/) - learn about Containers
- [Container Class](https://github.com/cloudflare/containers) - learn about the Container helper class

Your feedback and contributions are welcome!
