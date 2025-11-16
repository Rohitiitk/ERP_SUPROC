"""
Comprehensive Business Analysis Pipeline
Reads CSV data, performs deep web analysis, checks marketplaces, and stores in Supabase

This pipeline:
1. Reads business data from discover_ai_searches_rows.csv
2. Analyzes each business website using Playwright
3. Extracts favicon URLs
4. Checks Alibaba and ThomasNet for marketplace presence
5. Scores businesses using simplified scoring (no region-based scoring)
6. Stores comprehensive results in Supabase suplink_discovered table
"""
import asyncio
import csv
import json
from pathlib import Path
from datetime import datetime
from typing import Dict, List
import sys
import os

# Set UTF-8 encoding for Windows compatibility
if sys.platform == 'win32':
    # Configure UTF-8 for stdout/stderr on Windows
    import codecs
    if sys.stdout.encoding != 'utf-8':
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    if sys.stderr.encoding != 'utf-8':
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')

# Force stdout to flush immediately for real-time logs
import functools
_original_print = print
print = functools.partial(_original_print, flush=True)

# Safe print function for text that might contain Unicode
def safe_print(text):
    """Print text safely, handling any encoding errors"""
    try:
        print(text)
    except UnicodeEncodeError:
        # If Unicode fails, print ASCII-safe version
        print(text.encode('ascii', errors='replace').decode('ascii'))

# Add parent directory to path
sys.path.append(str(Path(__file__).parent))

from services.playwright_analyzer import playwright_analyzer
from services.favicon_extractor import favicon_extractor
from services.marketplace_scraper_enhanced import marketplace_scraper_enhanced as marketplace_scraper
from services.sentiment_analyzer import sentiment_analyzer
from services.scoring_supplier_evaluation import supplier_evaluation_scoring
from services.suplink_db import SuplinkDatabase


