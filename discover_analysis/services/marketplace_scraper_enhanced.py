"""
Enhanced Marketplace Scraper - Improved search and verification
Better detection of Alibaba and ThomasNet presence with fuzzy matching
"""
import asyncio
from typing import Dict, Optional
from playwright.async_api import async_playwright, Page, Browser
import re
from urllib.parse import urlparse
from difflib import SequenceMatcher


class EnhancedMarketplaceScraper:
    """
    Enhanced marketplace scraper with better search and matching algorithms
    """

    def __init__(self):
        self.timeout = 30000  # 30 seconds
        self.browser: Browser = None
        self._initialized = False
        self._init_error = None

    async def initialize(self):
        """Initialize Playwright browser"""
        if self._initialized and self.browser and self.browser.is_connected():
            return True

        try:
            if self.browser:
                try:
                    await self.browser.close()
                except:
                    pass
            self.playwright = await async_playwright().start()
            self.browser = await self.playwright.chromium.launch(
                headless=True,
                args=['--no-sandbox', '--disable-setuid-sandbox']
            )
            self._initialized = True
            return True
        except Exception as e:
            self._init_error = str(e)
            print(f"[WARNING] Failed to initialize Playwright: {e}")
            self._initialized = False
            return False

    async def close(self):
        """Close browser and Playwright"""
        if self.browser:
            await self.browser.close()
            await self.playwright.stop()

    def _is_alibaba_url(self, url: str) -> bool:
        """Check if URL is an Alibaba supplier URL"""
        if not url:
            return False
        parsed = urlparse(url.lower())
        # Check for Alibaba domains
        return 'alibaba.com' in parsed.netloc

    def _is_thomasnet_url(self, url: str) -> bool:
        """Check if URL is a ThomasNet URL"""
        if not url:
            return False
        parsed = urlparse(url.lower())
        return 'thomasnet.com' in parsed.netloc

    def _extract_alibaba_store_name(self, url: str) -> Optional[str]:
        """
        Extract store name from Alibaba URL
        Example: https://jiaruihongxin.en.alibaba.com -> jiaruihongxin
        """
        try:
            parsed = urlparse(url.lower())
            hostname = parsed.netloc

            # Pattern: storename.en.alibaba.com or storename.alibaba.com
            if '.alibaba.com' in hostname:
                parts = hostname.split('.')
                if len(parts) >= 3:
                    return parts[0]  # First part is usually the store name
        except:
            pass
        return None

    def _similarity_score(self, str1: str, str2: str) -> float:
        """
        Calculate similarity between two strings (0.0 to 1.0)
        Returns percentage match
        """
        if not str1 or not str2:
            return 0.0

        # Normalize strings
        s1 = str1.lower().strip()
        s2 = str2.lower().strip()

        # Exact match
        if s1 == s2:
            return 1.0

        # Check if one contains the other
        if s1 in s2 or s2 in s1:
            return 0.9

        # Use SequenceMatcher for fuzzy matching
        return SequenceMatcher(None, s1, s2).ratio()

    async def check_marketplace_presence(
        self,
        company_name: str,
        website_url: str = None
    ) -> Dict:
        """
        Enhanced marketplace presence check with better verification

        Args:
            company_name: Name of the company
            website_url: Company website URL (optional)

        Returns:
            Dictionary with marketplace presence data
        """
        presence = {
            'alibaba_verified': False,
            'alibaba_url': None,
            'alibaba_data': {},
            'thomasnet_listed': False,
            'thomasnet_url': None,
            'thomasnet_data': {},
            'scraper_available': False,
            'detection_method': None
        }

        # STRATEGY 1: Direct URL detection
        if website_url:
            # Check if the website URL itself IS an Alibaba URL
            if self._is_alibaba_url(website_url):
                print(f"    [OK] Direct detection: URL is on Alibaba.com")
                store_name = self._extract_alibaba_store_name(website_url)
                presence['alibaba_verified'] = True
                presence['alibaba_url'] = website_url
                presence['alibaba_data'] = {
                    'found': True,
                    'url': website_url,
                    'store_name': store_name,
                    'detection_method': 'direct_url'
                }
                presence['detection_method'] = 'direct_url'
                # Don't need to search further for Alibaba
                print(f"    [OK] Alibaba store: {store_name}")

            # Check if the website URL is a ThomasNet URL
            if self._is_thomasnet_url(website_url):
                print(f"    [OK] Direct detection: URL is on ThomasNet.com")
                presence['thomasnet_listed'] = True
                presence['thomasnet_url'] = website_url
                presence['thomasnet_data'] = {
                    'found': True,
                    'url': website_url,
                    'detection_method': 'direct_url'
                }
                # Don't need to search further for ThomasNet
                return presence

        # STRATEGY 2: Look for marketplace links on the business's OWN website
        # This avoids captchas and is more reliable
        if website_url and not presence['alibaba_verified'] and not presence['thomasnet_listed']:
            marketplace_links = await self._find_marketplace_links_on_website(website_url)

            if marketplace_links.get('alibaba_url'):
                print(f"    [OK] Found Alibaba link on company website")
                presence['alibaba_verified'] = True
                presence['alibaba_url'] = marketplace_links['alibaba_url']
                presence['alibaba_data'] = {
                    'found': True,
                    'url': marketplace_links['alibaba_url'],
                    'detection_method': 'website_link'
                }

            if marketplace_links.get('thomasnet_url'):
                print(f"    [OK] Found ThomasNet link on company website")
                presence['thomasnet_listed'] = True
                presence['thomasnet_url'] = marketplace_links['thomasnet_url']
                presence['thomasnet_data'] = {
                    'found': True,
                    'url': marketplace_links['thomasnet_url'],
                    'detection_method': 'website_link'
                }

            # If we found links, we're done
            if presence['alibaba_verified'] or presence['thomasnet_listed']:
                return presence

        # STRATEGY 3: Skip search-based detection due to captchas
        # Just return what we have from direct URL and website link detection
        print(f"  [INFO] Skipping marketplace search (captcha protection)")
        return presence

    async def _find_marketplace_links_on_website(self, website_url: str) -> Dict:
        """
        Look for Alibaba/ThomasNet links on the business's own website
        This avoids captchas and is more reliable
        """
        result = {
            'alibaba_url': None,
            'thomasnet_url': None
        }

        if not self._initialized:
            await self.initialize()

        if not self._initialized:
            return result

        page = None
        try:
            page = await self.browser.new_page()
            page.set_default_timeout(15000)  # Shorter timeout

            await page.goto(website_url, wait_until='domcontentloaded', timeout=15000)
            await asyncio.sleep(2)

            # Get all links on the page
            links = await page.locator('a[href]').all()

            for link in links[:100]:  # Check first 100 links
                try:
                    href = await link.get_attribute('href')
                    if href:
                        href_lower = href.lower()

                        # Check for Alibaba
                        if 'alibaba.com' in href_lower and not result['alibaba_url']:
                            # Make sure it's a proper link
                            if href.startswith('http'):
                                result['alibaba_url'] = href
                                print(f"      -> Found Alibaba link: {href[:60]}...")

                        # Check for ThomasNet
                        if 'thomasnet.com' in href_lower and not result['thomasnet_url']:
                            if href.startswith('http'):
                                result['thomasnet_url'] = href
                                print(f"      -> Found ThomasNet link: {href[:60]}...")

                        # If found both, we're done
                        if result['alibaba_url'] and result['thomasnet_url']:
                            break

                except:
                    continue

            await page.close()
            return result

        except Exception as e:
            print(f"      [WARNING] Error checking website links: {str(e)[:60]}")
            if page:
                try:
                    await page.close()
                except:
                    pass
            return result

    async def _search_alibaba_enhanced(self, company_name: str, website_url: str = None) -> Optional[Dict]:
        """
        Enhanced Alibaba search with better matching
        """
        page = None
        try:
            page = await self.browser.new_page()
            page.set_default_timeout(self.timeout)

            # Strategy 1: Search for exact company name
            search_query = company_name.replace(' ', '+')
            search_url = f"https://www.alibaba.com/trade/search?SearchText={search_query}"

            print(f"    --> Searching: {search_url}")
            await page.goto(search_url, wait_until='domcontentloaded', timeout=self.timeout)
            await asyncio.sleep(3)

            # Try multiple selectors for results
            selectors = [
                '.organic-list-offer',
                '.gallery-offer-item',
                '[class*="search-card"]',
                '[class*="organic"]',
                '.product-card'
            ]

            results_count = 0
            results_locator = None

            for selector in selectors:
                count = await page.locator(selector).count()
                if count > 0:
                    results_count = count
                    results_locator = page.locator(selector)
                    break

            if results_count > 0:
                print(f"    [OK] Found {results_count} results on Alibaba")

                # Check first few results for company name match
                best_match = None
                best_score = 0.0

                for i in range(min(5, results_count)):  # Check top 5 results
                    try:
                        result = results_locator.nth(i)

                        # Try to get supplier/company name
                        supplier_selectors = [
                            '[class*="supplier"]',
                            '[class*="company"]',
                            '[class*="store"]',
                            '.supplier-name',
                            '.company-name'
                        ]

                        supplier_name = None
                        for sel in supplier_selectors:
                            try:
                                name_elem = result.locator(sel).first
                                if await name_elem.count() > 0:
                                    supplier_name = await name_elem.text_content(timeout=2000)
                                    if supplier_name:
                                        supplier_name = supplier_name.strip()
                                        break
                            except:
                                continue

                        if supplier_name:
                            # Calculate similarity
                            score = self._similarity_score(company_name, supplier_name)

                            if score > best_score:
                                best_score = score

                                # Try to get supplier URL
                                supplier_url = None
                                try:
                                    link = await result.locator('a').first.get_attribute('href', timeout=2000)
                                    if link:
                                        if not link.startswith('http'):
                                            link = f"https://www.alibaba.com{link}"
                                        supplier_url = link
                                except:
                                    pass

                                best_match = {
                                    'found': True,
                                    'url': supplier_url or search_url,
                                    'supplier_name': supplier_name,
                                    'match_score': score,
                                    'search_results': results_count,
                                    'detection_method': 'search_with_matching'
                                }

                    except Exception as e:
                        continue

                # If we found a good match (>60% similarity), return it
                if best_match and best_score >= 0.6:
                    print(f"    [OK] Match found: {best_match['supplier_name']} (similarity: {best_score:.0%})")
                    await page.close()
                    return best_match
                elif best_match:
                    print(f"    [~] Weak match: {best_match['supplier_name']} (similarity: {best_score:.0%})")
                    # Still return it but user can see it's weak
                    await page.close()
                    return best_match

            print(f"    [NOT FOUND] Not found on Alibaba")
            await page.close()
            return None

        except Exception as e:
            print(f"    [WARNING] Alibaba search error: {str(e)[:100]}")
            if page:
                try:
                    await page.close()
                except:
                    pass
            return None

    async def _search_thomasnet_enhanced(self, company_name: str, website_url: str = None) -> Optional[Dict]:
        """
        Enhanced ThomasNet search using JSON API
        """
        page = None
        try:
            page = await self.browser.new_page()
            page.set_default_timeout(self.timeout)

            # Use ThomasNet JSON API for better results
            search_query = company_name.replace(' ', '+')
            api_url = f"https://www.thomasnet.com/suppliers/search?cov=NA&format=json&limit=15&searchsource=suppliers&searchterm={search_query}&what={search_query}&which=prod"

            print(f"    --> Searching ThomasNet API...")
            await page.goto(api_url, wait_until='domcontentloaded', timeout=self.timeout)
            await asyncio.sleep(2)

            # Get JSON response
            try:
                # First, try to get response as JSON directly via API call
                import json

                # Use page.evaluate to get the text content
                try:
                    json_text = await page.evaluate('document.body.textContent')
                except:
                    content = await page.content()

                    # Extract JSON from page
                    import re

                    # Try to find JSON in <pre> tags
                    json_match = re.search(r'<pre[^>]*>(.*?)</pre>', content, re.DOTALL)
                    if json_match:
                        json_text = json_match.group(1)
                    elif '<body>' in content:
                        # Try to extract from body
                        body_match = re.search(r'<body[^>]*>(.*?)</body>', content, re.DOTALL)
                        if body_match:
                            json_text = body_match.group(1).strip()
                        else:
                            json_text = content
                    else:
                        json_text = content

                # Clean up HTML entities and tags
                json_text = json_text.replace('&quot;', '"').replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
                json_text = re.sub(r'<[^>]+>', '', json_text).strip()

                if not json_text:
                    print(f"    [WARNING] Empty response from ThomasNet API")
                    await page.close()
                    return None

                # Parse JSON
                data = json.loads(json_text)

                # Check if we have results
                if data and 'results' in data and len(data['results']) > 0:
                    results = data['results']
                    print(f"    [OK] Found {len(results)} results on ThomasNet")

                    # Check results for company name match
                    best_match = None
                    best_score = 0.0

                    for result in results[:5]:  # Check top 5
                        company_name_found = result.get('company_name', '') or result.get('name', '')

                        if company_name_found:
                            score = self._similarity_score(company_name, company_name_found)

                            if score > best_score:
                                best_score = score

                                profile_url = result.get('profile_url') or result.get('url')
                                if profile_url and not profile_url.startswith('http'):
                                    profile_url = f"https://www.thomasnet.com{profile_url}"

                                best_match = {
                                    'found': True,
                                    'url': profile_url or f"https://www.thomasnet.com/search?what={search_query}",
                                    'company_name': company_name_found,
                                    'match_score': score,
                                    'search_results': len(results),
                                    'detection_method': 'api_search_with_matching',
                                    'location': result.get('location', ''),
                                    'phone': result.get('phone', '')
                                }

                    if best_match and best_score >= 0.6:
                        print(f"    [OK] Match found: {best_match['company_name']} (similarity: {best_score:.0%})")
                        await page.close()
                        return best_match
                    elif best_match:
                        print(f"    [~] Weak match: {best_match['company_name']} (similarity: {best_score:.0%})")
                        await page.close()
                        return best_match
                else:
                    print(f"    [NOT FOUND] No results from ThomasNet API")

            except json.JSONDecodeError as e:
                print(f"    [WARNING] JSON API failed, trying fallback search...")
                # Fallback to regular HTML search
                await page.close()
                return await self._search_thomasnet_fallback(company_name, website_url)
            except Exception as e:
                print(f"    [WARNING] API error, trying fallback search...")
                await page.close()
                return await self._search_thomasnet_fallback(company_name, website_url)

            await page.close()
            return None

        except Exception as e:
            print(f"    [WARNING] ThomasNet search error: {str(e)[:100]}")
            if page:
                try:
                    await page.close()
                except:
                    pass
            return None

    async def _search_thomasnet_fallback(self, company_name: str, website_url: str = None) -> Optional[Dict]:
        """
        Fallback ThomasNet search using regular HTML page
        """
        page = None
        try:
            page = await self.browser.new_page()
            page.set_default_timeout(self.timeout)

            search_query = company_name.replace(' ', '+')
            search_url = f"https://www.thomasnet.com/nsearch.html?what={search_query}&searchsource=suppliers"

            print(f"    --> Fallback: {search_url[:80]}...")
            await page.goto(search_url, wait_until='domcontentloaded', timeout=self.timeout)
            await asyncio.sleep(3)

            # Try multiple selectors for modern ThomasNet
            selectors = [
                '[data-testid="search-result"]',
                '.search-result',
                '[class*="supplier"]',
                '[class*="company"]',
                'article',
                '[class*="result"]'
            ]

            results_count = 0
            results_locator = None

            for selector in selectors:
                count = await page.locator(selector).count()
                if count > 0:
                    results_count = count
                    results_locator = page.locator(selector)
                    print(f"    [DEBUG] Found {count} results with selector: {selector}")
                    break

            if results_count > 0 and results_locator:
                print(f"    [OK] Found {results_count} results")

                # Check first few results
                best_match = None
                best_score = 0.0

                for i in range(min(3, results_count)):
                    try:
                        result = results_locator.nth(i)

                        # Get all text from result
                        result_text = await result.text_content(timeout=2000)

                        if result_text:
                            # Simple matching - check if company name appears in result
                            score = self._similarity_score(company_name, result_text)

                            if score > best_score:
                                best_score = score

                                # Try to get link
                                profile_url = search_url
                                try:
                                    link = await result.locator('a').first.get_attribute('href', timeout=2000)
                                    if link:
                                        if not link.startswith('http'):
                                            link = f"https://www.thomasnet.com{link}"
                                        profile_url = link
                                except:
                                    pass

                                best_match = {
                                    'found': True,
                                    'url': profile_url,
                                    'company_name': company_name,
                                    'match_score': score,
                                    'search_results': results_count,
                                    'detection_method': 'fallback_html_search'
                                }

                    except Exception as e:
                        continue

                if best_match and best_score >= 0.4:  # Lower threshold for fallback
                    print(f"    [OK] Potential match found (similarity: {best_score:.0%})")
                    await page.close()
                    return best_match

            print(f"    [NOT FOUND] Not found on ThomasNet")
            await page.close()
            return None

        except Exception as e:
            print(f"    [WARNING] Fallback search error: {str(e)[:100]}")
            if page:
                try:
                    await page.close()
                except:
                    pass
            return None


# Singleton instance
marketplace_scraper_enhanced = EnhancedMarketplaceScraper()
