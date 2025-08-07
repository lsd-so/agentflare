import { getContainer, switchPort } from "@cloudflare/containers";
import { AppBindings } from "../types";


export class BrowserAgent {
  private env: AppBindings;
  private apiKey: string;
  constructor(env: AppBindings, apiKey?: string) {
    this.env = env;
    this.apiKey = apiKey || '';
  }


  async processWithLLM(prompt: string): Promise<{ success: boolean; message: string; error?: string }> {
    if (!this.apiKey) {
      return { success: false, message: 'API key required for LLM functionality', error: 'Missing API key' };
    }

    try {
      const container = getContainer(this.env.BROWSER_CONTAINER);
      const request = new Request(`http://localhost:3000/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt,
          apiKey: this.apiKey
        })
      });
      const response = await container.fetch(request);

      const result = await response.json() as Record<string, any>;

      if (result.success) {
        return {
          // ...result,
          success: true,
          message: result.message
        };
      } else {
        return {
          // ...result,
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
  apiKey?: string
): Promise<{ success: boolean; message: string; error?: string }> {
  const agent = new BrowserAgent(env, apiKey);
  return await agent.processWithLLM(prompt);
}

