"""
Suplink Database Service - Store comprehensive business analysis in Supabase
Maps to the suplink_discovered table schema
"""
import os
import uuid
from datetime import datetime
from typing import Dict, List, Optional
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()


class SuplinkDatabase:
    """
    Supabase database service for storing comprehensive business analysis
    Uses the suplink_discovered table
    """

    def __init__(self):
        # Try new credentials first, fallback to old ones
        self.supabase_url = os.getenv('MASTER_SUPABASE_URL') or os.getenv('PROJECT_URL')
        self.supabase_key = os.getenv('MASTER_SUPABASE_KEY') or os.getenv('API_KEY')

        if not self.supabase_url or not self.supabase_key:
            raise ValueError("Supabase credentials not found in .env file. Need MASTER_SUPABASE_URL and MASTER_SUPABASE_KEY")

        self.client: Client = create_client(self.supabase_url, self.supabase_key)
        print(f"[OK] Connected to Supabase: {self.supabase_url}")

    def save_business_analysis(self, analysis_data: Dict) -> bool:
        """
        Save comprehensive business analysis to Supabase

        Args:
            analysis_data: Complete business analysis information

        Returns:
            True if successful, False otherwise
        """
        try:
            # Map to Supabase schema
            supabase_record = self._map_to_schema(analysis_data)

            # Check if business already exists by website_url
            existing = self.client.table('suplink_discovered').select('id').eq(
                'website_url', supabase_record['website_url']
            ).execute()

            if existing.data:
                # Update existing record
                business_id = existing.data[0]['id']
                supabase_record['last_analyzed'] = datetime.now().isoformat()

                result = self.client.table('suplink_discovered').update(
                    supabase_record
                ).eq('id', business_id).execute()

                print(f"  [OK] Updated existing business: {supabase_record['company_name']}")
            else:
                # Insert new record
                result = self.client.table('suplink_discovered').insert(
                    supabase_record
                ).execute()

                print(f"  [OK] Saved new business: {supabase_record['company_name']}")

            return True

        except Exception as e:
            print(f"  [ERROR] Error saving to Supabase: {e}")
            import traceback
            traceback.print_exc()
            return False

    def _map_to_schema(self, data: Dict) -> Dict:
        """
        Map analysis data to Supabase suplink_discovered table schema (STREAMLINED)

        Args:
            data: Complete analysis data

        Returns:
            Mapped dictionary matching streamlined table schema
        """
        website_data = data.get('website_data', {})
        score_data = data.get('score_data', {})
        marketplace_data = data.get('marketplace_presence', {})
        contact = website_data.get('contact', {})
        about = website_data.get('about', {})

        # Determine B2B platform presence
        b2b_verified = False
        b2b_url = None
        b2b_name = None

        if marketplace_data.get('alibaba_verified'):
            b2b_verified = True
            b2b_url = marketplace_data.get('alibaba_url', '')[:500]
            b2b_name = 'Alibaba'
        elif marketplace_data.get('thomasnet_listed'):
            b2b_verified = True
            b2b_url = marketplace_data.get('thomasnet_url', '')[:500]
            b2b_name = 'ThomasNet'

        mapped = {
            # Core Business Information
            'company_name': data.get('company_name', website_data.get('company_name', 'Unknown'))[:255],
            'website_url': data.get('website_url', '')[:500],
            'favicon_url': data.get('favicon_url', '')[:500] if data.get('favicon_url') else None,

            # Contact Information
            'email': contact.get('email', '')[:255] if contact.get('email') else None,
            'phone': contact.get('phone', '')[:100] if contact.get('phone') else None,
            'location': website_data.get('location', '')[:255] if website_data.get('location') else None,

            # Scoring System
            'overall_score': int(score_data.get('total', 0)),
            'star_rating': score_data.get('stars', 1),  # 1-5 star rating
            'score_analysis': score_data.get('score_analysis', ''),
            'score_breakdown': score_data.get('details', {}),

            # Top 3 Additional Beneficial Fields
            # 1. Certifications (highest weighted in parameters.pdf)
            'certifications': website_data.get('certifications', []),

            # 2. Founded Year (credibility metric)
            'founded_year': about.get('founded_year'),

            # 3. B2B Platform Presence
            'b2b_platform_verified': b2b_verified,
            'b2b_platform_url': b2b_url,
            'b2b_platform_name': b2b_name,

            # Metadata
            'search_query': data.get('search_query', ''),
            'search_country': data.get('search_country', ''),  # Store search country for cache checking
            'discover_search_id': data.get('discover_search_id'),  # Link to discover_ai_searches table
            'user_id': data.get('user_id'),  # Add user_id for RLS compliance
            'discovered_date': data.get('discovered_date', datetime.now().isoformat()),
            'last_analyzed': datetime.now().isoformat(),
        }

        return mapped

    def _calculate_website_quality(self, website_data: Dict) -> int:
        """
        Calculate overall website quality score

        Args:
            website_data: Website analysis data

        Returns:
            Quality score 0-100
        """
        quality_score = 0
        visual = website_data.get('visual_elements', {})
        quality = website_data.get('quality_signals', {})

        # HTTPS
        if quality.get('has_https'):
            quality_score += 20

        # Professional elements
        if visual.get('has_logo'):
            quality_score += 15
        if visual.get('has_contact_form'):
            quality_score += 15
        if visual.get('has_social_media'):
            quality_score += 10
        if visual.get('has_news_section'):
            quality_score += 10

        # Contact info
        contact = website_data.get('contact', {})
        if contact.get('email'):
            quality_score += 15
        if contact.get('phone'):
            quality_score += 15

        return min(quality_score, 100)

    def get_all_businesses(self, limit: int = 100) -> List[Dict]:
        """
        Get all discovered businesses

        Args:
            limit: Maximum number to return

        Returns:
            List of businesses
        """
        try:
            result = self.client.table('suplink_discovered').select('*').limit(limit).execute()
            return result.data
        except Exception as e:
            print(f"[ERROR] Error fetching businesses: {e}")
            return []

    def get_business_by_url(self, url: str) -> Optional[Dict]:
        """
        Get a specific business by URL

        Args:
            url: Website URL

        Returns:
            Business data or None
        """
        try:
            result = self.client.table('suplink_discovered').select('*').eq(
                'website_url', url
            ).execute()

            if result.data:
                return result.data[0]
            return None
        except Exception as e:
            print(f"[ERROR] Error fetching business: {e}")
            return None

    def get_top_businesses(self, limit: int = 10, min_score: int = 50) -> List[Dict]:
        """
        Get top-rated businesses

        Args:
            limit: Maximum number to return
            min_score: Minimum overall score

        Returns:
            List of top businesses sorted by score
        """
        try:
            result = self.client.table('suplink_discovered').select('*').gte(
                'overall_score', min_score
            ).order('overall_score', desc=True).limit(limit).execute()

            return result.data
        except Exception as e:
            print(f"[ERROR] Error fetching top businesses: {e}")
            return []

    def get_businesses_with_marketplace_presence(self, limit: int = 50) -> List[Dict]:
        """
        Get businesses verified on B2B platforms

        Args:
            limit: Maximum number to return

        Returns:
            List of businesses with B2B platform presence
        """
        try:
            result = self.client.table('suplink_discovered').select('*').eq(
                'b2b_platform_verified', True
            ).order('overall_score', desc=True).limit(limit).execute()

            return result.data
        except Exception as e:
            print(f"[ERROR] Error fetching marketplace businesses: {e}")
            return []

    def has_existing_suppliers_for_query(self, search_query: str, country: str = None) -> bool:
        """
        Check if we already have suppliers in the database for a given search query AND country.
        This enables smart caching to avoid redundant comprehensive analysis.

        Args:
            search_query: The search term to check (e.g., "coffee")
            country: The target country (e.g., "Vietnam", "Colombia")

        Returns:
            True if suppliers exist for this query+country combination, False otherwise
        """
        try:
            # Normalize search query to lowercase for case-insensitive matching
            normalized_query = search_query.lower().strip()
            normalized_country = country.lower().strip() if country else ''

            # Build query - check BOTH search_query AND country
            query = self.client.table('suplink_discovered').select('id', count='exact').ilike(
                'search_query', f'%{normalized_query}%'
            )

            # If country is provided, also filter by country
            if normalized_country:
                query = query.ilike('search_country', f'%{normalized_country}%')

            result = query.execute()
            supplier_count = result.count if result.count else 0

            if supplier_count > 0:
                country_info = f" + country: '{country}'" if country else ""
                print(f"[CACHE HIT] Found {supplier_count} existing suppliers for query: '{search_query}'{country_info}")
                return True
            else:
                country_info = f" + country: '{country}'" if country else ""
                print(f"[CACHE MISS] No existing suppliers found for query: '{search_query}'{country_info}")
                return False

        except Exception as e:
            print(f"[ERROR] Error checking existing suppliers: {e}")
            # On error, return False to proceed with analysis (fail-safe)
            return False

    def get_suppliers_by_query(self, search_query: str, country: str = None, limit: int = 50) -> List[Dict]:
        """
        Get all suppliers for a specific search query and country combination.
        Used to retrieve cached results when available.

        Args:
            search_query: The search term (e.g., "coffee")
            country: The target country (e.g., "Vietnam", "Colombia")
            limit: Maximum number to return

        Returns:
            List of suppliers matching the query+country
        """
        try:
            normalized_query = search_query.lower().strip()
            normalized_country = country.lower().strip() if country else ''

            query = self.client.table('suplink_discovered').select('*').ilike(
                'search_query', f'%{normalized_query}%'
            )

            # If country is provided, also filter by country
            if normalized_country:
                query = query.ilike('search_country', f'%{normalized_country}%')

            result = query.order('overall_score', desc=True).limit(limit).execute()

            return result.data
        except Exception as e:
            print(f"[ERROR] Error fetching suppliers by query: {e}")
            return []

    def get_suppliers_by_search_id(self, search_id: str) -> List[Dict]:
        """
        Get all suppliers that were discovered from a specific search.
        This allows showing ONLY newly discovered suppliers from the current search.

        Args:
            search_id: The discover_ai_searches ID

        Returns:
            List of suppliers from this specific search, sorted by score
        """
        try:
            result = self.client.table('suplink_discovered').select('*').eq(
                'discover_search_id', search_id
            ).order('overall_score', desc=True).execute()

            supplier_count = len(result.data) if result.data else 0
            print(f"[QUERY] Found {supplier_count} suppliers for search_id: {search_id}")

            return result.data
        except Exception as e:
            print(f"[ERROR] Error fetching suppliers by search_id: {e}")
            return []

    def check_existing_urls(self, urls: List[str]) -> Dict[str, bool]:
        """
        Check which URLs already exist in suplink_discovered database.
        Used for intelligent deduplication - only analyze NEW suppliers.

        Args:
            urls: List of website URLs to check

        Returns:
            Dictionary mapping URL to exists (True/False)
            Example: {'https://example.com': True, 'https://new.com': False}
        """
        try:
            if not urls:
                return {}

            # Query database for these URLs
            result = self.client.table('suplink_discovered').select('website_url').in_(
                'website_url', urls
            ).execute()

            # Create set of existing URLs for fast lookup
            existing_urls = set(row['website_url'] for row in result.data) if result.data else set()

            # Build response dictionary
            url_status = {url: (url in existing_urls) for url in urls}

            existing_count = sum(1 for exists in url_status.values() if exists)
            new_count = len(urls) - existing_count

            print(f"[URL CHECK] {existing_count} existing, {new_count} new out of {len(urls)} total URLs")

            return url_status

        except Exception as e:
            print(f"[ERROR] Error checking existing URLs: {e}")
            # On error, assume all URLs are new (fail-safe)
            return {url: False for url in urls}

    def get_statistics(self) -> Dict:
        """
        Get database statistics

        Returns:
            Dictionary with stats
        """
        try:
            # Total businesses
            total = self.client.table('suplink_discovered').select('id', count='exact').execute()

            # B2B Platform presence
            b2b_verified = self.client.table('suplink_discovered').select('id', count='exact').eq('b2b_platform_verified', True).execute()

            # Average score
            all_businesses = self.client.table('suplink_discovered').select('overall_score').execute()
            scores = [b['overall_score'] for b in all_businesses.data if b.get('overall_score')]
            avg_score = sum(scores) / len(scores) if scores else 0

            # High score count (>= 70)
            high_score = self.client.table('suplink_discovered').select('id', count='exact').gte('overall_score', 70).execute()

            stats = {
                'total_businesses': total.count,
                'b2b_platform_verified': b2b_verified.count,
                'high_score_businesses': high_score.count,
                'average_score': round(avg_score, 1)
            }

            return stats
        except Exception as e:
            print(f"[ERROR] Error fetching statistics: {e}")
            return {}


# Singleton instance - lazy initialization
_suplink_db_instance = None

def get_suplink_db():
    """Get or create the singleton instance"""
    global _suplink_db_instance
    if _suplink_db_instance is None:
        _suplink_db_instance = SuplinkDatabase()
    return _suplink_db_instance

# For backward compatibility
suplink_db = None  # Will be initialized when first accessed
