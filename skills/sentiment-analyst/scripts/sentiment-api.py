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

    def get_official_stockbit_news(self, limit=10, ticker=None):
        payload = {
            "category": "STREAM_CATEGORY_MAIN_IDEAS",
            "last_stream_id": 0,
            "limit": 25
        }
        response = self._post_exodus("/stream/v3/user/Stockbit", payload=payload)
        data_list = response.get("data", {}).get("stream", [])
        if not data_list:
            return []
        
        posts = [item.get("idea", item) for item in data_list]
        filtered_posts = []
        for post in posts:
            if not post or not post.get("content_original"):
                continue
            if ticker:
                mask_html = post.get("mask_html") or []
                has_ticker_in_mask = any(m.get("text") == f"${ticker}" for m in mask_html)
                has_ticker_in_content = f"${ticker}" in post.get("content_original", "")
                if not (has_ticker_in_mask or has_ticker_in_content):
                    continue
            filtered_posts.append(post)
            
        results = []
        for post in filtered_posts[:limit]:
            reaction = post.get("reaction", {})
            total_likes = reaction.get("total", 0) if reaction.get("reactions") else 0
            results.append({
                "id": post.get("stream_id"),
                "date": post.get("created_display"),
                "content": post.get("content_original"),
                "attachments": post.get("attachment", []),
                "images": post.get("images", []),
                "likes": total_likes
            })
        return results

if __name__ == "__main__":
    api = SentimentAPIClient()
    api.login()
    
    action = sys.argv[1] if len(sys.argv) > 1 else "aggregate"
    
    if action == "official":
        tkr = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] != "MACRO" else None
        limit = int(sys.argv[3]) if len(sys.argv) > 3 else 10
        data = api.get_official_stockbit_news(limit, tkr)
        print("Official Stockbit News:")
        print(json.dumps(data, indent=2))
    else:
        ticker = sys.argv[1] if len(sys.argv) > 1 else "BBCA"
        data = api.get_aggregated_sentiment(ticker)
        print(f"Sentiment Data for {ticker}:")
        print(json.dumps(data, indent=2))
