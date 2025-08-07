import { getContainer } from "@cloudflare/containers";
import { AppBindings } from "../types";
import { generateText, tool } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';

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
  private apiKey: string;

  constructor(env: AppBindings, apiKey?: string) {
    this.env = env;
    this.apiKey = apiKey || '';
  }

  async executeAction(action: ComputerAction): Promise<ComputerResponse> {
    try {
      const container = getContainer(this.env.COMPUTER_CONTAINER);

      const request = new Request(`http://localhost:3000/action`, {
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
      const request = new Request(`http://localhost:3000/screenshot`);
      const response = await container.fetch(request);
      const data = await response.text();

      // Extract base64 from "Screenshot:data:image/jpeg;base64,..." format
      const base64Data = data.replace('Screenshot:', '');
      return base64Data || null;
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

  private getComputerTools() {
    return {
      screenshot: tool({
        description: 'Take a screenshot of the desktop to see what is currently displayed',
        parameters: z.object({}),
        execute: async () => {
          const screenshot = await this.getScreenshot();
          return { success: true, screenshot };
        }
      }),
      click: tool({
        description: 'Click at specific coordinates on the desktop',
        parameters: z.object({
          x: z.number().describe('X coordinate to click'),
          y: z.number().describe('Y coordinate to click')
        }),
        execute: async ({ x, y }) => {
          return await this.click(x, y);
        }
      }),
      type: tool({
        description: 'Type text (keyboard input)',
        parameters: z.object({
          text: z.string().describe('Text to type')
        }),
        execute: async ({ text }) => {
          return await this.type(text);
        }
      }),
      key: tool({
        description: 'Press a specific key or key combination',
        parameters: z.object({
          key: z.string().describe('Key to press (e.g., "Enter", "Tab", "Ctrl+C", "Alt+F4")')
        }),
        execute: async ({ key }) => {
          return await this.pressKey(key);
        }
      }),
      scroll: tool({
        description: 'Scroll in a specified direction',
        parameters: z.object({
          direction: z.enum(['up', 'down', 'left', 'right']).describe('Direction to scroll'),
          amount: z.number().optional().describe('Amount to scroll (default: 3)')
        }),
        execute: async ({ direction, amount = 3 }) => {
          return await this.scroll(direction, amount);
        }
      }),
      move: tool({
        description: 'Move mouse to specific coordinates without clicking',
        parameters: z.object({
          x: z.number().describe('X coordinate to move to'),
          y: z.number().describe('Y coordinate to move to')
        }),
        execute: async ({ x, y }) => {
          return await this.moveMouse(x, y);
        }
      })
    };
  }

  async processWithLLM(prompt: string): Promise<{ success: boolean; message: string; error?: string }> {
    if (!this.apiKey) {
      return { success: false, message: 'API key required for LLM functionality', error: 'Missing API key' };
    }

    try {
      const screenshot = await this.getScreenshot();
      const tools = this.getComputerTools();

      const anthropic = createAnthropic({
        apiKey: this.apiKey
      });

      const result = await generateText({
        model: anthropic('claude-3-5-sonnet-20241022'),
        messages: [
          {
            role: 'system',
            content: `You are a computer control agent that can interact with desktop environments via VNC. You can:

- screenshot: Take screenshots to see the desktop
- click: Click at specific coordinates
- type: Type text via keyboard
- key: Press specific keys or key combinations
- scroll: Scroll in any direction
- move: Move mouse cursor

Always take a screenshot first to see the current desktop state, then proceed with actions. Be precise with coordinates and explain what you're doing. When clicking, aim for the center of buttons or UI elements.`
          },
          {
            role: 'user',
            content: `${prompt}${screenshot ? '\n\nCurrent desktop screenshot is attached.' : ''}`
          }
        ],
        tools,
        maxSteps: 10,
        toolChoice: 'auto'
      });

      return {
        success: true,
        message: result.text
      };
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
): Promise<ComputerAgent> {
  const agent = new ComputerAgent(env, apiKey);
  return agent;
}
