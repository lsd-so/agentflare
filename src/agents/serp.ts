import * as cheerio from 'cheerio';

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
  constructor() {
    // No parameters needed for Brave Search scraping
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

}

export async function callSerpAgent(
  query: string,
  maxResults: number = 10
): Promise<SerpResponse> {
  const agent = new SerpAgent();
  return await agent.search(query, maxResults);
}