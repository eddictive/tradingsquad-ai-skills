/**
 * Macro & Global News Aggregator
 * 
 * Fetches top news from credible global and local RSS feeds to detect macro catalysts 
 * (Geopolitics, Fed/FOMC, Oil & Gas, Global Markets) that could affect the IHSG.
 * 
 * Zero external dependencies (uses native fetch and regex for RSS parsing).
 * Compatible with Node.js v18+ and Bun.
 */

const FEEDS = {
  "Bloomberg Markets": "https://feeds.bloomberg.com/markets/news.rss",
  "Bloomberg Economics": "https://feeds.bloomberg.com/economics/news.rss",
  "Bloomberg Politics": "https://feeds.bloomberg.com/politics/news.rss",
  "WSJ Markets": "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",
  "Yahoo Finance": "https://finance.yahoo.com/news/rssindex",
  "Investing Economics": "https://www.investing.com/rss/news_95.rss",
  "CNBC US": "https://search.cnbc.com/rs/search/combinedcms/view.xml?profile=120000000&id=10000664",
  "CNBC Indonesia": "https://www.cnbcindonesia.com/market/rss",
  "Stockbit Snips": "https://snips.stockbit.com/snips-terbaru?format=rss",
  "IDX Channel": "https://sindikasi.idxchannel.com/rss",
  "IDX Channel Market News": "https://sindikasi.idxchannel.com/rss/market-news",
  "IDX Channel ESG Zone": "https://rss.app/feeds/RlLjCUWQKH7f9zOb.xml",
  "Emitennews": "https://rss.app/feeds/gAu4NEt6kg5BwwKo.xml",
  "Trading Economics": "https://tradingeconomics.com/ws/stream.ashx?start=0&size=25"
};

/**
 * Super lightweight RSS parser using Regex to avoid heavy XML dependencies.
 * Extracts <item> blocks, then grabs <title>, <link>, and <pubDate>.
 */
function parseRSS(xmlStr) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  
  while ((match = itemRegex.exec(xmlStr)) !== null) {
    const itemContent = match[1];
    
    // Extract tags
    const titleMatch = itemContent.match(/<title>([\s\S]*?)<\/title>/);
    const linkMatch = itemContent.match(/<link>([\s\S]*?)<\/link>/);
    const pubDateMatch = itemContent.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    
    let title = titleMatch ? titleMatch[1] : '';
    const link = linkMatch ? linkMatch[1] : '';
    const pubDate = pubDateMatch ? pubDateMatch[1] : '';
    
    // Clean up CDATA if present
    title = title.replace(/<!\[CDATA\[/g, '').replace(/]]>/g, '').trim();
    
    items.push({ title, link, pubDate });
  }
  return items;
}

async function fetchFeed(name, url, limit = 5) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout
    
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
    }
    
    const text = await response.text();
    let items = [];
    
    if (text.trim().startsWith('[')) {
      const jsonData = JSON.parse(text);
      items = jsonData.map(item => ({
        title: item.title,
        link: item.url ? (item.url.startsWith('http') ? item.url : `https://tradingeconomics.com${item.url}`) : '',
        pubDate: item.date
      }));
    } else {
      items = parseRSS(text);
    }
    
    return items.slice(0, limit).map(item => ({
      source: name,
      title: item.title,
      link: item.link,
      pubDate: item.pubDate
    }));
    
  } catch (err) {
    console.error(`Warning: Failed to fetch ${name} - ${err.message}`);
    return [];
  }
}

async function main() {
  const action = (process.argv[2] || "all").toLowerCase();
  let targets = [];
  
  if (action === "all") {
    targets = Object.keys(FEEDS);
  } else if (action === "local") {
    targets = ["CNBC Indonesia", "Stockbit Snips","IDX Channel", "IDX Channel Market News", "IDX Channel ESG Zone", "Emitennews"];
  } else if (action === "global") {
    targets = ["Bloomberg Markets", "Bloomberg Economics", "WSJ Markets", "Yahoo Finance", "Investing Economics", "CNBC US", "Trading Economics"];
  } else {
    // If user passed a specific feed name subset
    targets = Object.keys(FEEDS).filter(k => k.toLowerCase().includes(action));
  }
  
  let aggregated = [];
  
  // Fetch concurrently for speed
  const promises = targets.map(target => fetchFeed(target, FEEDS[target], 5));
  const resultsList = await Promise.all(promises);
  
  for (const res of resultsList) {
    aggregated = aggregated.concat(res);
  }
  
  console.log(JSON.stringify(aggregated, null, 2));
}

main();
