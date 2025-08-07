const express = require('express');
import puppeteer, { KnownDevices } from 'puppeteer-core';
// const devices = require('puppeteer-core/DeviceDescriptors');
const { generateText, tool, stepCountIs } = require('ai');
const { createAnthropic } = require('@ai-sdk/anthropic');
const { z } = require('zod');
const TurndownService = require('turndown');

const app = express();
const port = 3000;

// Middleware
app.use(express.json());

let browser = null;
let page = null;

// Initialize browser connection
const initializeBrowser = async () => {
  if (!browser) {
    try {
      console.log('Starting browser initialization process');

      // Step 1: Fetch browser info from /json/version endpoint
      console.log('Fetching browser info from /json/version endpoint');
      const versionResponse = await fetch('http://localhost:9222/json/version');

      if (!versionResponse.ok) {
        throw new Error(`Failed to fetch version info: ${versionResponse.status} ${versionResponse.statusText}`);
      }

      const versionData = await versionResponse.json();
      console.log('Browser version data:', JSON.stringify(versionData, null, 2));

      // Step 2: Extract WebSocket debugger URL
      const wsEndpoint = versionData.webSocketDebuggerUrl;
      if (!wsEndpoint) {
        throw new Error('No webSocketDebuggerUrl found in version response');
      }
      console.log('Using WebSocket endpoint:', wsEndpoint);

      // Step 3: Connect to Puppeteer using dynamic endpoint
      console.log('Connecting to Puppeteer with dynamic endpoint');
      browser = await puppeteer.connect({
        browserWSEndpoint: wsEndpoint
      });
      console.log('Puppeteer connection established successfully');

      // Step 4: Create new page and set viewport
      console.log('Creating new page and setting viewport');
      page = await browser.newPage();

      await page.emulate(KnownDevices['iPhone SE']);
      await page.setViewport({ width: 375, height: 667 });

      // await page.setViewport({ width: 1080, height: 1024 });

      console.log('Browser initialized successfully with dynamic endpoint');
    } catch (error) {
      console.error('Failed to initialize browser with dynamic endpoint:', error);

      // Fallback to hardcoded endpoint
      console.log('Attempting fallback to hardcoded WebSocket endpoint');
      try {
        browser = await puppeteer.connect({
          browserWSEndpoint: 'ws://localhost:9222'
        });

        page = await browser.newPage();
        await page.setViewport({ width: 1080, height: 1024 });

        console.log('Browser initialized successfully with fallback endpoint');
      } catch (fallbackError) {
        console.error('Fallback initialization also failed:', fallbackError);
        throw fallbackError;
      }
    }
  }
  return { browser, page };
};

// Ensure browser is ready
const ensureBrowser = async () => {
  if (!browser || !page) {
    await initializeBrowser();
  }

  // TODO - something to clear or refresh the page when it's requested rather than recycling the same one over and over
  return page;
};

