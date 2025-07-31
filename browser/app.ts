const express = require('express');
const puppeteer = require('puppeteer-core');

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
      browser = await puppeteer.connect({
        browserWSEndpoint: 'ws://localhost:9222'
      });
      
      page = await browser.newPage();
      await page.setViewport({ width: 1080, height: 1024 });
      
      console.log('Browser initialized successfully');
    } catch (error) {
      console.error('Failed to initialize browser:', error);
      throw error;
    }
  }
  return { browser, page };
};

// Ensure browser is ready
const ensureBrowser = async () => {
  if (!browser || !page) {
    await initializeBrowser();
  }
  return page;
};

// Navigation endpoint
app.get('/navigate', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ success: false, error: 'URL parameter required' });
    }

    const page = await ensureBrowser();
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    
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

    // Import AI SDK
    const { generateText, tool } = require('ai');
    const { createAnthropic } = require('@ai-sdk/anthropic');
    const { z } = require('zod');

    // Ensure browser is ready
    const currentPage = await ensureBrowser();
    
    // Take initial screenshot
    const screenshot = await currentPage.screenshot({ encoding: 'base64' });
    
    // Define browser tools
    const tools = {
      navigate: tool({
        description: 'Navigate to a specific URL in the browser',
        parameters: z.object({
          url: z.string().describe('The URL to navigate to')
        }),
        execute: async ({ url }) => {
          await currentPage.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
          return { success: true, message: `Navigated to ${url}` };
        }
      }),
      click: tool({
        description: 'Click on an element using a CSS selector',
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
        parameters: z.object({}),
        execute: async () => {
          const screenshot = await currentPage.screenshot({ encoding: 'base64' });
          return { success: true, screenshot };
        }
      }),
      evaluate: tool({
        description: 'Execute JavaScript code in the browser context',
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
        parameters: z.object({
          timeout: z.number().describe('Number of milliseconds to wait')
        }),
        execute: async ({ timeout }) => {
          await new Promise(resolve => setTimeout(resolve, timeout));
          return { success: true, message: `Waited ${timeout}ms` };
        }
      })
    };

    // Create Anthropic client
    const anthropic = createAnthropic({
      apiKey: apiKey
    });

    // Generate response using LLM
    const result = await generateText({
      model: anthropic('claude-3-5-sonnet-20241022'),
      messages: [
        {
          role: 'system',
          content: `You are a browser automation agent running inside a Chromium container. You can navigate websites, interact with elements, take screenshots, and execute JavaScript.

Available tools:
- navigate: Go to URLs
- click: Click elements by CSS selector
- type: Type text into input fields
- screenshot: Take screenshots to see current page
- evaluate: Execute JavaScript code
- wait: Wait for specified time

Always take a screenshot first to see what's on the page, then proceed with the requested actions. Be precise with CSS selectors and explain what you're doing.`
        },
        {
          role: 'user',
          content: `${prompt}${screenshot ? '\n\nCurrent page screenshot is attached.' : ''}`
        }
      ],
      tools,
      maxToolRoundtrips: 10,
      toolChoice: 'auto'
    });

    res.json({ 
      success: true, 
      message: result.text,
      toolCalls: result.toolCalls,
      toolResults: result.toolResults
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