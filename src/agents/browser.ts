import { getContainer } from "@cloudflare/containers";
import { AppBindings } from "../types";
import puppeteer from 'puppeteer-core/lib/esm/puppeteer/puppeteer-core-browser.js';

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

  constructor(env: AppBindings, baseUrl?: string) {
    this.env = env;
    this.baseUrl = baseUrl || 'https://agentflare.yev-81d.workers.dev';
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
}

export async function callBrowserAgent(
  env: AppBindings,
  prompt: string,
  baseUrl?: string
): Promise<BrowserAgent> {
  const agent = new BrowserAgent(env, baseUrl);
  await agent.connect();
  return agent;
}
