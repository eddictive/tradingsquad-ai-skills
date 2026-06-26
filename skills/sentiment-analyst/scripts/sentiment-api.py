import sys
import os
import json

# Import the Shared Core Authentication Module
sys.path.append(os.path.join(os.path.dirname(__file__), '../../../core'))
from stockbit_auth import StockbitClient

class SentimentAPIClient(StockbitClient):
    """
    Market Sentiment API Client.
    Fetches news, corporate reports, and insider activities.
    """
    def get_stream(self, ticker, category="STREAM_CATEGORY_NEWS", limit=10):
        params = {
            "category": category,
            "limit": limit
        }
        response = self._get_exodus(f"/stream/v3/symbol/{ticker}", params=params)
        data = response.get("data", {})
        stream = data.get("stream", [])
        
        results = []
        for post in stream:
            news_feed = post.get("news_feed") or {}
            results.append({
                "id": post.get("stream_id"),
                "date": post.get("created_display"),
                "author": post.get("user", {}).get("fullname", "Unknown"),
                "content": post.get("content_original"),
                "is_news": bool(news_feed.get("source"))
            })
        return results

    def get_aggregated_sentiment(self, ticker):
        news = self.get_stream(ticker, "STREAM_CATEGORY_NEWS", 10)
        reports = self.get_stream(ticker, "STREAM_CATEGORY_REPORTS", 5)
        insider = self.get_stream(ticker, "STREAM_CATEGORY_INSIDER", 5)
        ideas = self.get_stream(ticker, "STREAM_CATEGORY_IDEAS", 10)
        
        return {
            "news": news,
            "reports": reports,
            "insider": insider,
            "ideas": ideas
        }

if __name__ == "__main__":
    api = SentimentAPIClient()
    api.login()
    ticker = sys.argv[1] if len(sys.argv) > 1 else "BBCA"
    data = api.get_aggregated_sentiment(ticker)
    print(f"Sentiment Data for {ticker}:")
    print(json.dumps(data, indent=2))
