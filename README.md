## TODO

- MCP server
- Something in browser to check if exceeding context window is bc html and to instead get markdown
- Something in computer to check if exceeding context window is bc screenshot and to instead clear prior messages/tool calls except for system/user/screenshot then proceed
- Prompt engineering so examples below can have succinct inputs (w/o explicitly saying to use certain tool etc)

# Agentflare

This project provides an agent that can use a [web browser](#using-chromium) and/or computer to fulfill tasks specified by a user using Cloudflare [Workers](https://developers.cloudflare.com/workers/) and [containers](https://developers.cloudflare.com/containers/).

This was inspired by the recent [OpenAI Agent](https://openai.com/index/introducing-chatgpt-agent/) and how its rather simple capabilities were constrained in terms of available usages.

## Contents

* [Usage](#usage)
  * [Search example](#search-example)
  * [Browser example](#browser-example)
  * [Computer example](#computer-example)
  * [Search and browser example](#search-and-browser-example)
  * [Browser and computer example](#browser-and-computer-example)
* [Architecture](#explanation)
  * [Using Chromium](#using-chromium)
  * [Using computer](#using-computer)
* [Developing](#developing)
  * [Running on your own Cloudflare account](#running-on-your-own-cloudflare-account)
  * [Running locally with miniflare](#running-locally-with-miniflare)

## Usage

### Search example

![Using search to look up news related to Cloudflare and bots](assets/search_usage.gif)

### Browser example

Here is an example of using a browser to get page content then summarizing

### Computer example

Here is an example of using a terminal to run python

### Search and browser example

Here is an example of using search to get links and then get html/markdown to then summarize

### Browser and computer example

Here is an example of using a browser to get a code snippet and then running it on computer

## Explanation

Breakdown of how computer use is architected. Shout out to openai computer using agent only needing browser. Then breakdown of this

### Using Chromium

[security](https://chromium-review.googlesource.com/c/chromium/src/+/952522)

### Using computer

This utilizes some of the same dependencies as [Anthropic's computer use](https://github.com/anthropics/anthropic-quickstarts/tree/main/computer-use-demo)

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
