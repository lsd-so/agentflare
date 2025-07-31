import { AppBindings } from "../types";
import { callBrowserAgent } from "./browser";
import { callComputerAgent } from "./computer";
import { callSerpAgent, SerpResponse } from "./serp";
import { generateText, tool } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';

export interface AgentTask {
  type: 'browser' | 'computer' | 'search' | 'auto';
  prompt: string;
  context?: string;
}

export interface AgentResponse {
  success: boolean;
  message: string;
  taskType: string;
  data?: any;
  error?: string;
  executionTime: number;
}

export class MainAgent {
  private env: AppBindings;
  private baseUrl: string;
  private apiKey: string;

  constructor(env: AppBindings, baseUrl?: string, apiKey?: string) {
    this.env = env;
    this.baseUrl = baseUrl || 'https://agentflare.yev-81d.workers.dev';
    this.apiKey = apiKey || '';
  }

  private getTools() {
    return {
      call_browser_agent: tool({
        description: 'Use this tool to automate web browsers. Can navigate to websites, click elements, type text, take screenshots, and interact with web pages.',
        parameters: z.object({
          prompt: z.string().describe('Natural language description of what you want to do in the browser')
        }),
        execute: async ({ prompt }) => {
          console.log("Going to call browser agent");
          const result = await callBrowserAgent(this.env, prompt, this.baseUrl, this.apiKey);
          return { message: result.message, success: result.success, error: result.error };
        }
      }),
      call_computer_agent: tool({
        description: 'Use this tool to control desktop environments via VNC. Can click anywhere on screen, type text, use keyboard shortcuts, and take screenshots of the desktop.',
        parameters: z.object({
          prompt: z.string().describe('Natural language description of what you want to do on the desktop')
        }),
        execute: async ({ prompt }) => {
          console.log("Going to call computer agent");
          const agent = await callComputerAgent(this.env, prompt, this.baseUrl, this.apiKey);
          const result = await agent.processWithLLM(prompt);
          return { message: result.message, success: result.success, error: result.error };
        }
      }),
      call_serp_agent: tool({
        description: 'Use this tool to search the web and get search results from Brave Search. Returns titles, URLs, and snippets for search results.',
        parameters: z.object({
          query: z.string().describe('The search query to execute')
        }),
        execute: async ({ query }) => {
          console.log("Going to call serp agent");
          const results = await callSerpAgent(query, 10, this.apiKey);
          return {
            message: `Found ${results.results.length} search results for "${query}"`,
            success: results.success,
            results: results.results,
            error: results.error
          };
        }
      })
    };
  }

  async executeTask(task: AgentTask): Promise<AgentResponse> {
    const startTime = Date.now();

    try {
      switch (task.type) {
        case 'browser':
          return await this.delegateToBrowser(task, startTime);
        case 'computer':
          return await this.delegateToComputer(task, startTime);
        case 'search':
          return await this.delegateToSearch(task, startTime);
        case 'auto':
          return await this.autoSelectAgent(task, startTime);
        default:
          return {
            success: false,
            message: `Unknown task type: ${task.type}`,
            taskType: task.type,
            error: 'Invalid task type specified',
            executionTime: Date.now() - startTime
          };
      }
    } catch (error) {
      return {
        success: false,
        message: 'Task execution failed',
        taskType: task.type,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime
      };
    }
  }

  private async delegateToBrowser(task: AgentTask, startTime: number): Promise<AgentResponse> {
    const result = await callBrowserAgent(this.env, task.prompt, this.baseUrl, this.apiKey);

    return {
      success: result.success,
      message: result.message,
      taskType: 'browser',
      error: result.error,
      executionTime: Date.now() - startTime
    };
  }

  private async delegateToComputer(task: AgentTask, startTime: number): Promise<AgentResponse> {
    const computerAgent = await callComputerAgent(this.env, task.prompt, this.baseUrl);

    return {
      success: true,
      message: `Computer agent has been initialized and is ready to execute: "${task.prompt}"`,
      taskType: 'computer',
      data: { agent: computerAgent },
      executionTime: Date.now() - startTime
    };
  }

