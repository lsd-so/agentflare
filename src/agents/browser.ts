import { getContainer } from "@cloudflare/containers";
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
  private containerUrl?: string;

  constructor(env: AppBindings, baseUrl?: string, apiKey?: string) {
    this.env = env;
    this.baseUrl = baseUrl || 'https://agentflare.yev-81d.workers.dev';
    this.apiKey = apiKey || '';
  }

  private async getContainerUrl(): Promise<string> {
    if (!this.containerUrl) {
      const container = await getContainer(this.env.BROWSER_CONTAINER, "browser");
      this.containerUrl = await container.getURL();
    }
    return this.containerUrl;
  }

  async executeAction(action: BrowserAction): Promise<BrowserResponse> {
    try {
      const containerUrl = await this.getContainerUrl();
      
      switch (action.type) {
        case 'navigate':
          const navResponse = await fetch(`${containerUrl}/navigate?url=${encodeURIComponent(action.url!)}`);
          return await navResponse.json();

        case 'click':
          const clickResponse = await fetch(`${containerUrl}/click`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ selector: action.selector })
          });
          return await clickResponse.json();

        case 'type':
          const typeResponse = await fetch(`${containerUrl}/type`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ selector: action.selector, text: action.text })
          });
          return await typeResponse.json();

        case 'screenshot':
          const screenshotResponse = await fetch(`${containerUrl}/screenshot`);
          return await screenshotResponse.json();

        case 'evaluate':
          const evalResponse = await fetch(`${containerUrl}/evaluate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ script: action.script })
          });
          return await evalResponse.json();

        case 'wait':
          const waitResponse = await fetch(`${containerUrl}/wait`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ timeout: action.timeout || 1000 })
          });
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
      const containerUrl = await this.getContainerUrl();
      const response = await fetch(`${containerUrl}/screenshot`);
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
      const containerUrl = await this.getContainerUrl();
      const response = await fetch(`${containerUrl}/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: prompt,
          apiKey: this.apiKey 
        })
      });

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