class ComprehensiveBusinessAnalyzer:
    """
    Comprehensive business analysis pipeline
    """

    def __init__(self, csv_path: str):
        self.csv_path = Path(csv_path)
        self.results = []
        self.suplink_db = None  # Lazy initialization
        self.user_id = None  # Store user_id for RLS compliance
        self.stats = {
            'total_processed': 0,
            'successful': 0,
            'failed': 0,
            'alibaba_found': 0,
            'thomasnet_found': 0,
            'start_time': None,
            'end_time': None
        }

    def load_data_from_supabase(self, search_id: str = None) -> List[Dict]:
        """
        Load business data from Supabase discover_ai_searches table

        Args:
            search_id: Optional - If provided, only load data for this specific search

        Returns:
            List of business records from Supabase
        """
        if search_id:
            print(f"\n[SUPABASE] Loading data for specific search ID: {search_id}...")
        else:
            print(f"\n[SUPABASE] Loading data from discover_ai_searches table...")

        businesses = []

        try:
            # Query the discover_ai_searches table
            # If search_id is provided, only get that specific search
            if search_id:
                result = self.suplink_db.client.table('discover_ai_searches').select('*').eq('id', search_id).execute()
            else:
                result = self.suplink_db.client.table('discover_ai_searches').select('*').execute()

            if not result.data:
                if search_id:
                    print(f"[WARNING] No data found for search ID: {search_id}")
                else:
                    print("[WARNING] No data found in discover_ai_searches table")
                return []

            # Process each row
            for row in result.data:
                try:
                    # Parse the results JSON if it exists
                    results = []
                    if row.get('results'):
                        if isinstance(row['results'], str):
                            results = json.loads(row['results'])
                        elif isinstance(row['results'], list):
                            results = row['results']

                    # Extract each business from results
                    for result_item in results:
                        business = {
                            'name': result_item.get('name', 'Unknown'),
                            'url': result_item.get('url', ''),
                            'email': result_item.get('email', ''),
                            'phone': result_item.get('phone', ''),
                            'summary': result_item.get('summary', ''),
                            'search_term': row.get('search_term', ''),
                            'country': row.get('country', ''),
                            'mode': row.get('mode', ''),
                            'db_row_id': row.get('id', ''),
                            'db_search_id': row.get('id', ''),  # Track which search this came from
                            'db_location': row.get('country', '')  # Use country as fallback location
                        }

                        # Only add if we have a valid URL
                        if business['url'] and business['url'].startswith('http'):
                            businesses.append(business)

                except (json.JSONDecodeError, TypeError) as e:
                    print(f"  [WARNING] Error parsing results in row {row.get('id')}: {e}")
                    continue

            print(f"[OK] Loaded {len(businesses)} businesses from Supabase")
            return businesses

        except Exception as e:
            print(f"[ERROR] Error loading from Supabase: {e}")
            import traceback
            traceback.print_exc()
            return []

    def load_csv_data(self) -> List[Dict]:
        """
        DEPRECATED: Load and parse CSV data
        Use load_data_from_supabase() instead

        Returns:
            List of business records from CSV
        """
        print(f"\n[CSV] Loading CSV data from: {self.csv_path}")

        businesses = []

        try:
            with open(self.csv_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)

                for row in reader:
                    # Parse the results JSON
                    try:
                        results = json.loads(row['results'])

                        # Extract each business from results
                        for result in results:
                            business = {
                                'name': result.get('name', 'Unknown'),
                                'url': result.get('url', ''),
                                'email': result.get('email', ''),
                                'phone': result.get('phone', ''),
                                'summary': result.get('summary', ''),
                                'search_term': row.get('search_term', ''),
                                'country': row.get('country', ''),
                                'mode': row.get('mode', ''),
                                'csv_row_id': row.get('id', ''),
                                'db_location': row.get('country', '')  # Use country as fallback location
                            }

                            # Only add if we have a valid URL
                            if business['url'] and business['url'].startswith('http'):
                                businesses.append(business)

                    except json.JSONDecodeError as e:
                        print(f"  [WARNING] Error parsing results JSON in row {row.get('id')}: {e}")
                        continue

            print(f"[OK] Loaded {len(businesses)} businesses from CSV")
            return businesses

        except Exception as e:
            print(f"[ERROR] Error loading CSV: {e}")
            import traceback
            traceback.print_exc()
            return []

    def _compare_and_choose_best_location(self, db_location: str, analyzer_location: str) -> tuple:
        """
        Compare database location with analyzer location and choose the best one
        PRIORITY: If analyzer doesn't find location, ALWAYS use database location

        Args:
            db_location: Location from database
            analyzer_location: Location extracted by analyzer

        Returns:
            (best_location, source) tuple
        """
        # Normalize empty values
        db_loc = db_location.strip() if db_location else ''
        analyzer_loc = analyzer_location.strip() if analyzer_location else ''

        # Case 1: Both are empty - return None
        if not db_loc and not analyzer_loc:
            return (None, 'none')

        # Case 2: Analyzer didn't find a location - ALWAYS use database location
        if not analyzer_loc:
            print(f"  [LOCATION] Analyzer found no location, using database location")
            return (db_loc, 'database')

        # Case 3: Database has no location - use analyzer location
        if not db_loc:
            print(f"  [LOCATION] Database has no location, using analyzer location")
            return (analyzer_loc, 'analyzer')

        # Case 4: Both have locations - compare quality/precision
        db_score = self._rate_location_quality(db_loc)
        analyzer_score = self._rate_location_quality(analyzer_loc)

        if analyzer_score > db_score:
            print(f"  [LOCATION] Analyzer location is more precise (score: {analyzer_score} vs {db_score})")
            return (analyzer_loc, 'analyzer')
        else:
            print(f"  [LOCATION] Database location is better or equal (score: {db_score} vs {analyzer_score})")
            return (db_loc, 'database')

    def _rate_location_quality(self, location: str) -> int:
        """
        Rate the quality/precision of a location string

        Args:
            location: Location string to rate

        Returns:
            Quality score (higher is better)
        """
        if not location:
            return 0

        score = 0

        # Length matters (more detail = higher score)
        if len(location) > 50:
            score += 30
        elif len(location) > 30:
            score += 20
        elif len(location) > 15:
            score += 10

        # Check for street address (highest precision)
        if any(indicator in location.lower() for indicator in ['street', 'st', 'avenue', 'ave', 'road', 'rd', 'boulevard', 'blvd', 'drive', 'dr', 'lane', 'ln']):
            score += 40

        # Check for postal/ZIP code (high precision)
        import re
        if re.search(r'\b\d{5}\b', location):  # US ZIP
            score += 30
        elif re.search(r'\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b', location):  # Canadian postal
            score += 30

        # Check for city, state/province format
        if re.search(r'[A-Z][a-z]+,\s*[A-Z]{2}', location):  # City, ST
            score += 20
        elif re.search(r'[A-Z][a-z]+,\s*[A-Z][a-z]+', location):  # City, Country
            score += 15

        # Multiple commas indicate more detailed address
        comma_count = location.count(',')
        score += min(comma_count * 10, 30)

        return score

    async def analyze_business(self, business: Dict) -> Dict:
        """
        Perform comprehensive analysis on a single business

        Args:
            business: Business data from CSV

        Returns:
            Complete analysis results
        """
        print(f"\n{'='*80}")
        print(f"[ANALYZE] Company: {business['name']}")
        print(f"[URL] {business['url']}")
        print(f"{'='*80}")

        analysis = {
            'company_name': business['name'],
            'website_url': business['url'],
            'search_query': business['search_term'],
            'search_country': business['country'],
            'discover_search_id': business.get('db_search_id'),  # Link to discover_ai_searches table
            'user_id': self.user_id,  # Add user_id for RLS compliance
            'csv_email': business['email'],
            'csv_phone': business['phone'],
            'csv_summary': business['summary'],
            'discovered_date': datetime.now().isoformat(),
            'analysis_status': 'pending'
        }

        try:
            # Step 1: Analyze website with Playwright
            print("\n[STEP 1] Website Analysis")
            website_data = await playwright_analyzer.analyze_website(business['url'])

            if website_data.get('analysis_failed'):
                print(f"  [WARNING] Website analysis failed: {website_data.get('error')}")
                analysis['analysis_status'] = 'failed'
                analysis['error'] = website_data.get('error')
                return analysis

            analysis['website_data'] = website_data

            # IMPORTANT: Always prioritize database location if analyzer doesn't find one
            db_location = business.get('db_location', '')
            analyzer_location = website_data.get('location', '')

            print("\n[LOCATION COMPARISON]")
            print(f"  Database location: '{db_location or 'None'}'")
            print(f"  Analyzer location: '{analyzer_location or 'None'}'")

            # Compare and choose the best location
            best_location, source = self._compare_and_choose_best_location(db_location, analyzer_location)

            # Always set the location in website_data (even if it's None)
            website_data['location'] = best_location
            analysis['location_source'] = source

            print(f"  Final location: '{best_location or 'None'}' (source: {source})")

            # Step 2: Extract favicon
            print("\n[STEP 2] Favicon Extraction")
            try:
                # We'll use a simple approach - try Google's favicon service
                from urllib.parse import urlparse
                parsed = urlparse(business['url'])
                domain = parsed.netloc
                favicon_url = favicon_extractor.get_google_favicon_url(domain)
                analysis['favicon_url'] = favicon_url
                print(f"  [OK] Favicon URL: {favicon_url}")
            except Exception as e:
                print(f"  [WARNING] Favicon extraction error: {e}")
                analysis['favicon_url'] = None

            # Step 3: Check marketplace presence
            print("\n[STEP 3] Marketplace Presence Check")
            marketplace_presence = await marketplace_scraper.check_marketplace_presence(
                business['name'],
                business['url']
            )
            analysis['marketplace_presence'] = marketplace_presence

            if marketplace_presence.get('alibaba_verified'):
                print(f"  [OK] Found on Alibaba: {marketplace_presence.get('alibaba_url')}")
                self.stats['alibaba_found'] += 1

            if marketplace_presence.get('thomasnet_listed'):
                print(f"  [OK] Found on ThomasNet: {marketplace_presence.get('thomasnet_url')}")
                self.stats['thomasnet_found'] += 1

            # Step 4: Social Sentiment Analysis
            print("\n[STEP 4] Social Sentiment Analysis")
            sentiment_data = await sentiment_analyzer.analyze_sentiment(
                business['name'],
                business['url']
            )
            analysis['sentiment_data'] = sentiment_data

            if sentiment_data.get('sentiment_available'):
                sentiment_label = sentiment_data.get('sentiment_label', 'unknown').upper()
                sentiment_score = sentiment_data.get('sentiment_score', 50)
                news_count = sentiment_data.get('news_count', 0)
                print(f"  [OK] Sentiment: {sentiment_label} ({sentiment_score}/100) from {news_count} mentions")
                if sentiment_data.get('analysis_summary'):
                    print(f"  [SUMMARY] {sentiment_data['analysis_summary']}")

            # Step 5: Calculate score (supplier evaluation system)
            print("\n[STEP 5] Scoring")
            score_data = supplier_evaluation_scoring.calculate_score(
                website_data=website_data,
                marketplace_presence=marketplace_presence,
                sentiment_data=sentiment_data
            )
            analysis['score_data'] = score_data

            # Use ASCII-safe star representation for Windows compatibility
            star_display = '*' * score_data['stars'] + '-' * (5 - score_data['stars'])
            print(f"  [OK] Score: {score_data['total']}/25 (Grade: {score_data['grade']}) [{star_display}]")
            print(f"  [STARS] {score_data['stars']}/5 stars")
            try:
                print(f"  [ANALYSIS] {score_data['score_analysis'][:200]}...")
            except UnicodeEncodeError:
                print(f"  [ANALYSIS] (Analysis contains special characters)")

            # Merge CSV contact info with website contact info
            if not website_data.get('contact', {}).get('email') and business['email']:
                if 'contact' not in website_data:
                    website_data['contact'] = {}
                website_data['contact']['email'] = business['email']

            if not website_data.get('contact', {}).get('phone') and business['phone']:
                if 'contact' not in website_data:
                    website_data['contact'] = {}
                website_data['contact']['phone'] = business['phone']

            analysis['analysis_status'] = 'completed'

            print(f"\n[DONE] Analysis Complete!")
            print(f"{'='*80}\n")

            return analysis

        except Exception as e:
            print(f"\n[ERROR] Analysis failed: {e}")
            import traceback
            traceback.print_exc()
            analysis['analysis_status'] = 'failed'
            analysis['error'] = str(e)
            return analysis

    async def run_analysis(self, limit: int = 20, skip: int = 0, search_id: str = None):
        """
        Run comprehensive analysis on all businesses

        Args:
            limit: Maximum number of businesses to analyze (None for all)
            skip: Number of businesses to skip from start
            search_id: Optional - If provided, only analyze businesses from this specific search
        """
        self.stats['start_time'] = datetime.now()

        print(f"\n{'='*80}")
        print(f"[START] COMPREHENSIVE BUSINESS ANALYSIS PIPELINE")
        print(f"{'='*80}")
        print(f"[TIME] Started: {self.stats['start_time']}")
        if search_id:
            print(f"[MODE] Processing specific search ID: {search_id}")
        print(f"{'='*80}\n")

        # Initialize database connection
        if self.suplink_db is None:
            print("[DB] Initializing Supabase connection...")
            self.suplink_db = SuplinkDatabase()
            print("[DB] Connection established\n")

        # Load data from Supabase
        businesses = self.load_data_from_supabase(search_id=search_id)

        if not businesses:
            print("[ERROR] No businesses to analyze")
            return

        # Apply skip and limit
        if skip > 0:
            businesses = businesses[skip:]
            print(f"[SKIP] Skipped first {skip} businesses")

        if limit:
            businesses = businesses[:limit]
            print(f"[ANALYZE] Analyzing {len(businesses)} businesses (limited to {limit})")
        else:
            print(f"[ANALYZE] Analyzing all {len(businesses)} businesses")

        # Analyze each business
        for i, business in enumerate(businesses, 1):
            print(f"\n{'='*80}")
            print(f"Progress: {i}/{len(businesses)}")
            print(f"{'='*80}")

            self.stats['total_processed'] += 1

            try:
                # === URL DEDUPLICATION CHECK ===
                # Skip if this URL was already analyzed
                business_url = business.get('url', '')
                if business_url:
                    existing_business = self.suplink_db.get_business_by_url(business_url)
                    if existing_business:
                        print(f"\n[SKIP] Supplier already exists in database: {business['name']}")
                        print(f"[URL] {business_url}")
                        print(f"[REASON] Previously analyzed - skipping to save resources")
                        self.stats['successful'] += 1  # Count as successful (already done)
                        continue

                # Analyze business (only if URL is NEW)
                print(f"[NEW] Analyzing new supplier: {business['name']}")
                analysis = await self.analyze_business(business)

                # Save to Supabase
                if analysis['analysis_status'] == 'completed':
                    print("\n[DB] Saving to Supabase suplink_discovered table...")
                    success = self.suplink_db.save_business_analysis(analysis)

                    if success:
                        self.stats['successful'] += 1
                        print("  [OK] Saved to suplink_discovered table")
                    else:
                        self.stats['failed'] += 1
                        print("  [ERROR] Failed to save to Supabase")
                else:
                    self.stats['failed'] += 1

                self.results.append(analysis)

                # Small delay between analyses to avoid overwhelming servers
                print("\n[WAIT] Waiting 1 second before next analysis...")
                await asyncio.sleep(1)

            except Exception as e:
                print(f"\n[ERROR] Unexpected error analyzing {business['name']}: {e}")
                self.stats['failed'] += 1
                continue

        # Cleanup
        await playwright_analyzer.close()
        await marketplace_scraper.close()

        # Print final statistics
        self.stats['end_time'] = datetime.now()
        self.print_statistics()

    def print_statistics(self):
        """
        Print final statistics
        """
        duration = self.stats['end_time'] - self.stats['start_time']

        print(f"\n{'='*80}")
        print(f"[STATS] ANALYSIS COMPLETE - FINAL STATISTICS")
        print(f"{'='*80}")
        print(f"[TIME] Duration: {duration}")
        print(f"[TOTAL] Total Processed: {self.stats['total_processed']}")
        print(f"[OK] Successful: {self.stats['successful']}")
        print(f"[ERROR] Failed: {self.stats['failed']}")
        print(f"[ALIBABA] Alibaba Verified: {self.stats['alibaba_found']}")
        print(f"[THOMASNET] ThomasNet Listed: {self.stats['thomasnet_found']}")
        print(f"{'='*80}\n")

        # Print database statistics
        print("[STATS] Database Statistics:")
        db_stats = self.suplink_db.get_statistics()
        for key, value in db_stats.items():
            print(f"  {key}: {value}")
        print(f"{'='*80}\n")


