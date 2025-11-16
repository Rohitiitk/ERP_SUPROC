"""
OpenAI Service - Intelligent supplier filtering and analysis
"""
import os
from openai import OpenAI
from typing import List, Dict
from dotenv import load_dotenv

load_dotenv()

class OpenAIService:
    def __init__(self):
        try:
            # Initialize OpenAI client
            api_key = os.getenv('OPENAI_API_KEY')
            if not api_key:
                raise ValueError("OPENAI_API_KEY not found in environment")

            self.client = OpenAI(api_key=api_key)
            self.model = "gpt-4o-mini"  # Cost-effective model
            self._initialized = True
        except Exception as e:
            print(f"[WARNING] Failed to initialize OpenAI client: {e}")
            self.client = None
            self._initialized = False

    def filter_bulk_suppliers(self, search_results: List[Dict]) -> List[Dict]:
        """
        Filter search results to identify bulk suppliers/manufacturers

        Args:
            search_results: List of search results from Serper

        Returns:
            Filtered list of potential bulk suppliers
        """
        if not search_results:
            return []

        # Prepare context for AI
        results_text = "\n".join([
            f"{i+1}. {r['title']} - {r['snippet']} [{r['url']}]"
            for i, r in enumerate(search_results[:20])
        ])

        prompt = f"""Analyze these search results and identify which ones are likely to be BULK SUPPLIERS or MANUFACTURERS (not retailers, marketplaces, or individual sellers).

Search Results:
{results_text}

For each result, determine if it's a bulk supplier based on:
1. Mentions of "manufacturer", "factory", "wholesale", "bulk", "OEM", "ODM"
2. B2B focus (not B2C retail)
3. Industrial/commercial language
4. Production capabilities mentioned

Return a JSON array with only the bulk suppliers. For each, include:
- "position": the number from the list
- "reason": why you classified it as bulk supplier
- "confidence": score from 0-100

Format:
[
  {{"position": 1, "reason": "Mentioned as electronics manufacturer with OEM services", "confidence": 95}},
  ...
]"""

        try:
            # Request a JSON object with a top-level "suppliers" array to make parsing deterministic.
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are an expert in supplier identification and B2B commerce. You analyze business websites to classify them as bulk suppliers, manufacturers, wholesalers, or other categories."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
            )

            import json
            raw = response.choices[0].message.content

            # Check if response is empty or None
            if not raw or not raw.strip():
                print(f"[ERROR] OpenAI returned empty response")
                raise ValueError("Empty response from OpenAI")

            # Strip markdown code blocks if present
            raw = raw.strip()
            if raw.startswith('```json'):
                raw = raw[7:]  # Remove ```json
            if raw.startswith('```'):
                raw = raw[3:]  # Remove ```
            if raw.endswith('```'):
                raw = raw[:-3]  # Remove trailing ```
            raw = raw.strip()

            # Some models may return a JSON array or object as text — handle both safely.
            parsed = json.loads(raw)

            if isinstance(parsed, list):
                suppliers_list = parsed
            elif isinstance(parsed, dict) and 'suppliers' in parsed:
                suppliers_list = parsed['suppliers']
            elif isinstance(parsed, dict) and 'results' in parsed:
                suppliers_list = parsed['results']
            else:
                # Unknown shape — try to coerce common cases
                suppliers_list = []

            # Map back to original results
            bulk_suppliers = []
            for item in suppliers_list:
                # item can be either a mapping or a simple int/position — guard accordingly
                if not isinstance(item, dict):
                    continue
                pos = item.get('position', 0) - 1
                if 0 <= pos < len(search_results):
                    supplier = search_results[pos].copy()
                    supplier['ai_classification'] = {
                        'reason': item.get('reason', ''),
                        'confidence': item.get('confidence', 0)
                    }
                    bulk_suppliers.append(supplier)

            print(f"[OK] Filtered to {len(bulk_suppliers)} bulk suppliers")
            return bulk_suppliers

        except Exception as e:
            print(f"[ERROR] OpenAI filtering error: {e}")
            print(f"   Raw response: '{raw}'" if 'raw' in locals() else "   No response received")
            # Fallback: return all results with keyword filtering
            return [r for r in search_results
                    if any(kw in r['title'].lower() or kw in r['snippet'].lower()
                          for kw in ['manufacturer', 'wholesale', 'bulk', 'factory', 'supplier'])]

    def analyze_website_content(self, content: str, company_name: str) -> Dict:
        """
        Deep analysis of website content using AI

        Args:
            content: Extracted website content
            company_name: Company name for context

        Returns:
            Structured analysis including quality indicators
        """
        prompt = f"""Analyze this company website content and extract key business information.

Company: {company_name}

Content:
{content[:4000]}  # Limit content to avoid token limits

Extract and return JSON with:
{{
  "business_type": "manufacturer/wholesaler/trader/service",
  "products_services": ["list of main products/services"],
  "certifications_found": ["list of certifications mentioned"],
  "years_in_business": null or number,
  "production_capability": "description if mentioned",
  "target_market": "B2B/B2C/Both",
  "quality_indicators": ["indicators of quality/professionalism"],
  "red_flags": ["any concerning information"],
  "confidence_score": 0-100
}}"""

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are an expert business analyst specializing in supplier evaluation. Extract structured information from website content."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.2,
                response_format={"type": "json_object"}
            )

            import json
            analysis = json.loads(response.choices[0].message.content)
            return analysis

        except Exception as e:
            print(f"[ERROR] OpenAI analysis error: {e}")
            return {}

    def extract_business_location(self, content: str) -> str:
        """
        Extract business location/address from text content using AI

        Args:
            content: Text content that may contain location information

        Returns:
            Extracted location string or None
        """
        if not self._initialized or not self.client:
            return None

        if not content or len(content.strip()) < 10:
            return None

        prompt = f"""Extract the business location/address from this text.

Text content:
{content[:2000]}

Instructions:
1. Look for a complete business address including city, state/province, country
2. If you find a full address, return it in a clean format
3. If you only find a city and country, return that
4. Return ONLY the location string, nothing else
5. If no location is found, return "NONE"

Examples of good responses:
- "123 Business St, San Francisco, CA 94103, USA"
- "Mumbai, Maharashtra, India"
- "Shenzhen, Guangdong, China"
- "Berlin, Germany"

Return only the location string:"""

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are an expert at extracting location information from business websites. Extract only the location, nothing else."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,  # Low temperature for factual extraction
                max_tokens=100
            )

            location = response.choices[0].message.content.strip()

            # Check if no location was found
            if location.upper() == "NONE" or len(location) < 3:
                return None

            # Clean up the response
            location = location.strip('"\'')  # Remove quotes if present

            return location

        except Exception as e:
            print(f"[WARNING] OpenAI location extraction error: {e}")
            return None

    def extract_business_info(self, content: str, company_name: str = None) -> Dict:
        """
        Extract comprehensive business information from text using AI

        Args:
            content: Text content from webpage
            company_name: Optional company name for context

        Returns:
            Dictionary with extracted business information
        """
        if not self._initialized or not self.client:
            return {}

        if not content or len(content.strip()) < 20:
            return {}

        company_context = f"Company Name: {company_name}\n\n" if company_name else ""

        prompt = f"""{company_context}Extract business contact and location information from this website content.

Content:
{content[:3000]}

Return a JSON object with these fields (use null if not found):
{{
  "location": "Full business address or city, country",
  "email": "Contact email address",
  "phone": "Contact phone number",
  "founded_year": Year company was founded (number only, or null),
  "company_name": "Official company name if clearly stated"
}}

Extract ONLY factual information explicitly stated in the content. If information is not found, use null.
"""

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are an expert at extracting business contact information from websites. Return only factual information found in the content."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,
                max_tokens=200,
                response_format={"type": "json_object"}
            )

            import json
            info = json.loads(response.choices[0].message.content)

            # Clean up and validate
            result = {}

            if info.get('location') and len(str(info['location'])) > 3:
                result['location'] = str(info['location']).strip()

            if info.get('email') and '@' in str(info['email']):
                result['email'] = str(info['email']).strip()

            if info.get('phone'):
                result['phone'] = str(info['phone']).strip()

            if info.get('founded_year'):
                try:
                    year = int(info['founded_year'])
                    if 1800 <= year <= 2025:  # Reasonable year range
                        result['founded_year'] = year
                except:
                    pass

            if info.get('company_name') and len(str(info['company_name'])) > 2:
                result['company_name'] = str(info['company_name']).strip()

            return result

        except Exception as e:
            print(f"[WARNING] OpenAI business info extraction error: {e}")
            return {}

# Singleton instance - with error handling
try:
    openai_service = OpenAIService()
    if not openai_service._initialized:
        print("[INFO] OpenAI service initialized but not available (missing API key or client error)")
except Exception as e:
    print(f"[WARNING] Could not create OpenAI service: {e}")
    openai_service = None
