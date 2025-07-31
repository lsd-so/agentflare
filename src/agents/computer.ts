import { getContainer } from "@cloudflare/containers";
import { AppBindings } from "../types";

export interface ComputerAction {
  type: 'screenshot' | 'click' | 'type' | 'key' | 'scroll' | 'move';
  x?: number;
  y?: number;
  text?: string;
  key?: string;
  scrollDirection?: 'up' | 'down' | 'left' | 'right';
  scrollAmount?: number;
}

export interface ComputerResponse {
  success: boolean;
  data?: any;
  screenshot?: string;
  error?: string;
}

export class ComputerAgent {
  private env: AppBindings;
  private baseUrl: string;

  constructor(env: AppBindings, baseUrl?: string) {
    this.env = env;
    this.baseUrl = baseUrl || 'https://agentflare.yev-81d.workers.dev';
  }

  async executeAction(action: ComputerAction): Promise<ComputerResponse> {
    try {
      const container = getContainer(this.env.COMPUTER_CONTAINER);
      
      const request = new Request(`${this.baseUrl}/computer/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action)
      });
      
      const response = await container.fetch(request);
      const data = await response.json();
      
      return { success: response.ok, data };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async getScreenshot(): Promise<string | null> {
    try {
      const container = getContainer(this.env.COMPUTER_CONTAINER);
      const request = new Request(`${this.baseUrl}/computer/screenshot`);
      const response = await container.fetch(request);
      const data = await response.json();
      
      return data.screenshot || null;
    } catch (error) {
      return null;
    }
  }

  async click(x: number, y: number): Promise<ComputerResponse> {
    return await this.executeAction({ type: 'click', x, y });
  }

  async type(text: string): Promise<ComputerResponse> {
    return await this.executeAction({ type: 'type', text });
  }

  async pressKey(key: string): Promise<ComputerResponse> {
    return await this.executeAction({ type: 'key', key });
  }

  async scroll(direction: 'up' | 'down' | 'left' | 'right', amount: number = 3): Promise<ComputerResponse> {
    return await this.executeAction({ type: 'scroll', scrollDirection: direction, scrollAmount: amount });
  }

  async moveMouse(x: number, y: number): Promise<ComputerResponse> {
    return await this.executeAction({ type: 'move', x, y });
  }
}

export async function callComputerAgent(
  env: AppBindings,
  prompt: string,
  baseUrl?: string
): Promise<ComputerAgent> {
  const agent = new ComputerAgent(env, baseUrl);
  return agent;
}