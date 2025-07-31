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
  private apiKey?: string;
  private searchEngine: 'brave' | 'duckduckgo';

  constructor(searchEngine: 'brave' | 'duckduckgo' = 'duckduckgo', apiKey?: string) {
    this.searchEngine = searchEngine;
    this.apiKey = apiKey;
  }

  async search(query: string, maxResults: number = 10): Promise<SerpResponse> {
    try {
      if (this.searchEngine === 'brave') {
        return await this.searchBrave(query, maxResults);
      } else {
        return await this.searchDuckDuckGo(query, maxResults);
      }
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
    if (!this.apiKey) {
      throw new Error('Brave Search API key required');
    }

    const response = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${maxResults}`, {
      headers: {
        'X-Subscription-Token': this.apiKey,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Brave Search API error: ${response.status}`);
    }

    const data = await response.json();
    const results: SearchResult[] = data.web?.results?.map((result: any, index: number) => ({
      title: result.title,
      url: result.url,
      snippet: result.description,
      position: index + 1
    })) || [];

    return {
      success: true,
      query,
      results,
      totalResults: data.web?.results?.length || 0
    };
  }

  private async searchDuckDuckGo(query: string, maxResults: number): Promise<SerpResponse> {
    // Note: DuckDuckGo doesn't have an official API, so this would need to use
    // a third-party service or web scraping. For now, this is a placeholder.
    
    // In a real implementation, you might use a service like:
    // - SerpAPI
    // - ScrapingBee
    // - Or implement web scraping with the browser agent
    
    const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`);
    
    if (!response.ok) {
      throw new Error(`DuckDuckGo API error: ${response.status}`);
    }

    const data = await response.json();
    
    // DuckDuckGo's instant answer API has limited search results
    // This is a simplified implementation
    const results: SearchResult[] = data.RelatedTopics?.slice(0, maxResults).map((topic: any, index: number) => ({
      title: topic.Text?.split(' - ')[0] || 'No title',
      url: topic.FirstURL || '',
      snippet: topic.Text || 'No snippet',
      position: index + 1
    })).filter((result: SearchResult) => result.url) || [];

    return {
      success: true,
      query,
      results,
      totalResults: results.length
    };
  }

  async getSearchSuggestions(query: string): Promise<string[]> {
    try {
      const response = await fetch(`https://duckduckgo.com/ac/?q=${encodeURIComponent(query)}&type=list`);
      const data = await response.json();
      return data[1] || [];
    } catch (error) {
      return [];
    }
  }
}

export async function callSerpAgent(
  query: string,
  searchEngine: 'brave' | 'duckduckgo' = 'duckduckgo',
  apiKey?: string,
  maxResults: number = 10
): Promise<SerpResponse> {
  const agent = new SerpAgent(searchEngine, apiKey);
  return await agent.search(query, maxResults);
}