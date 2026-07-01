const { StockbitClient } = require('../../../core/stockbit-auth.js');
const { RULE_OF_FIVE, clampLimit } = require('../../../core/rule-of-five.js');

class SentimentAPIClient extends StockbitClient {
  /**
   * Fetch stream data for a symbol.
   * Categories: STREAM_CATEGORY_NEWS, STREAM_CATEGORY_REPORTS, STREAM_CATEGORY_INSIDER
   */
  async getStream(ticker, category = 'STREAM_CATEGORY_NEWS', limit = RULE_OF_FIVE) {
    const params = {
      category,
      limit: clampLimit(limit)
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
    const news = await this.getStream(ticker, 'STREAM_CATEGORY_NEWS', RULE_OF_FIVE);
    const reports = await this.getStream(ticker, 'STREAM_CATEGORY_REPORTS', RULE_OF_FIVE);
    const insider = await this.getStream(ticker, 'STREAM_CATEGORY_INSIDER', RULE_OF_FIVE);
    const ideas = await this.getStream(ticker, 'STREAM_CATEGORY_IDEAS', RULE_OF_FIVE);
    
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
  async getOfficialStockbitNews(limit = RULE_OF_FIVE, ticker = null) {
    const payload = {
      category: 'STREAM_CATEGORY_MAIN_IDEAS',
      last_stream_id: 0,
      limit: 25 // Internal fetch buffer — output trimmed to Rule of 5 below
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

    return posts.slice(0, clampLimit(limit)).map(post => {
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

const SENT_CLI_COMMANDS = [
  { usage: 'aggregate <TICKER>', detail: 'News, reports, insider, and retail ideas (Rule of 5 each)' },
  { usage: 'official [TICKER|MACRO] [LIMIT]', detail: 'Official @Stockbit stream. Use MACRO for market-wide macro/midday PDF' },
  { usage: 'stream <TICKER> [CATEGORY] [LIMIT]', detail: 'Single stream category (NEWS, REPORTS, INSIDER, IDEAS)' },
];

function printSentimentHelp() {
  const { printHelp } = require('../../../core/cli-help.js');
  printHelp('sentiment-api.js', 'Sentiment, news & catalyst API', SENT_CLI_COMMANDS);
}

const STREAM_CATEGORIES = {
  NEWS: 'STREAM_CATEGORY_NEWS',
  REPORTS: 'STREAM_CATEGORY_REPORTS',
  INSIDER: 'STREAM_CATEGORY_INSIDER',
  IDEAS: 'STREAM_CATEGORY_IDEAS',
};

async function runSentimentCLI(argv) {
  const { wantsHelp } = require('../../../core/cli-help.js');
  if (wantsHelp(argv) || argv.length === 0) {
    printSentimentHelp();
    process.exit(argv.length === 0 ? 1 : 0);
  }

  const api = new SentimentAPIClient();
  await api.login();

  const [command, arg1, arg2, arg3] = argv;

  switch (command) {
    case 'aggregate': {
      const ticker = arg1 || 'BBCA';
      console.log(JSON.stringify(await api.getAggregatedSentiment(ticker), null, 2));
      break;
    }
    case 'official': {
      const ticker = arg1 && arg1 !== 'MACRO' ? arg1 : null;
      const limit = arg2 ? parseInt(arg2, 10) : undefined;
      console.log(JSON.stringify(await api.getOfficialStockbitNews(limit, ticker), null, 2));
      break;
    }
    case 'stream': {
      const ticker = arg1;
      if (!ticker) throw new Error('Usage: sentiment-api.js stream <TICKER> [CATEGORY] [LIMIT]');
      const catKey = (arg2 || 'NEWS').toUpperCase();
      const category = STREAM_CATEGORIES[catKey] || arg2;
      const limit = arg3 ? parseInt(arg3, 10) : undefined;
      console.log(JSON.stringify(await api.getStream(ticker, category, limit), null, 2));
      break;
    }
    default:
      throw new Error(`Unknown command: ${command}. Run with --help.`);
  }
}

if (require.main === module) {
  runSentimentCLI(process.argv.slice(2)).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}

module.exports = { SentimentAPIClient, printSentimentHelp };
