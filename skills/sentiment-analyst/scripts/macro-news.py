"""
Macro & Global News Aggregator

Fetches top news from credible global and local RSS feeds to detect macro catalysts 
(Geopolitics, Fed/FOMC, Oil & Gas, Global Markets) that could affect the IHSG.

Zero external dependencies (uses only standard library).
"""

import sys
import json
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime

FEEDS = {
    "Bloomberg Markets": "https://feeds.bloomberg.com/markets/news.rss",
    "Bloomberg Economics": "https://feeds.bloomberg.com/economics/news.rss",
    "Bloomberg Politics": "https://feeds.bloomberg.com/politics/news.rss",
    "WSJ Markets": "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",
    "Yahoo Finance": "https://finance.yahoo.com/news/rssindex",
    "CNBC US": "https://search.cnbc.com/rs/search/combinedcms/view.xml?profile=120000000&id=10000664",
    "CNBC Indonesia": "https://www.cnbcindonesia.com/market/rss"
}

def fetch_feed(name, url, limit=5):
    try:
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            xml_data = response.read()
            
        root = ET.fromstring(xml_data)
        items = root.findall('.//item')
        
        results = []
        for item in items[:limit]:
            title = item.findtext('title') or ''
            link = item.findtext('link') or ''
            pubDate = item.findtext('pubDate') or ''
            
            # Basic cleanup
            title = title.replace('<![CDATA[', '').replace(']]>', '').strip()
            
            results.append({
                "source": name,
                "title": title,
                "link": link,
                "pubDate": pubDate
            })
        return results
    except Exception as e:
        print(f"Warning: Failed to fetch {name} - {str(e)}", file=sys.stderr)
        return []

def main():
    action = sys.argv[1] if len(sys.argv) > 1 else "all"
    
    aggregated = []
    
    if action == "all":
        targets = FEEDS.keys()
    elif action == "local":
        targets = ["CNBC Indonesia"]
    elif action == "global":
        targets = ["Bloomberg Markets", "Bloomberg Economics", "WSJ Markets", "Yahoo Finance", "CNBC US"]
    else:
        # If user passed a specific feed name
        targets = [k for k in FEEDS.keys() if action.lower() in k.lower()]
        
    for target in targets:
        if target in FEEDS:
            aggregated.extend(fetch_feed(target, FEEDS[target], limit=5))
            
    print(json.dumps(aggregated, indent=2))

if __name__ == "__main__":
    main()
