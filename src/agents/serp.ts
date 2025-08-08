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
    console.log(`🔍 SERP: Starting Brave search for query: "${query}"`);
    console.log(`🔍 SERP: Search URL: ${searchUrl}`);
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    console.log(`🔍 SERP: HTTP response status: ${response.status}`);
    if (!response.ok) {
      throw new Error(`Brave Search request failed: ${response.status}`);
    }

    const html = await response.text();
    console.log(`🔍 SERP: Received HTML response (${html.length} characters)`);
    
    const $ = cheerio.load(html);
    
    const results: SearchResult[] = [];
    const searchResults = $('div#results div[data-type="web"] > a');
    console.log(`🔍 SERP: Found ${searchResults.length} search result elements with selector: 'div#results div[data-type="web"] > a'`);
    
    // Debug: Try alternative selectors if main one doesn't work
    if (searchResults.length === 0) {
      console.log('🔍 SERP: No results with main selector, trying alternatives...');
      const altSelectors = [
        'div#results a[href]',
        '.result a[href]',
        '[data-type="web"] a',
        '.web-result a',
        'div.result a'
      ];
      
      for (const selector of altSelectors) {
        const altResults = $(selector);
        console.log(`🔍 SERP: Selector '${selector}' found ${altResults.length} elements`);
      }
    }
    
    searchResults.slice(0, maxResults).each((index, element) => {
      const $element = $(element);
      const url = $element.attr('href');
      const title = $element.find('h4, .title').text().trim() || $element.text().trim();
      
      console.log(`🔍 SERP: Processing result ${index + 1}:`);
      console.log(`🔍 SERP:   - URL: ${url}`);
      console.log(`🔍 SERP:   - Title: "${title}"`);
      
      // Try to find snippet from nearby elements
      const snippet = $element.parent().find('.snippet, .description, p').first().text().trim() || 
                     $element.next().text().trim() || 
                     'No description available';
      
      console.log(`🔍 SERP:   - Snippet: "${snippet.substring(0, 100)}${snippet.length > 100 ? '...' : ''}"`);
      
      if (url && title) {
        results.push({
          title,
          url,
          snippet,
          position: index + 1
        });
        console.log(`🔍 SERP:   ✅ Added to results`);
      } else {
        console.log(`🔍 SERP:   ❌ Skipped (missing url or title)`);
      }
    });

    console.log(`🔍 SERP: Final results count: ${results.length}`);
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
          console.log(`🔍 SERP Tool: Executing search for "${query}" with max results: ${maxResults}`);
          const result = await this.search(query, maxResults);
          console.log(`🔍 SERP Tool: Search completed. Success: ${result.success}, Results: ${result.results.length}`);
          return result;
        }
      })
    };
  }

  async processWithLLM(prompt: string): Promise<{ success: boolean; message: string; results?: SearchResult[]; error?: string }> {
    console.log(`🔍 SERP LLM: Processing prompt: "${prompt}"`);
    
    if (!this.apiKey) {
      console.log(`🔍 SERP LLM: ❌ No API key provided`);
      return { success: false, message: 'API key required for LLM functionality', error: 'Missing API key' };
    }

    try {
      const tools = this.getSearchTools();
      console.log(`🔍 SERP LLM: Created search tools`);

      const anthropic = createAnthropic({
        apiKey: this.apiKey
      });
      
      console.log(`🔍 SERP LLM: Starting LLM generation...`);
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

      console.log(`🔍 SERP LLM: LLM generation completed`);
      console.log(`🔍 SERP LLM: Tool calls made: ${result.toolCalls?.length || 0}`);
      console.log(`🔍 SERP LLM: Tool results received: ${result.toolResults?.length || 0}`);

      // Extract search results from tool calls if any
      let searchResults: SearchResult[] = [];
      if (result.toolResults) {
        for (const toolResult of result.toolResults) {
          if (toolResult.result && typeof toolResult.result === 'object' && 'results' in toolResult.result) {
            const resultCount = (toolResult.result as any).results.length;
            console.log(`🔍 SERP LLM: Extracted ${resultCount} search results from tool result`);
            searchResults = [...searchResults, ...(toolResult.result as any).results];
          }
        }
      }

      console.log(`🔍 SERP LLM: ✅ Final response - Total results: ${searchResults.length}`);
      return {
        success: true,
        message: result.text,
        results: searchResults
      };
    } catch (error) {
      console.log(`🔍 SERP LLM: ❌ Error:`, error);
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