async def main():
    """
    Main entry point
    """
    import argparse

    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Comprehensive Business Analysis Pipeline')
    parser.add_argument('--search-id', type=str, help='Specific search ID to analyze (only processes this search)')
    parser.add_argument('--user-id', type=str, help='User ID to associate with analysis results')
    parser.add_argument('--limit', type=int, default=None, help='Maximum number of businesses to analyze')
    parser.add_argument('--skip', type=int, default=0, help='Number of businesses to skip from start')

    args = parser.parse_args()

    # Configuration
    CSV_PATH = Path(__file__).parent / 'data' / 'discover_ai_searches_rows.csv'

    # Create analyzer
    analyzer = ComprehensiveBusinessAnalyzer(str(CSV_PATH))
    
    # Store user_id in analyzer if provided
    if args.user_id:
        analyzer.user_id = args.user_id
        print(f"\n[USER] User ID: {args.user_id}")

    # Run analysis with optional search_id filter
    if args.search_id:
        print(f"\n[MODE] Analyzing ONLY search ID: {args.search_id}")
        print(f"[OPTIMIZATION] This prevents re-analyzing old searches\n")
        await analyzer.run_analysis(search_id=args.search_id, limit=args.limit, skip=args.skip)
    else:
        print(f"\n[MODE] Analyzing ALL searches in database (no filter)")
        print(f"[WARNING] This may re-analyze already processed searches\n")
        await analyzer.run_analysis(limit=args.limit, skip=args.skip)


if __name__ == "__main__":
    # Run the async main function
    asyncio.run(main())
