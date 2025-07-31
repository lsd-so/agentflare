import { getContainer } from "@cloudflare/containers";
import { AppBindings } from "../types";
import puppeteer from 'puppeteer-core/lib/esm/puppeteer/puppeteer-core-browser.js';
import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';

export interface BrowserAction {
  type: 'navigate' | 'click' | 'type' | 'screenshot' | 'evaluate' | 'wait';
  selector?: string;
  url?: string;
  text?: string;
  script?: string;
  timeout?: number;
}

export interface BrowserResponse {
  success: boolean;
  data?: any;
  screenshot?: string;
  error?: string;
}

export class BrowserAgent {
  private env: AppBindings;
  private baseUrl: string;
  private browser: any | null = null;
  private page: any | null = null;
  private apiKey: string;

  constructor(env: AppBindings, baseUrl?: string, apiKey?: string) {
    this.env = env;
    this.baseUrl = baseUrl || 'https://agentflare.yev-81d.workers.dev';
    this.apiKey = apiKey || '';
  }

  async connect(): Promise<void> {
    const container = getContainer(this.env.BROWSER_CONTAINER);
    const versionRequest = new Request(`${this.baseUrl}/json/version`);
    const response = await container.fetch(versionRequest);
    const result = await response.json() as { webSocketDebuggerUrl: string };

    let wsEndpoint = result.webSocketDebuggerUrl;
    if (this.baseUrl) {
      wsEndpoint = wsEndpoint.replace('ws://localhost', `wss://${new URL(this.baseUrl).host}`);
    }

    this.browser = await puppeteer.connect({
      browserWSEndpoint: wsEndpoint
    });

    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1080, height: 1024 });
  }

  async disconnect(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  async executeAction(action: BrowserAction): Promise<BrowserResponse> {
    if (!this.page) {
      await this.connect();
    }

    try {
      switch (action.type) {
        case 'navigate':
          await this.page!.goto(action.url!);
          return { success: true, data: { url: action.url } };

        case 'click':
          await this.page!.click(action.selector!);
          return { success: true, data: { clicked: action.selector } };

        case 'type':
          await this.page!.type(action.selector!, action.text!);
          return { success: true, data: { typed: action.text, into: action.selector } };

        case 'screenshot':
          const screenshot = await this.page!.screenshot({ encoding: 'base64' });
          return { success: true, screenshot: screenshot as string };

        case 'evaluate':
          const result = await this.page!.evaluate(action.script!);
          return { success: true, data: result };

        case 'wait':
          await new Promise(resolve => setTimeout(resolve, action.timeout || 1000));
          return { success: true };

        default:
          return { success: false, error: 'Unknown action type' };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getScreenshot(): Promise<string | null> {
    if (!this.page) {
      await this.connect();
    }

    try {
      return await this.page!.screenshot({ encoding: 'base64' }) as string;
    } catch (error) {
      return null;
    }
  }

  private getBrowserTools() {
    return {
      navigate: {
        description: 'Navigate to a specific URL in the browser',
        parameters: z.object({
          url: z.string().describe('The URL to navigate to')
        }),
        execute: async ({ url }: { url: string }) => {
          const result = await this.executeAction({ type: 'navigate', url });
          return result;
        }
      },
      click: {
        description: 'Click on an element using a CSS selector',
        parameters: z.object({
          selector: z.string().describe('CSS selector for the element to click')
        }),
        execute: async ({ selector }: { selector: string }) => {
          const result = await this.executeAction({ type: 'click', selector });
          return result;
        }
      },
      type: {
        description: 'Type text into an input field using a CSS selector',
        parameters: z.object({
          selector: z.string().describe('CSS selector for the input field'),
          text: z.string().describe('Text to type into the field')
        }),
        execute: async ({ selector, text }: { selector: string; text: string }) => {
          const result = await this.executeAction({ type: 'type', selector, text });
          return result;
        }
      },
      screenshot: {
        description: 'Take a screenshot of the current browser page',
        parameters: z.object({}),
        execute: async () => {
          const result = await this.executeAction({ type: 'screenshot' });
          return result;
        }
      },
      evaluate: {
        description: 'Execute JavaScript code in the browser context',
        parameters: z.object({
          script: z.string().describe('JavaScript code to execute')
        }),
        execute: async ({ script }: { script: string }) => {
          const result = await this.executeAction({ type: 'evaluate', script });
          return result;
        }
      },
      wait: {
        description: 'Wait for a specified number of milliseconds',
        parameters: z.object({
          timeout: z.number().describe('Number of milliseconds to wait')
        }),
        execute: async ({ timeout }: { timeout: number }) => {
          const result = await this.executeAction({ type: 'wait', timeout });
          return result;
        }
      }
    };
  }

  async processWithLLM(prompt: string): Promise<{ success: boolean; message: string; error?: string }> {
    if (!this.apiKey) {
      return { success: false, message: 'API key required for LLM functionality', error: 'Missing API key' };
    }

    try {
      await this.connect();
      const screenshot = await this.getScreenshot();
      const tools = this.getBrowserTools();

      const result = await generateText({
        model: anthropic('claude-3-5-sonnet-20241022', {
          apiKey: this.apiKey
        }),
        messages: [
          {
            role: 'system',
            content: `You are a browser automation agent. You can navigate websites, interact with elements, take screenshots, and execute JavaScript. 

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
        maxToolRoundtrips: 10
      });

      return {
        success: true,
        message: result.text
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to process browser task',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export async function callBrowserAgent(
  env: AppBindings,
  prompt: string,
  baseUrl?: string,
  apiKey?: string
): Promise<BrowserAgent> {
  const agent = new BrowserAgent(env, baseUrl, apiKey);
  await agent.connect();
  return agent;
}
