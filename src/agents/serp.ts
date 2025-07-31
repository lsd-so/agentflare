import * as cheerio from 'cheerio';
import { generateText, tool } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  position: number;
}

export interface SerpResponse {
  success: boolean;
  query: string;
  results: SearchResult[];
  totalResults?: number;
  error?: string;
}

export class SerpAgent {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || '';
  }

  async search(query: string, maxResults: number = 10): Promise<SerpResponse> {
    try {
      return await this.searchBrave(query, maxResults);
    } catch (error) {
      return {
        success: false,
        query,
        results: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async searchBrave(query: string, maxResults: number): Promise<SerpResponse> {
    const searchUrl = `https://search.brave.com/search?q=${encodeURIComponent(query)}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Brave Search request failed: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    
    const results: SearchResult[] = [];
    const searchResults = $('div#results div[data-type="web"] > a');
    
    searchResults.slice(0, maxResults).each((index, element) => {
      const $element = $(element);
      const url = $element.attr('href');
      const title = $element.find('h4, .title').text().trim() || $element.text().trim();
      
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
      }
    });

    return {
      success: true,
      query,
      results,
      totalResults: results.length
    };
  }

  private getSearchTools() {
    return {
      search: tool({
        description: 'Search the web using Brave Search and get search results',
        parameters: z.object({
          query: z.string().describe('The search query'),
          maxResults: z.number().optional().describe('Maximum number of results to return (default: 10)')
        }),
        execute: async ({ query, maxResults = 10 }) => {
          return await this.search(query, maxResults);
        }
      })
    };
  }

  async processWithLLM(prompt: string): Promise<{ success: boolean; message: string; results?: SearchResult[]; error?: string }> {
    if (!this.apiKey) {
      return { success: false, message: 'API key required for LLM functionality', error: 'Missing API key' };
    }

    try {
      const tools = this.getSearchTools();

      const anthropic = createAnthropic({
        apiKey: this.apiKey
      });
      
      const result = await generateText({
        model: anthropic('claude-3-5-sonnet-20241022'),
        messages: [
          {
            role: 'system',
            content: `You are a web search agent. You can search the web using Brave Search to find information, websites, articles, and answers to questions.

Available tools:
- search: Search the web for information

When users ask questions or request information, use the search tool to find relevant results. Analyze the search results and provide helpful summaries or direct answers based on what you find.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        tools,
        maxSteps: 3,
        toolChoice: 'auto'
      });

      // Extract search results from tool calls if any
      let searchResults: SearchResult[] = [];
      if (result.toolResults) {
        for (const toolResult of result.toolResults) {
          if (toolResult.result && typeof toolResult.result === 'object' && 'results' in toolResult.result) {
            searchResults = [...searchResults, ...(toolResult.result as any).results];
          }
        }
      }

      return {
        success: true,
        message: result.text,
        results: searchResults
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to process search task',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

}

export async function callSerpAgent(
  query: string,
  maxResults: number = 10,
  apiKey?: string
): Promise<SerpResponse> {
  const agent = new SerpAgent(apiKey);
  return await agent.search(query, maxResults);
}