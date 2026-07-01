import sys
import os
import json

# Import the Shared Core Authentication Module
sys.path.append(os.path.join(os.path.dirname(__file__), '../../../core'))
from stockbit_auth import StockbitClient
from rule_of_five import RULE_OF_FIVE, clamp_limit

class SentimentAPIClient(StockbitClient):
    """
    Market Sentiment API Client.
    Fetches news, corporate reports, and insider activities.
    """
    def get_stream(self, ticker, category="STREAM_CATEGORY_NEWS", limit=RULE_OF_FIVE):
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
        news = self.get_stream(ticker, "STREAM_CATEGORY_NEWS", RULE_OF_FIVE)
        reports = self.get_stream(ticker, "STREAM_CATEGORY_REPORTS", RULE_OF_FIVE)
        insider = self.get_stream(ticker, "STREAM_CATEGORY_INSIDER", RULE_OF_FIVE)
        ideas = self.get_stream(ticker, "STREAM_CATEGORY_IDEAS", RULE_OF_FIVE)
        
        return {
            "news": news,
            "reports": reports,
            "insider": insider,
            "ideas": ideas
        }

    def get_official_stockbit_news(self, limit=RULE_OF_FIVE, ticker=None):
        payload = {
            "category": "STREAM_CATEGORY_MAIN_IDEAS",
            "last_stream_id": 0,
            "limit": 25  # Internal fetch buffer — output trimmed to Rule of 5 below
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
        for post in filtered_posts[:clamp_limit(limit)]:
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

SENT_CLI_COMMANDS = [
    {"usage": "aggregate <TICKER>", "detail": "News, reports, insider, and retail ideas (Rule of 5 each)"},
    {"usage": "official [TICKER|MACRO] [LIMIT]", "detail": "Official @Stockbit stream. Use MACRO for market-wide macro/midday PDF"},
    {"usage": "stream <TICKER> [CATEGORY] [LIMIT]", "detail": "Single stream category (NEWS, REPORTS, INSIDER, IDEAS)"},
]

STREAM_CATEGORIES = {
    "NEWS": "STREAM_CATEGORY_NEWS",
    "REPORTS": "STREAM_CATEGORY_REPORTS",
    "INSIDER": "STREAM_CATEGORY_INSIDER",
    "IDEAS": "STREAM_CATEGORY_IDEAS",
}


def print_sentiment_help():
    from cli_help import print_help
    print_help("sentiment-api.py", "Sentiment, news & catalyst API", SENT_CLI_COMMANDS)


if __name__ == "__main__":
    from cli_help import wants_help

    argv = sys.argv[1:]
    if wants_help(argv) or not argv:
        print_sentiment_help()
        sys.exit(1 if not argv else 0)

    api = SentimentAPIClient()
    api.login()

    action = argv[0]

    try:
        if action == "official":
            tkr = argv[1] if len(argv) > 1 and argv[1] != "MACRO" else None
            limit = int(argv[2]) if len(argv) > 2 else None
            data = api.get_official_stockbit_news(limit, tkr)
            print(json.dumps(data, indent=2))
        elif action == "aggregate":
            ticker = argv[1] if len(argv) > 1 else "BBCA"
            data = api.get_aggregated_sentiment(ticker)
            print(json.dumps(data, indent=2))
        elif action == "stream":
            ticker = argv[1] if len(argv) > 1 else None
            if not ticker:
                raise ValueError("Usage: sentiment-api.py stream <TICKER> [CATEGORY] [LIMIT]")
            cat_key = (argv[2] if len(argv) > 2 else "NEWS").upper()
            category = STREAM_CATEGORIES.get(cat_key, argv[2] if len(argv) > 2 else "STREAM_CATEGORY_NEWS")
            limit = int(argv[3]) if len(argv) > 3 else None
            data = api.get_stream(ticker, category, limit)
            print(json.dumps(data, indent=2))
        else:
            raise ValueError(f"Unknown command: {action}. Run with --help.")
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
