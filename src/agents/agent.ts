import { AppBindings } from "../types";
import { callBrowserAgent } from "./browser";
import { callComputerAgent } from "./computer";
import { generateText, tool } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import * as cheerio from 'cheerio';

export interface AgentTask {
  type: 'browser' | 'computer' | 'search' | 'auto';
  prompt: string;
  context?: string;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  position: number;
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
  private apiKey: string;

  constructor(env: AppBindings, apiKey?: string) {
    this.env = env;
    this.apiKey = apiKey || '';
  }

  private async searchBrave(query: string, maxResults: number = 10): Promise<{ success: boolean; results: SearchResult[]; error?: string }> {
    const searchUrl = `https://search.brave.com/search?q=${encodeURIComponent(query)}`;
    console.log(`🔍 DIRECT SEARCH: Starting Brave search for query: "${query}"`);
    console.log(`🔍 DIRECT SEARCH: Search URL: ${searchUrl}`);

    try {
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      console.log(`🔍 DIRECT SEARCH: HTTP response status: ${response.status}`);
      if (!response.ok) {
        throw new Error(`Brave Search request failed: ${response.status}`);
      }

      if (true) {
        return { success: true, results: [] };
      }

      const html = await response.text();
      console.log(`🔍 DIRECT SEARCH: Received HTML response [${html.length} characters]`);

      const $ = cheerio.load(html);

      const results: SearchResult[] = [];
      const searchResults = $('div#results div[data-type="web"] > a');
      console.log(`🔍 DIRECT SEARCH: Found ${searchResults.length} search result elements`);

      // Debug: Try alternative selectors if main one doesn't work
      if (searchResults.length === 0) {
        console.log('🔍 DIRECT SEARCH: No results with main selector, trying alternatives...');
        const altSelectors = [
          'div#results a[href]',
          '.result a[href]',
          '[data-type="web"] a',
          '.web-result a',
          'div.result a'
        ];

        for (const selector of altSelectors) {
          const altResults = $(selector);
          console.log(`🔍 DIRECT SEARCH: Selector '${selector}' found ${altResults.length} elements`);
        }
      }

      searchResults.slice(0, maxResults).each((index, element) => {
        const $element = $(element);
        const url = $element.attr('href');
        const title = $element.find('h4, .title').text().trim() || $element.text().trim();

        console.log(`🔍 DIRECT SEARCH: Processing result ${index + 1}: "${title}"`);

        // Try to find snippet from nearby elements
        const snippet = $element.parent().find('.snippet, .description, p').first().text().trim() ||
          $element.next().text().trim() ||
          'No description available';

        if (url && title) {
          results.push({
            title,
            url,
            snippet,
            position: index + 1
          });
          console.log(`🔍 DIRECT SEARCH: ✅ Added result ${index + 1}`);
        } else {
          console.log(`🔍 DIRECT SEARCH: ❌ Skipped result ${index + 1} (missing url or title)`);
        }
      });

      console.log(`🔍 DIRECT SEARCH: Final results count: ${results.length}`);
      return { success: true, results };
    } catch (error) {
      console.log(`🔍 DIRECT SEARCH: ❌ Error:`, error);
      return {
        success: false,
        results: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
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
          const result = await callBrowserAgent(this.env, prompt, this.apiKey);
          console.log("Got back results from browser");
          return { /* ...result, */ message: result.message, success: result.success, error: result.error };
        }
      }),
      call_computer_agent: tool({
        description: 'Use this tool to control desktop environments via VNC. Can click anywhere on screen, type text, use keyboard shortcuts, and take screenshots of the desktop.',
        parameters: z.object({
          prompt: z.string().describe('Natural language description of what you want to do on the desktop')
        }),
        execute: async ({ prompt }) => {
          console.log("Going to call computer agent");
          const agent = await callComputerAgent(this.env, prompt, this.apiKey);
          const result = await agent.processWithLLM(prompt);
          console.log("Got back results from computer");
          return { message: result.message, success: result.success, error: result.error };
        }
      }),
      search_web: tool({
        description: 'Search the web using Brave Search and get search results with titles, URLs, and snippets.',
        parameters: z.object({
          query: z.string().describe('The search query to execute'),
          maxResults: z.number().optional().describe('Maximum number of results to return (default: 10)')
        }),
        execute: async ({ query, maxResults = 10 }) => {
          console.log(`🔍 TOOL: Executing web search for "${query}" with max results: ${maxResults}`);
          const searchResult = await this.searchBrave(query, maxResults);
          console.log(`🔍 TOOL: Search completed. Success: ${searchResult.success}, Results: ${searchResult.results.length}`);

          if (searchResult.success) {
            return {
              message: `Found ${searchResult.results.length} search results for "${query}"`,
              success: true,
              results: searchResult.results
            };
          } else {
            return {
              message: `Search failed for query: "${query}"`,
              success: false,
              error: searchResult.error
            };
          }
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
          console.log("We are doing a delegate?!");
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
    const result = await callBrowserAgent(this.env, task.prompt, this.apiKey);

    return {
      success: result.success,
      message: result.message,
      taskType: 'browser',
      error: result.error,
      executionTime: Date.now() - startTime
    };
  }

  private async delegateToComputer(task: AgentTask, startTime: number): Promise<AgentResponse> {
    const computerAgent = await callComputerAgent(this.env, task.prompt);

    return {
      success: true,
      message: `Computer agent has been initialized and is ready to execute: "${task.prompt}"`,
      taskType: 'computer',
      data: { agent: computerAgent },
      executionTime: Date.now() - startTime
    };
  }

  private async delegateToSearch(task: AgentTask, startTime: number): Promise<AgentResponse> {
    console.log(`🔍 DELEGATE: Starting direct search for: "${task.prompt}"`);
    const searchResults = await this.searchBrave(task.prompt);

    if (searchResults.success) {
      const resultsText = searchResults.results
        .map(result => `${result.title}: ${result.snippet} (${result.url})`)
        .join('\n');

      console.log(`🔍 DELEGATE: ✅ Search successful - ${searchResults.results.length} results`);
      return {
        success: true,
        message: `Found ${searchResults.results.length} search results for "${task.prompt}":\n\n${resultsText}`,
        taskType: 'search',
        data: { results: searchResults.results },
        executionTime: Date.now() - startTime
      };
    } else {
      console.log(`🔍 DELEGATE: ❌ Search failed: ${searchResults.error}`);
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
      console.log("Getting tools");
      const tools = this.getTools();

      console.log("creating anthropic interface");
      const anthropic = createAnthropic({
        apiKey: this.apiKey
      });

      console.log("Generating text");
      const result = await generateText({
        model: anthropic('claude-3-5-sonnet-20241022'),
        messages: [
          {
            role: 'system',
            content: `You are AgentFlare, an AI assistant that can help with web browsing, desktop automation, and search tasks. You have access to three specialized tools:

1. Browser Agent (call_browser_agent): For web automation tasks like navigating websites, clicking buttons, filling forms, taking screenshots
2. Computer Agent (call_computer_agent): For desktop automation via VNC, clicking anywhere on screen, typing, keyboard shortcuts  
3. Web Search (search_web): For searching the web and getting information from Brave Search

Use these tools when the user's request requires their capabilities. You can use multiple tools in sequence if needed. Always explain what you're doing and provide helpful responses based on the tool results.`
          },
          {
            role: 'user',
            content: request
          }
        ],
        tools,
        maxSteps: 10,
        toolChoice: 'auto'
      });

      console.log("Returning a result");
      return {
        /* ...result, */
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
  apiKey?: string
): Promise<MainAgent> {
  return new MainAgent(env, apiKey);
}