  private async delegateToSearch(task: AgentTask, startTime: number): Promise<AgentResponse> {
    const searchResults = await callSerpAgent(task.prompt);

    if (searchResults.success) {
      const resultsText = searchResults.results
        .map(result => `${result.title}: ${result.snippet} (${result.url})`)
        .join('\n');

      return {
        success: true,
        message: `Found ${searchResults.results.length} search results for "${task.prompt}":\n\n${resultsText}`,
        taskType: 'search',
        data: searchResults,
        executionTime: Date.now() - startTime
      };
    } else {
      return {
        success: false,
        message: `Search failed for query: "${task.prompt}"`,
        taskType: 'search',
        error: searchResults.error,
        executionTime: Date.now() - startTime
      };
    }
  }

  private async autoSelectAgent(task: AgentTask, startTime: number): Promise<AgentResponse> {
    const prompt = task.prompt.toLowerCase();

    // Simple keyword-based routing logic
    // In practice, this would use LLM reasoning to determine the best agent

    if (this.containsWebKeywords(prompt)) {
      return await this.delegateToBrowser({ ...task, type: 'browser' }, startTime);
    } else if (this.containsDesktopKeywords(prompt)) {
      return await this.delegateToComputer({ ...task, type: 'computer' }, startTime);
    } else if (this.containsSearchKeywords(prompt)) {
      return await this.delegateToSearch({ ...task, type: 'search' }, startTime);
    } else {
      // Default to search for information gathering
      return await this.delegateToSearch({ ...task, type: 'search' }, startTime);
    }
  }

  private containsWebKeywords(prompt: string): boolean {
    const webKeywords = ['website', 'browser', 'web page', 'url', 'navigate', 'click', 'form', 'login'];
    return webKeywords.some(keyword => prompt.includes(keyword));
  }

  private containsDesktopKeywords(prompt: string): boolean {
    const desktopKeywords = ['desktop', 'application', 'window', 'file', 'folder', 'mouse', 'keyboard'];
    return desktopKeywords.some(keyword => prompt.includes(keyword));
  }

  private containsSearchKeywords(prompt: string): boolean {
    const searchKeywords = ['search', 'find', 'look up', 'research', 'information', 'what is', 'how to'];
    return searchKeywords.some(keyword => prompt.includes(keyword));
  }

  async processNaturalLanguageRequest(request: string): Promise<AgentResponse> {
    const startTime = Date.now();

    if (!this.apiKey) {
      return {
        success: false,
        message: 'API key is required for LLM functionality',
        taskType: 'error',
        error: 'Missing API key',
        executionTime: Date.now() - startTime
      };
    }

    try {
      const tools = this.getTools();

      console.log('Tools structure:', JSON.stringify(tools, null, 2));

      const anthropic = createAnthropic({
        apiKey: this.apiKey
      });

      console.log("Going to generate text");

      const result = await generateText({
        model: anthropic('claude-3-5-sonnet-20241022'),
        messages: [
          {
            role: 'system',
            content: `You are AgentFlare, an AI assistant that can help with web browsing, desktop automation, and search tasks. You have access to three specialized agents:

1. Browser Agent (call_browser_agent): For web automation tasks like navigating websites, clicking buttons, filling forms, taking screenshots
2. Computer Agent (call_computer_agent): For desktop automation via VNC, clicking anywhere on screen, typing, keyboard shortcuts
3. SERP Agent (call_serp_agent): For web search to get information from Brave Search

Use these tools when the user's request requires their capabilities. You can use multiple tools in sequence if needed. Always explain what you're doing and provide helpful responses based on the tool results.`
          },
          {
            role: 'user',
            content: request
          }
        ],
        tools,
        maxToolRoundtrips: 5,
        toolChoice: 'auto'
      });

      return {
        success: true,
        message: result.text,
        taskType: 'llm_powered',
        data: {
          toolCalls: result.toolCalls,
          toolResults: result.toolResults
        },
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      console.error('LLM processing error:', error);
      return {
        success: false,
        message: 'Failed to process request with LLM',
        taskType: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime
      };
    }
  }
}

export async function createMainAgent(
  env: AppBindings,
  baseUrl?: string,
  apiKey?: string
): Promise<MainAgent> {
  return new MainAgent(env, baseUrl, apiKey);
}
