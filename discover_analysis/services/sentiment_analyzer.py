"""
Social Sentiment Analyzer - Analyze online reputation and sentiment
Searches for news, reviews, and mentions of the business and analyzes sentiment
"""
import os
import requests
from typing import Dict, List
from dotenv import load_dotenv

load_dotenv()


class SentimentAnalyzer:
    """
    Analyze business reputation through news and online mentions
    """

    def __init__(self):
        self.serper_api_key = os.getenv('SERPER_API_KEY')
        self._initialized = self.serper_api_key is not None

    async def analyze_sentiment(self, company_name: str, website_url: str = None) -> Dict:
        """
        Analyze sentiment for a business

        Args:
            company_name: Name of the company
            website_url: Company website URL (optional)

        Returns:
            Dictionary with sentiment analysis results
        """
        if not self._initialized:
            print(f"  [WARNING] Sentiment analyzer not available (missing SERPER_API_KEY)")
            return {
                'sentiment_available': False,
                'error': 'SERPER_API_KEY not found'
            }

        result = {
            'sentiment_available': True,
            'company_name': company_name,
            'news_count': 0,
            'sentiment_score': 50,  # Neutral by default (0-100)
            'sentiment_label': 'neutral',
            'positive_mentions': 0,
            'negative_mentions': 0,
            'neutral_mentions': 0,
            'news_articles': [],
            'analysis_summary': ''
        }

        try:
            # Search for news about the company
            print(f"  [SEARCHING] Searching for news and mentions about: {company_name}")
            news_results = self._search_news(company_name)

            if not news_results or len(news_results) == 0:
                result['analysis_summary'] = 'No news or mentions found online'
                return result

            result['news_count'] = len(news_results)
            result['news_articles'] = news_results[:5]  # Keep top 5

            # Analyze sentiment using OpenAI
            print(f"  [ANALYZING] Analyzing sentiment of {len(news_results)} mentions...")
            sentiment_data = await self._analyze_with_ai(company_name, news_results)

            if sentiment_data:
                result.update(sentiment_data)

                # Calculate label based on score
                if result['sentiment_score'] >= 70:
                    result['sentiment_label'] = 'positive'
                elif result['sentiment_score'] <= 30:
                    result['sentiment_label'] = 'negative'
                else:
                    result['sentiment_label'] = 'neutral'

                print(f"  [OK] Sentiment Score: {result['sentiment_score']}/100 ({result['sentiment_label'].upper()})")

            return result

        except Exception as e:
            print(f"  [WARNING] Sentiment analysis error: {e}")
            result['error'] = str(e)
            return result

    def _search_news(self, company_name: str) -> List[Dict]:
        """
        Search for news articles and mentions using Serper API

        Args:
            company_name: Company name to search

        Returns:
            List of news articles
        """
        try:
            # Search for news + reviews
            search_queries = [
                f'"{company_name}" news',
                f'"{company_name}" reviews',
            ]

            all_results = []

            for query in search_queries:
                url = "https://google.serper.dev/search"
                payload = {
                    'q': query,
                    'num': 5  # Get top 5 results per query
                }
                headers = {
                    'X-API-KEY': self.serper_api_key,
                    'Content-Type': 'application/json'
                }

                response = requests.post(url, json=payload, headers=headers, timeout=10)

                if response.status_code == 200:
                    data = response.json()

                    # Extract organic results
                    if 'organic' in data:
                        for item in data['organic'][:5]:
                            all_results.append({
                                'title': item.get('title', ''),
                                'snippet': item.get('snippet', ''),
                                'link': item.get('link', ''),
                                'source': item.get('source', 'Unknown')
                            })

            # Remove duplicates based on title
            seen_titles = set()
            unique_results = []
            for item in all_results:
                if item['title'] not in seen_titles:
                    seen_titles.add(item['title'])
                    unique_results.append(item)

            return unique_results[:10]  # Return max 10 results

        except Exception as e:
            print(f"    [WARNING] News search error: {e}")
            return []

    async def _analyze_with_ai(self, company_name: str, news_results: List[Dict]) -> Dict:
        """
        Use OpenAI to analyze sentiment from news results

        Args:
            company_name: Company name
            news_results: List of news articles

        Returns:
            Sentiment analysis data
        """
        try:
            from .openai_service import openai_service

            if not openai_service or not openai_service._initialized:
                return {}

            # Prepare news content for analysis
            news_text = "\n\n".join([
                f"Title: {item['title']}\nSnippet: {item['snippet']}\nSource: {item['source']}"
                for item in news_results[:10]
            ])

            prompt = f"""Analyze the sentiment of online mentions and news about "{company_name}".

News and Mentions:
{news_text}

Analyze the overall sentiment and provide:
1. Sentiment score (0-100): 0 = very negative, 50 = neutral, 100 = very positive
2. Count of positive mentions
3. Count of negative mentions
4. Count of neutral mentions
5. A brief summary (1-2 sentences) of the overall reputation

Consider:
- Customer reviews and feedback
- News coverage (positive or negative)
- Any controversies or scandals
- Awards or recognition
- General business reputation

Return ONLY a JSON object with this exact structure:
{{
  "sentiment_score": <number 0-100>,
  "positive_mentions": <number>,
  "negative_mentions": <number>,
  "neutral_mentions": <number>,
  "analysis_summary": "<brief summary>"
}}"""

            # Call OpenAI
            import asyncio
            loop = asyncio.get_event_loop()

            def call_openai():
                response = openai_service.client.chat.completions.create(
                    model=openai_service.model,
                    messages=[
                        {"role": "system", "content": "You are a business reputation analyst. Analyze sentiment from news and online mentions."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.3,
                )
                return response.choices[0].message.content

            response_text = await loop.run_in_executor(None, call_openai)

            # Parse JSON response
            import json
            response_text = response_text.strip()

            # Remove markdown code blocks if present
            if response_text.startswith('```json'):
                response_text = response_text[7:]
            if response_text.startswith('```'):
                response_text = response_text[3:]
            if response_text.endswith('```'):
                response_text = response_text[:-3]
            response_text = response_text.strip()

            sentiment_data = json.loads(response_text)

            return sentiment_data

        except Exception as e:
            print(f"    [WARNING] AI sentiment analysis error: {e}")
            return {}


# Singleton instance
sentiment_analyzer = SentimentAnalyzer()