// Get browser automation tools for LLM
const getBrowserTools = async () => {
  const currentPage = await ensureBrowser();

  return {
    navigate: tool({
      description: 'Navigate to a specific URL in the browser',
      parameters: z.object({
        url: z.string().describe('The URL to navigate to')
      }),
      inputSchema: z.object({
        url: z.string().describe('The URL to navigate to')
      }),
      execute: async ({ url }) => {
        await currentPage.goto(url, { timeout: 30000 });
        return { success: true, message: `Navigated to ${url}` };
      }
    }),
    click: tool({
      description: 'Click on an element using a CSS selector',
      inputSchema: z.object({
        selector: z.string().describe('CSS selector for the element to click')
      }),
      parameters: z.object({
        selector: z.string().describe('CSS selector for the element to click')
      }),
      execute: async ({ selector }) => {
        await currentPage.waitForSelector(selector, { timeout: 10000 });
        await currentPage.click(selector);
        return { success: true, message: `Clicked on ${selector}` };
      }
    }),
    type: tool({
      description: 'Type text into an input field using a CSS selector',
      inputSchema: z.object({
        selector: z.string().describe('CSS selector for the element to click')
      }),
      parameters: z.object({
        selector: z.string().describe('CSS selector for the input field'),
        text: z.string().describe('Text to type into the field')
      }),
      execute: async ({ selector, text }) => {
        await currentPage.waitForSelector(selector, { timeout: 10000 });
        await currentPage.type(selector, text);
        return { success: true, message: `Typed "${text}" into ${selector}` };
      }
    }),
    screenshot: tool({
      description: 'Take a screenshot of the current browser page',
      inputSchema: z.object({}),
      parameters: z.object({}),
      execute: async () => {
        const screenshot = await currentPage.screenshot({ encoding: 'base64' });
        return { success: true, screenshot };
      }
    }),
    evaluate: tool({
      description: 'Execute JavaScript code in the browser context',
      inputSchema: z.object({
        script: z.string().describe('JavaScript code to execute')
      }),
      parameters: z.object({
        script: z.string().describe('JavaScript code to execute')
      }),
      execute: async ({ script }) => {
        const result = await currentPage.evaluate(script);
        return { success: true, result };
      }
    }),
    wait: tool({
      description: 'Wait for a specified number of milliseconds',
      inputSchema: z.object({
        timeout: z.number().describe('Number of milliseconds to wait')
      }),
      parameters: z.object({
        timeout: z.number().describe('Number of milliseconds to wait')
      }),
      execute: async ({ timeout }) => {
        await new Promise(resolve => setTimeout(resolve, timeout));
        return { success: true, message: `Waited ${timeout}ms` };
      }
    }),
    getHTML: tool({
      description: 'Get the HTML content of the current browser page',
      inputSchema: z.object({}),
      parameters: z.object({}),
      execute: async () => {
        const html = await currentPage.content();
        return { success: true, html };
      }
    }),
    getMarkdown: tool({
      description: 'Get the markdown content of the current browser page by converting HTML to markdown',
      inputSchema: z.object({}),
      parameters: z.object({}),
      execute: async () => {
        const html = await currentPage.content();
        const turndownService = new TurndownService();
        const markdown = turndownService.turndown(html);
        return { success: true, markdown };
      }
    })
  };
};

