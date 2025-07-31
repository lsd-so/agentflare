import { getContainer, switchPort } from "@cloudflare/containers";
import { AppBindings } from "../types";

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
  private apiKey: string;
  constructor(env: AppBindings, baseUrl?: string, apiKey?: string) {
    this.env = env;
    this.baseUrl = baseUrl || 'https://agentflare.yev-81d.workers.dev';
    this.apiKey = apiKey || '';
  }

  async executeAction(action: BrowserAction): Promise<BrowserResponse> {
    try {
      const container = getContainer(this.env.BROWSER_CONTAINER);

      switch (action.type) {
        case 'navigate':
          const navRequest = new Request(`${this.baseUrl}/navigate?url=${encodeURIComponent(action.url!)}`);
          const navResponse = await container.fetch(switchPort(navRequest, 3000));
          return await navResponse.json();

        case 'click':
          const clickRequest = new Request(`${this.baseUrl}/click`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ selector: action.selector })
          });
          const clickResponse = await container.fetch(switchPort(clickRequest, 3000));
          return await clickResponse.json();

        case 'type':
          const typeRequest = new Request(`${this.baseUrl}/type`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ selector: action.selector, text: action.text })
          });
          const typeResponse = await container.fetch(switchPort(typeRequest, 3000));
          return await typeResponse.json();

        case 'screenshot':
          const screenshotRequest = new Request(`${this.baseUrl}/screenshot`);
          const screenshotResponse = await container.fetch(switchPort(screenshotRequest, 3000));
          return await screenshotResponse.json();

        case 'evaluate':
          const evalRequest = new Request(`${this.baseUrl}/evaluate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ script: action.script })
          });
          const evalResponse = await container.fetch(switchPort(evalRequest, 3000));
          return await evalResponse.json();

        case 'wait':
          const waitRequest = new Request(`${this.baseUrl}/wait`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ timeout: action.timeout || 1000 })
          });
          const waitResponse = await container.fetch(switchPort(waitRequest, 3000));
          return await waitResponse.json();

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
    try {
      const container = getContainer(this.env.BROWSER_CONTAINER);
      const request = new Request(`${this.baseUrl}/screenshot`);
      const response = await container.fetch(switchPort(request, 3000));
      const result = await response.json();
      return result.success ? result.screenshot : null;
    } catch (error) {
      return null;
    }
  }


  async processWithLLM(prompt: string): Promise<{ success: boolean; message: string; error?: string }> {
    if (!this.apiKey) {
      return { success: false, message: 'API key required for LLM functionality', error: 'Missing API key' };
    }

    try {
      const container = getContainer(this.env.BROWSER_CONTAINER);
      const request = new Request(`${this.baseUrl}/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt,
          apiKey: this.apiKey
        })
      });
      const response = await container.fetch(switchPort(request, 3000));

      const result = await response.json();

      if (result.success) {
        return {
          success: true,
          message: result.message
        };
      } else {
        return {
          success: false,
          message: 'Failed to process browser task',
          error: result.error
        };
      }
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
): Promise<{ success: boolean; message: string; error?: string }> {
  const agent = new BrowserAgent(env, baseUrl, apiKey);
  return await agent.processWithLLM(prompt);
}

export async function createBrowserAgent(
  env: AppBindings,
  baseUrl?: string,
  apiKey?: string
): Promise<BrowserAgent> {
  return new BrowserAgent(env, baseUrl, apiKey);
}
