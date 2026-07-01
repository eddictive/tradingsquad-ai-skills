const { StockbitClient } = require('../../../core/stockbit-auth.js');

class SentimentAPIClient extends StockbitClient {
  /**
   * Fetch stream data for a symbol.
   * Categories: STREAM_CATEGORY_NEWS, STREAM_CATEGORY_REPORTS, STREAM_CATEGORY_INSIDER
   */
  async getStream(ticker, category = 'STREAM_CATEGORY_NEWS', limit = 10) {
    const params = {
      category,
      limit
    };
    const response = await this._getExodus(`/stream/v3/symbol/${ticker}`, params);
    
    // Filter and clean the response to prevent overwhelming the LLM with noise
    if (!response.data || !response.data.stream) return [];
    
    return response.data.stream.map(post => {
      // Extract the most essential parts to save tokens
      return {
        id: post.stream_id,
        date: post.created_display,
        author: post.user ? post.user.fullname : 'Unknown',
        content: post.content_original,
        is_news: !!(post.news_feed && post.news_feed.source)
      };
    });
  }

  async getAggregatedSentiment(ticker) {
    // Fetch multiple categories and combine them
    const news = await this.getStream(ticker, 'STREAM_CATEGORY_NEWS', 10);
    const reports = await this.getStream(ticker, 'STREAM_CATEGORY_REPORTS', 5);
    const insider = await this.getStream(ticker, 'STREAM_CATEGORY_INSIDER', 5);
    const ideas = await this.getStream(ticker, 'STREAM_CATEGORY_IDEAS', 10);
    
    return {
      news,
      reports,
      insider,
      ideas
    };
  }

  /**
   * Fetch breaking news / macro data / midday data from the Official @Stockbit account.
   * If ticker is provided, filters for posts containing that ticker.
   */
  async getOfficialStockbitNews(limit = 10, ticker = null) {
    const payload = {
      category: 'STREAM_CATEGORY_MAIN_IDEAS',
      last_stream_id: 0,
      limit: 25 // Fetch more initially to allow filtering
    };
    
    // Using POST to the specific user stream endpoint for cleaner results
    const response = await this._postExodus(`/stream/v3/user/Stockbit`, payload);
    
    if (!response.data || !response.data.stream) return [];
    
    let posts = response.data.stream.map(item => item.idea || item);
    
    // Filter posts
    posts = posts.filter(post => {
      if (!post || !post.content_original) return false;
      if (ticker) {
        const hasTickerInMask = post.mask_html && post.mask_html.some(m => m.text === `$${ticker}`);
        const hasTickerInContent = post.content_original.includes(`$${ticker}`);
        return hasTickerInMask || hasTickerInContent;
      }
      return true; // If macro mode (no ticker), return all
    });

    return posts.slice(0, limit).map(post => {
      return {
        id: post.stream_id,
        date: post.created_display,
        content: post.content_original,
        attachments: post.attachment || [], // Include PDFs
        images: post.images || [], // Include image links
        likes: post.reaction && post.reaction.reactions ? post.reaction.total : 0
      };
    });
  }
}

if (require.main === module) {
  (async () => {
    const api = new SentimentAPIClient();
    try {
      await api.login();
      const ticker = process.argv[2] || 'BBCA';
      const data = await api.getAggregatedSentiment(ticker);
      console.log(`Sentiment Data for ${ticker}:`, JSON.stringify(data, null, 2));
    } catch (e) {
      console.error(e.message);
    }
  })();
}

module.exports = { SentimentAPIClient };
