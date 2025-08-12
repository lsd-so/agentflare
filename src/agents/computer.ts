import { getContainer } from "@cloudflare/containers";
import { AppBindings } from "../types";

export class ComputerAgent {
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
      const container = getContainer(this.env.COMPUTER_CONTAINER);
      const request = new Request(`http://localhost:3000/agent?apiKey=${encodeURIComponent(this.apiKey)}&prompt=${encodeURIComponent(prompt)}`, {
        method: 'GET',
      });
      const response = await container.fetch(request);

      const result = await response.json() as Record<string, any>;

      if (result.success) {
        return {
          result,
          success: true,
          message: result.message
        } as any;
      } else {
        return {
          result,
          success: false,
          message: 'Failed to process computer task',
          error: result.error
        } as any;
      }
    } catch (error) {
      return {
        success: false,
        message: 'Failed to process computer task',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export async function callComputerAgent(
  env: AppBindings,
  prompt: string,
  apiKey?: string
): Promise<{ success: boolean; message: string; error?: string }> {
  const agent = new ComputerAgent(env, apiKey);
  return await agent.processWithLLM(prompt);
}