// Navigation endpoint
app.get('/navigate', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ success: false, error: 'URL parameter required' });
    }

    const page = await ensureBrowser();
    await page.goto(url, { timeout: 30000 });

    res.json({ success: true, message: `Navigated to ${url}` });
  } catch (error) {
    console.error('Navigation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Click endpoint
app.post('/click', async (req, res) => {
  try {
    const { selector } = req.body;
    if (!selector) {
      return res.status(400).json({ success: false, error: 'Selector required' });
    }

    const page = await ensureBrowser();
    await page.waitForSelector(selector, { timeout: 10000 });
    await page.click(selector);

    res.json({ success: true, message: `Clicked on ${selector}` });
  } catch (error) {
    console.error('Click error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Type endpoint
app.post('/type', async (req, res) => {
  try {
    const { selector, text } = req.body;
    if (!selector || !text) {
      return res.status(400).json({ success: false, error: 'Selector and text required' });
    }

    const page = await ensureBrowser();
    await page.waitForSelector(selector, { timeout: 10000 });
    await page.type(selector, text);

    res.json({ success: true, message: `Typed "${text}" into ${selector}` });
  } catch (error) {
    console.error('Type error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Screenshot endpoint
app.get('/screenshot', async (req, res) => {
  try {
    const page = await ensureBrowser();
    const screenshot = await page.screenshot({
      encoding: 'base64',
      fullPage: false
    });

    res.json({ success: true, screenshot });
  } catch (error) {
    console.error('Screenshot error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Evaluate JavaScript endpoint
app.post('/evaluate', async (req, res) => {
  try {
    const { script } = req.body;
    if (!script) {
      return res.status(400).json({ success: false, error: 'Script required' });
    }

    const page = await ensureBrowser();
    const result = await page.evaluate(script);

    res.json({ success: true, result });
  } catch (error) {
    console.error('Evaluate error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Wait endpoint
app.post('/wait', async (req, res) => {
  try {
    const { timeout = 1000 } = req.body;

    await new Promise(resolve => setTimeout(resolve, timeout));

    res.json({ success: true, message: `Waited ${timeout}ms` });
  } catch (error) {
    console.error('Wait error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Title endpoint for debugging
app.get('/title', async (req, res) => {
  console.log("Received a request for title!");
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ success: false, error: 'URL parameter required' });
    }

    // if (true) {
    //   return res.json({
    //     message: "Here is a hardcoded response"
    //   });
    // }

    console.log("Going to ensure a browser");

    const page = await ensureBrowser();

    console.log("Page should be truthy");

    await page.goto(url, { timeout: 30000 });

    console.log("Getting title");

    const title = await page.title();

    res.json({
      success: true,
      title: title,
      url: url,
      message: `Page title: "${title}"`
    });
  } catch (error) {
    console.error('Title error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Agent endpoint for LLM-powered interactions
app.post('/agent', async (req, res) => {
  try {
    const { prompt, apiKey } = req.body;
    if (!prompt) {
      return res.status(400).json({ success: false, error: 'Prompt required' });
    }
    if (!apiKey) {
      return res.status(400).json({ success: false, error: 'API key required' });
    }

    // Ensure browser is ready
    const currentPage = await ensureBrowser();

    // Take initial screenshot
    const screenshot = await currentPage.screenshot({ encoding: 'base64' });

    // Get browser tools
    const tools = await getBrowserTools();

    // Create Anthropic client
    const anthropic = createAnthropic({
      apiKey: apiKey
    });

    // Generate response using LLM
    const result = await generateText({
      model: anthropic('claude-3-7-sonnet-20250219'),
      system: `You are a browser agent running inside a Chromium container. You can navigate websites, interact with elements, take screenshots, execute JavaScript, and extract content.

Available tools:
- navigate: Go to URLs
- click: Click elements by CSS selector
- type: Type text into input fields
- screenshot: Take screenshots to see current page
- evaluate: Execute JavaScript code
- wait: Wait for specified time
- getHTML: Get the full HTML content of the current page
- getMarkdown: Get the page content converted to markdown format

Use HTML or markdown when answering about information on a page. Answer the user prompt directly with text rather than just describe what's on the screen`,
      prompt: `${prompt}${screenshot ? '\n\nCurrent page screenshot is attached.' : ''}`,
      tools,
      stopWhen: stepCountIs(3),
      // maxSteps: 10,
      toolChoice: 'auto',
      prepareStep: async ({ messages }) => {
        // Find all messages containing screenshots, HTML, or markdown content
        const screenshotIndices = [];
        const htmlIndices = [];
        const markdownIndices = [];

        for (let i = 0; i < messages.length; i++) {
          const message = messages[i];

          // Check for screenshots in assistant messages
          if (message.role === 'assistant' && message.content) {
            const content = Array.isArray(message.content) ? message.content : [message.content];
            const hasScreenshot = content.some(part =>
              typeof part === 'object' && part.type === 'image'
            );
            if (hasScreenshot) {
              screenshotIndices.push(i);
            }
          }

          // Check for HTML/markdown in tool result messages
          if (message.role === 'tool' && message.content) {
            const contentStr = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);

            // Look for HTML tool results (large HTML content)
            if (contentStr.includes('"html":') && contentStr.length > 1000) {
              htmlIndices.push(i);
            }

            // Look for markdown tool results (large markdown content)
            if (contentStr.includes('"markdown":') && contentStr.length > 1000) {
              markdownIndices.push(i);
            }
          }
        }

        // Collect all indices to filter
        const indicesToFilter = new Set();

        // Keep only the latest screenshot
        if (screenshotIndices.length > 1) {
          screenshotIndices.slice(0, -1).forEach(index => indicesToFilter.add(index));
        }

        // Keep only the latest HTML result
        if (htmlIndices.length > 1) {
          htmlIndices.slice(0, -1).forEach(index => indicesToFilter.add(index));
        }

        // Keep only the latest markdown result
        if (markdownIndices.length > 1) {
          markdownIndices.slice(0, -1).forEach(index => indicesToFilter.add(index));
        }

        // If we have content to filter, remove old instances
        if (indicesToFilter.size > 0) {
          const filteredMessages = messages.filter((message, index) => {
            return !indicesToFilter.has(index);
          });

          return {
            messages: filteredMessages
          };
        }
        // No changes needed
        return { messages };
      }
    });

    res.json({
      success: true,
      message: result.text,
      toolCalls: result.toolCalls,
      toolResults: result.toolResults,

    });

  } catch (error) {
    console.error('Agent error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Browser container is healthy',
    browserConnected: !!browser,
    pageReady: !!page
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down browser container...');
  if (browser) {
    await browser.close();
  }
  process.exit(0);
});

app.listen(port, '0.0.0.0', async () => {
  console.log(`Browser container app listening on port ${port}`);

  // Initialize browser on startup
  try {
    await initializeBrowser();
    console.log('Browser ready for requests');
  } catch (error) {
    console.error('Failed to initialize browser on startup:', error);
  }
});
