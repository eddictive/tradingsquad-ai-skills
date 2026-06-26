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
