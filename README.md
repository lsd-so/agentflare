# Agentflare

This project provides an agent that can use a [web browser](#using-chromium) and computer to fulfill tasks specified by a user using Cloudflare [Workers](https://developers.cloudflare.com/workers/) plus [containers](https://developers.cloudflare.com/containers/).

This was inspired by the recent [OpenAI Agent](https://openai.com/index/introducing-chatgpt-agent/) and how its rather simple capabilities were constrained in terms of available usages.

> Pro users have 400 messages per month, while other paid users get 40 messages monthly, with additional usage available via flexible credit-based options.

## Contents

* [Usage](#usage)
  * [Search example](#search-example)
  * [Browser example](#browser-example)
  * [Computer example](#computer-example)
  * [Search and browser example](#search-and-browser-example)
* [Architecture](#architecture)
  * [Using Chromium](#using-chromium)
  * [Using computer](#using-computer)
* [Developing](#developing)

## Usage

**Note:** Some of the below recordings have sections where it's loading cut out for viewability, the end-to-end one shotting is still true and various caching or optimizations can be applied to make live usage more alike the GIFs shown below.

### Search example

Here's an example of doing web search to look up news related to Cloudflare and bots:

![Using search to look up news related to Cloudflare and bots](assets/search_usage.gif)

### Browser example

Here's an example of using a web browser to get page content in order to summarize:

![Using a browser to get content related to Cloudflare and bots](assets/browser_usage.gif)

### Computer example

Here's an example of using a computer to run a command inside the terminal that's opened using a NoVNC server hosted on a Cloudflare container:

![Using a computer to run a command inside the terminal](assets/computer_usage.gif)

### Search and browser example

Here's an example of using search results to fetch links and then a browser to obtain the content to provide a summary of:

![Using search and a browser together](assets/search_and_browser_usage.gif)

## Architecture

Breakdown of how computer use is architected. Shout out to openai computer using agent only needing browser. Then breakdown of this

### Using Chromium

[security](https://chromium-review.googlesource.com/c/chromium/src/+/952522)

### Using computer

This utilizes some of the same dependencies as [Anthropic's computer use](https://github.com/anthropics/anthropic-quickstarts/tree/main/computer-use-demo)

## Developing

First, install dependencies.

```bash
$ yarn install
```

Log in to your account if this is your first time interacting with the [wrangler CLI](https://developers.cloudflare.com/workers/wrangler/).

```bash
$ yarn wrangler login
```

Then, simply deploy.

```bash
$ yarn wrangler deploy
```

At the end of the output, you should see the URL you can open in your browser to view the application.

```
...
Deployed agentflare triggers (0.34 sec)
    https://agentflare.account_id.workers.dev      <---- This
  Current Version ID: some-pretty-cool-uuid
  Cloudflare collects anonymous telemetry about your usage of Wrangler. Learn more at https://github.com/cloudflare/workers-sdk/tree/main/packages/wrangler/telemetry.md
  Done in 225.40s.
🏁 Wrangler Action completed
```
