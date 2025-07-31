import { AppBindings } from "../types";
import { callBrowserAgent } from "./browser";
import { callComputerAgent } from "./computer";
import { callSerpAgent, SerpResponse } from "./serp";

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
  private serpApiKey?: string;

  constructor(env: AppBindings, baseUrl?: string, serpApiKey?: string) {
    this.env = env;
    this.baseUrl = baseUrl || '';
    this.serpApiKey = serpApiKey;
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
    const browserAgent = await callBrowserAgent(this.env, task.prompt, this.baseUrl);
    
    return {
      success: true,
      message: `Browser agent has been initialized and is ready to execute: "${task.prompt}"`,
      taskType: 'browser',
      data: { agent: browserAgent },
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
    const searchResults = await callSerpAgent(
      task.prompt, 
      'duckduckgo', 
      this.serpApiKey
    );
    
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
    return await this.executeTask({
      type: 'auto',
      prompt: request
    });
  }
}

export async function createMainAgent(
  env: AppBindings, 
  baseUrl?: string,
  serpApiKey?: string
): Promise<MainAgent> {
  return new MainAgent(env, baseUrl, serpApiKey);
}