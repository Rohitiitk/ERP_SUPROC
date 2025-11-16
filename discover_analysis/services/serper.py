"""
Serper API Service - Google Search for Supplier Discovery
"""
import os
import requests
from typing import List, Dict
from dotenv import load_dotenv

load_dotenv()

class SerperAPI:
    def __init__(self):
        self.api_key = os.getenv('SERPER_API_KEY')
        self.base_url = 'https://google.serper.dev/search'

    def search(self, query: str, num_results: int = 20) -> List[Dict]:
        """
        Search for suppliers using Serper API

        Args:
            query: Search query (e.g., "bulk suppliers worldwide globally in all domain and industry categories")
            num_results: Number of results to return

        Returns:
            List of search results with URLs and snippets
        """
        headers = {
            'X-API-KEY': self.api_key,
            'Content-Type': 'application/json'
        }

        payload = {
            'q': query,
            'num': num_results,
            'gl': 'us', # Geolocation
            'hl': 'en'   # Language
        }

        try:
            response = requests.post(
                self.base_url,
                headers=headers,
                json=payload,
                timeout=30
            )
            response.raise_for_status()

            data = response.json()

            # Extract organic results
            results = []
            for result in data.get('organic', []):
                results.append({
                    'title': result.get('title', ''),
                    'url': result.get('link', ''),
                    'snippet': result.get('snippet', ''),
                    'position': result.get('position', 0)
                })

            print(f"[OK] Found {len(results)} search results")
            return results

        except requests.exceptions.RequestException as e:
            print(f"[ERROR] Serper API Error: {e}")
            return []

    def search_suppliers(self, product: str, location: str = "",
                        additional_terms: str = "manufacturer supplier bulk") -> List[Dict]:
        """
        Specialized search for suppliers

        Args:
            product: Product type (e.g., "electronics", "textiles", )
            location: Geographic location (optional)
            additional_terms: Additional search terms

        Returns:
            List of potential supplier URLs
        """
        query = f"{product} {additional_terms}"
        if location:
            query += f" {location}"

        print(f"[SEARCH] Searching for: {query}")
        return self.search(query)

# Singleton instance
serper_api = SerperAPI()
