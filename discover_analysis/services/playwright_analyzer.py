"""
Playwright Web Analyzer - Deep website analysis using Playwright
"""
import re
import asyncio
from typing import Dict, List, Optional
from playwright.async_api import async_playwright, Page, Browser
from dotenv import load_dotenv
import os

load_dotenv()

# Import certification detector
try:
    from services.certification_detector import certification_detector
except ImportError:
    from certification_detector import certification_detector

class PlaywrightAnalyzer:
    def __init__(self):
        self.headless = os.getenv('PLAYWRIGHT_HEADLESS', 'true').lower() == 'true'
        self.timeout = int(os.getenv('PLAYWRIGHT_TIMEOUT', '60000'))  # Increased to 60s
        self.browser: Browser = None
        self.max_retries = 2
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
                headless=self.headless,
                args=['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
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

    async def analyze_website(self, url: str) -> Dict:
        """
        Comprehensive website analysis with retry logic

        Args:
            url: Website URL to analyze

        Returns:
            Dictionary with all extracted data
        """
        # Try to initialize
        initialized = await self.initialize()
        if not initialized:
            print(f"[ERROR] Playwright not available: {self._init_error}")
            return {
                'url': url,
                'error': f'Playwright initialization failed: {self._init_error}',
                'company_name': 'Unknown',
                'analysis_failed': True
            }

        # Try with different wait strategies
        wait_strategies = [
            'domcontentloaded',  # Faster - wait for DOM only
            'load',              # Medium - wait for load event
            'networkidle'        # Slower - wait for network to be idle
        ]

        last_error = None

        for attempt, wait_until in enumerate(wait_strategies, 1):
            # Ensure browser is still connected
            if not self.browser or not self.browser.is_connected():
                await self.initialize()

            page = await self.browser.new_page()

            try:
                print(f"[ANALYZING] {url} (attempt {attempt}/{len(wait_strategies)}, strategy: {wait_until})")

                # Set longer timeout for page
                page.set_default_timeout(self.timeout)

                # Navigate to website with current strategy
                try:
                    await page.goto(url, wait_until=wait_until, timeout=self.timeout)
                except Exception as nav_error:
                    if 'timeout' in str(nav_error).lower():
                        print(f"  [WARNING]  Timeout with '{wait_until}' strategy, trying next...")
                        last_error = nav_error
                        await page.close()
                        continue
                    else:
                        raise

                # If we got here, navigation succeeded
                print(f"  [OK] Page loaded successfully")

                # Extract all data (with individual try-catch to prevent total failure)
                data = {
                    'url': url,
                    'company_name': await self._safe_extract(self._extract_company_name, page, 'Unknown Company'),
                    'location': await self._safe_extract(self._extract_location, page, None),
                    'certifications': await self._safe_extract(self._extract_certifications, page, []),
                    'about': await self._safe_extract(self._extract_about_info, page, {}),
                    'contact': await self._safe_extract(self._extract_contact_info, page, {}),
                    'capabilities': await self._safe_extract(self._extract_capabilities, page, {}),
                    'visual_elements': await self._safe_extract(self._extract_visual_indicators, page, {}),
                    'products_services': await self._safe_extract(self._extract_products_services, page, []),
                    'quality_signals': await self._safe_extract(self._extract_quality_signals, page, {}),
                    'freshness_signals': await self._safe_extract(self._extract_freshness_signals, page, {}),
                    'content_text': await self._safe_extract(self._get_page_content, page, '')
                }

                # ENHANCE WITH AI: Use OpenAI to improve location and contact extraction
                try:
                    ai_enhanced_data = await self._enhance_with_ai(page, data)
                    if ai_enhanced_data:
                        # Merge AI-extracted data with existing data (AI takes priority for key fields)
                        if ai_enhanced_data.get('location') and not data.get('location'):
                            data['location'] = ai_enhanced_data['location']
                            print(f"  [AI] Enhanced location: {ai_enhanced_data['location']}")

                        if ai_enhanced_data.get('email') and not data.get('contact', {}).get('email'):
                            if 'contact' not in data:
                                data['contact'] = {}
                            data['contact']['email'] = ai_enhanced_data['email']
                            print(f"  [AI] Enhanced email: {ai_enhanced_data['email']}")

                        if ai_enhanced_data.get('phone') and not data.get('contact', {}).get('phone'):
                            if 'contact' not in data:
                                data['contact'] = {}
                            data['contact']['phone'] = ai_enhanced_data['phone']
                            print(f"  [AI] Enhanced phone: {ai_enhanced_data['phone']}")

                        if ai_enhanced_data.get('founded_year') and not data.get('about', {}).get('founded_year'):
                            if 'about' not in data:
                                data['about'] = {}
                            data['about']['founded_year'] = ai_enhanced_data['founded_year']
                            print(f"  [AI] Enhanced founded year: {ai_enhanced_data['founded_year']}")

                        if ai_enhanced_data.get('company_name') and data.get('company_name') == 'Unknown Company':
                            data['company_name'] = ai_enhanced_data['company_name']
                            print(f"  [AI] Enhanced company name: {ai_enhanced_data['company_name']}")
                except Exception as e:
                    print(f"  [WARNING]  AI enhancement failed: {e}")

                print(f"[OK] Analysis complete for {data['company_name']}")
                await page.close()
                await asyncio.sleep(1)  # Small delay between operations
                return data

            except Exception as e:
                print(f"  [ERROR] Error with '{wait_until}' strategy: {str(e)[:100]}")
                last_error = e
                try:
                    await page.close()
                except:
                    pass
                await asyncio.sleep(1)  # Small delay before retry
                continue

        # All strategies failed
        print(f"[ERROR] All attempts failed for {url}")
        return {
            'url': url,
            'error': str(last_error),
            'company_name': 'Unknown',
            'analysis_failed': True
        }

    async def _enhance_with_ai(self, page: Page, existing_data: Dict) -> Dict:
        """
        Use OpenAI to enhance extracted data with better accuracy

        Args:
            page: Playwright page object
            existing_data: Already extracted data

        Returns:
            Dictionary with AI-enhanced data
        """
        try:
            from .openai_service import openai_service

            if not openai_service:
                return {}

            # Get page content for AI analysis
            page_text = existing_data.get('content_text', '')

            if not page_text or len(page_text.strip()) < 50:
                # If no content text, try to get it
                try:
                    page_text = await page.text_content('body', timeout=3000)
                except:
                    return {}

            # Get company name for context
            company_name = existing_data.get('company_name', 'Unknown Company')

            # Call AI service to extract business info
            import asyncio
            loop = asyncio.get_event_loop()
            ai_data = await loop.run_in_executor(
                None,
                openai_service.extract_business_info,
                page_text,
                company_name
            )

            return ai_data

        except Exception as e:
            print(f"  [WARNING]  AI enhancement error: {e}")
            return {}

    async def _safe_extract(self, extract_func, page, default_value):
        """
        Safely execute extraction function with timeout and error handling

        Args:
            extract_func: Extraction function to call
            page: Playwright page object
            default_value: Value to return if extraction fails

        Returns:
            Extracted data or default value
        """
        try:
            return await extract_func(page)
        except Exception as e:
            # print(f"  [WARNING]  Extraction error in {extract_func.__name__}: {e}")
            return default_value

    async def _extract_company_name(self, page: Page) -> str:
        """Extract company name using multiple methods"""
        try:
            # Try h1
            h1 = await page.locator('h1').first.text_content(timeout=2000)
            if h1 and len(h1.strip()) > 0:
                return h1.strip()
        except:
            pass

        try:
            # Try og:site_name meta tag
            og_name = await page.get_attribute('meta[property="og:site_name"]', 'content', timeout=2000)
            if og_name:
                return og_name.strip()
        except:
            pass

        try:
            # Try page title
            title = await page.title()
            return title.split('|')[0].split('-')[0].strip()
        except:
            pass

        return 'Unknown Company'

    async def _extract_certifications(self, page: Page) -> List[str]:
        """
        Extract certifications from page using knowledge base
        Returns simple list of certification names
        """
        try:
            # Get all page text
            page_content = await page.text_content('body', timeout=5000)

            # Use certification detector with knowledge base
            detections = certification_detector.detect_from_text(page_content, context='page_content')

            # Format as simple list (filter by confidence threshold 0.7)
            certifications = certification_detector.format_certification_list(
                detections,
                min_confidence=0.7
            )

            if certifications:
                print(f"  [CERTS] Detected {len(certifications)} certifications: {', '.join(certifications)}")

            return certifications

        except Exception as e:
            print(f"  [WARNING] Error extracting certifications: {e}")
            return []

    async def _extract_location(self, page: Page) -> str:
        """
        Extract company location/address with enhanced accuracy
        Uses structured data, semantic HTML, AI extraction, and regex patterns
        """
        try:
            # Strategy 1: Try structured data (Schema.org)
            structured_location = await self._extract_location_from_structured_data(page)
            if structured_location:
                print(f"  [OK] Location from structured data: {structured_location[:50]}...")
                return structured_location

            # Strategy 2: Try semantic HTML elements
            semantic_location = await self._extract_location_from_semantic_html(page)
            if semantic_location:
                print(f"  [OK] Location from semantic HTML: {semantic_location[:50]}...")
                return semantic_location

            # Strategy 3: Try focused content sections with AI
            location_sections = []

            selectors = [
                'address',
                'footer',
                '[class*="address"]',
                '[class*="location"]',
                '[class*="contact"]',
                '[id*="contact"]',
                '[id*="address"]',
                '[id*="location"]',
                '.contact-info',
                '.company-info',
                '[itemprop="address"]'
            ]

            for selector in selectors:
                try:
                    elements = await page.locator(selector).all()
                    for el in elements[:2]:  # Limit to first 2 matches per selector
                        text = await el.text_content(timeout=2000)
                        if text and len(text.strip()) > 15:
                            location_sections.append(text.strip()[:800])
                except:
                    continue

            # Strategy 4: Use AI to extract location from sections
            if location_sections:
                from .openai_service import openai_service
                if openai_service and openai_service._initialized:
                    try:
                        ai_location = await self._extract_location_with_ai(location_sections)
                        if ai_location and len(ai_location) > 10:
                            print(f"  [OK] Location from AI: {ai_location[:50]}...")
                            return ai_location
                    except Exception as e:
                        print(f"  [WARNING] AI location extraction failed: {e}")

            # Strategy 5: Fallback to regex patterns for common address formats
            for section in location_sections:
                location = self._extract_location_with_regex(section)
                if location:
                    print(f"  [OK] Location from regex: {location[:50]}...")
                    return location

        except Exception as e:
            print(f"  [WARNING] Location extraction error: {e}")

        return None

    async def _extract_location_from_structured_data(self, page: Page) -> str:
        """Extract location from Schema.org structured data"""
        try:
            # Try to find JSON-LD structured data
            script_elements = await page.locator('script[type="application/ld+json"]').all()

            for script in script_elements[:3]:
                try:
                    content = await script.text_content()
                    if content:
                        import json
                        data = json.loads(content)

                        # Handle both single object and array
                        if isinstance(data, list):
                            for item in data:
                                location = self._parse_structured_location(item)
                                if location:
                                    return location
                        else:
                            location = self._parse_structured_location(data)
                            if location:
                                return location
                except:
                    continue

        except Exception as e:
            pass

        return None

    def _parse_structured_location(self, data: dict) -> str:
        """Parse location from structured data object"""
        try:
            # Try to find address in common Schema.org formats
            address = None

            # Check direct address field
            if 'address' in data:
                addr = data['address']
                if isinstance(addr, str):
                    address = addr
                elif isinstance(addr, dict):
                    # PostalAddress format
                    parts = []
                    for key in ['streetAddress', 'addressLocality', 'addressRegion', 'postalCode', 'addressCountry']:
                        if key in addr and addr[key]:
                            parts.append(str(addr[key]))
                    if parts:
                        address = ', '.join(parts)

            # Check location field
            elif 'location' in data:
                loc = data['location']
                if isinstance(loc, dict) and 'address' in loc:
                    return self._parse_structured_location(loc)

            if address and len(address) > 10:
                return address.strip()

        except:
            pass

        return None

    async def _extract_location_from_semantic_html(self, page: Page) -> str:
        """Extract location from semantic HTML elements"""
        try:
            # Try address tag first
            try:
                address_el = await page.locator('address').first
                address_text = await address_el.text_content(timeout=2000)
                if address_text and len(address_text.strip()) > 15:
                    # Clean up the address
                    cleaned = ' '.join(address_text.strip().split())
                    if self._looks_like_address(cleaned):
                        return cleaned
            except:
                pass

            # Try itemprop="address"
            try:
                itemprop_el = await page.locator('[itemprop="address"]').first
                itemprop_text = await itemprop_el.text_content(timeout=2000)
                if itemprop_text and len(itemprop_text.strip()) > 15:
                    cleaned = ' '.join(itemprop_text.strip().split())
                    if self._looks_like_address(cleaned):
                        return cleaned
            except:
                pass

        except:
            pass

        return None

    def _looks_like_address(self, text: str) -> bool:
        """Check if text looks like a physical address"""
        if not text or len(text) < 15:
            return False

        # Address indicators
        address_indicators = [
            # Street indicators
            r'\b(street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct|way|place|pl|circle|terrace|parkway)\b',
            # Common patterns
            r'\d+\s+[A-Z]',  # Number followed by uppercase (123 Main St)
            r'\b\d{5}\b',  # ZIP code
            r'\b[A-Z]{2}\s+\d{5}\b',  # State + ZIP
            # International patterns
            r'\b(suite|ste|floor|unit|apt|building|bldg)\b',
        ]

        text_lower = text.lower()

        for pattern in address_indicators:
            if re.search(pattern, text, re.IGNORECASE):
                return True

        # Check for city, state/province patterns
        if re.search(r'[A-Z][a-z]+,\s*[A-Z]{2}', text):  # City, ST
            return True

        # Check for international format (City, Country)
        if re.search(r'[A-Z][a-z]+,\s*[A-Z][a-z]+', text):
            return True

        return False

    def _extract_location_with_regex(self, text: str) -> str:
        """Extract location using comprehensive regex patterns"""
        if not text:
            return None

        # Pattern 1: Full US address (123 Main St, City, ST 12345)
        us_full = r'\d+\s+[A-Za-z0-9\s,]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Way|Place|Parkway)[,\s]+[A-Z][a-z]+[,\s]+[A-Z]{2}\s+\d{5}'
        match = re.search(us_full, text, re.IGNORECASE)
        if match:
            return match.group(0).strip()

        # Pattern 2: City, State ZIP
        city_state_zip = r'[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?'
        match = re.search(city_state_zip, text)
        if match:
            return match.group(0).strip()

        # Pattern 3: International format (City, State/Province, Country)
        intl_format = r'[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z][a-z]+'
        match = re.search(intl_format, text)
        if match:
            location = match.group(0).strip()
            if len(location) > 10:
                return location

        # Pattern 4: Street address with number
        street_addr = r'\d+\s+[A-Za-z0-9\s,]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Way|Place|Parkway)'
        match = re.search(street_addr, text, re.IGNORECASE)
        if match:
            addr = match.group(0).strip()
            # Try to extend with city if present
            extended = re.search(street_addr + r'[,\s]+[A-Z][a-z]+', text, re.IGNORECASE)
            if extended:
                return extended.group(0).strip()
            return addr

        # Pattern 5: Simple City, Country
        city_country = r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),\s*([A-Z][a-z]+)\b'
        matches = re.findall(city_country, text)
        for match in matches:
            location = f"{match[0]}, {match[1]}"
            # Verify it's not a person name or something else
            if len(location) > 8 and ',' in location:
                return location

        return None

    async def _extract_location_with_ai(self, location_sections: List[str]) -> Optional[str]:
        """Use OpenAI to extract location from text sections"""
        try:
            from .openai_service import openai_service

            if not openai_service:
                return None

            combined_text = "\n\n".join(location_sections[:3])  # Use first 3 sections

            import asyncio
            loop = asyncio.get_event_loop()
            location = await loop.run_in_executor(
                None,
                openai_service.extract_business_location,
                combined_text
            )

            return location
        except Exception as e:
            print(f"  [WARNING]  AI location extraction error: {e}")
            return None

    async def _extract_contact_info(self, page: Page) -> Dict:
        """
        Extract contact information with enhanced accuracy
        Uses multiple strategies: structured selectors, regex patterns, and AI extraction
        """
        contact = {
            'phone': None,
            'email': None,
            'address': None
        }

        try:
            # Strategy 1: Try structured HTML selectors first
            print("  [EXTRACT] Trying structured selectors for contact info...")
            structured_contact = await self._extract_contact_from_selectors(page)

            # Strategy 2: Get page content for regex extraction
            page_content = await page.text_content('body', timeout=5000)

            # Extract email with multiple patterns
            if not structured_contact.get('email'):
                contact['email'] = self._extract_email_from_text(page_content)
            else:
                contact['email'] = structured_contact['email']

            # Extract phone with international format support
            if not structured_contact.get('phone'):
                contact['phone'] = self._extract_phone_from_text(page_content)
            else:
                contact['phone'] = structured_contact['phone']

            # Extract address - try structured first, then AI-enhanced extraction
            if not structured_contact.get('address'):
                contact['address'] = await self._extract_location(page)
            else:
                contact['address'] = structured_contact['address']

            # Strategy 3: If still missing critical info, use AI extraction
            if not all([contact['email'], contact['phone'], contact['address']]):
                print("  [EXTRACT] Using AI for missing contact information...")
                ai_contact = await self._extract_contact_with_ai(page_content, page)

                # Fill in missing fields only
                if not contact['email'] and ai_contact.get('email'):
                    contact['email'] = ai_contact['email']
                if not contact['phone'] and ai_contact.get('phone'):
                    contact['phone'] = ai_contact['phone']
                if not contact['address'] and ai_contact.get('address'):
                    contact['address'] = ai_contact['address']

            # Clean and validate extracted data
            contact = self._validate_and_clean_contact(contact)

            # Log what was found
            found = []
            if contact['email']: found.append('email')
            if contact['phone']: found.append('phone')
            if contact['address']: found.append('address')
            if found:
                print(f"  [OK] Contact info found: {', '.join(found)}")

        except Exception as e:
            print(f"  [WARNING] Error extracting contact info: {e}")

        return contact

    async def _extract_contact_from_selectors(self, page: Page) -> Dict:
        """Extract contact info from structured HTML elements"""
        contact = {'email': None, 'phone': None, 'address': None}

        try:
            # Email selectors
            email_selectors = [
                'a[href^="mailto:"]',
                '[class*="email"]',
                '[id*="email"]',
                '[itemprop="email"]',
                'address a[href^="mailto:"]'
            ]

            for selector in email_selectors:
                try:
                    elements = await page.locator(selector).all()
                    for el in elements[:3]:
                        text = await el.text_content(timeout=1000)
                        href = await el.get_attribute('href')

                        if href and href.startswith('mailto:'):
                            email = href.replace('mailto:', '').split('?')[0]
                            if self._is_valid_email(email):
                                contact['email'] = email
                                break
                        elif text and '@' in text:
                            email = self._extract_email_from_text(text)
                            if email:
                                contact['email'] = email
                                break

                    if contact['email']:
                        break
                except:
                    continue

            # Phone selectors
            phone_selectors = [
                'a[href^="tel:"]',
                '[class*="phone"]',
                '[class*="tel"]',
                '[id*="phone"]',
                '[itemprop="telephone"]',
                '[class*="contact"] a[href^="tel:"]'
            ]

            for selector in phone_selectors:
                try:
                    elements = await page.locator(selector).all()
                    for el in elements[:3]:
                        text = await el.text_content(timeout=1000)
                        href = await el.get_attribute('href')

                        if href and href.startswith('tel:'):
                            phone = href.replace('tel:', '').strip()
                            contact['phone'] = self._clean_phone(phone)
                            break
                        elif text:
                            phone = self._extract_phone_from_text(text)
                            if phone:
                                contact['phone'] = phone
                                break

                    if contact['phone']:
                        break
                except:
                    continue

            # Address selectors
            address_selectors = [
                'address',
                '[itemprop="address"]',
                '[class*="address"]',
                '[id*="address"]',
                '[class*="location"]'
            ]

            for selector in address_selectors:
                try:
                    element = await page.locator(selector).first
                    text = await element.text_content(timeout=2000)
                    if text and len(text.strip()) > 15:
                        contact['address'] = text.strip()[:500]
                        break
                except:
                    continue

        except Exception as e:
            print(f"  [WARNING] Selector extraction error: {e}")

        return contact

    def _extract_email_from_text(self, text: str) -> str:
        """Extract email with comprehensive patterns"""
        if not text:
            return None

        # Multiple email patterns for better coverage
        email_patterns = [
            # Standard email
            r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
            # Email with subdomain
            r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
            # Email in parentheses or brackets
            r'[\(\[]([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,})[\)\]]',
        ]

        for pattern in email_patterns:
            matches = re.findall(pattern, text)
            for match in matches:
                email = match.strip() if isinstance(match, str) else match
                if self._is_valid_email(email):
                    return email

        return None

    def _is_valid_email(self, email: str) -> bool:
        """Validate email address"""
        if not email or '@' not in email:
            return False

        # Filter out common false positives
        invalid_domains = ['example.com', 'test.com', 'email.com', 'youremail.com']
        invalid_patterns = ['@png', '@jpg', '@gif', '@webp', '.png@', '.jpg@']

        email_lower = email.lower()

        # Check invalid domains
        for domain in invalid_domains:
            if domain in email_lower:
                return False

        # Check invalid patterns
        for pattern in invalid_patterns:
            if pattern in email_lower:
                return False

        # Basic structure validation
        if email.count('@') != 1:
            return False

        local, domain = email.split('@')
        if len(local) < 1 or len(domain) < 3:
            return False

        if '.' not in domain:
            return False

        return True

    def _extract_phone_from_text(self, text: str) -> str:
        """Extract phone with international format support"""
        if not text:
            return None

        # Multiple phone patterns for international formats
        phone_patterns = [
            # International format: +1-234-567-8900
            r'\+\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}',
            # US format: (123) 456-7890 or 123-456-7890
            r'\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}',
            # International without plus: 00 1 234 567 8900
            r'\b00\s*\d{1,3}[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}',
            # Dot separated: 123.456.7890
            r'\b\d{3}\.\d{3}\.\d{4}\b',
            # Space separated international: +91 98765 43210
            r'\+\d{1,3}\s\d{4,5}\s\d{4,6}',
            # Simple format with country code: +44 20 1234 5678
            r'\+\d{1,3}\s\d{2,4}\s\d{3,4}\s\d{4}',
        ]

        for pattern in phone_patterns:
            matches = re.findall(pattern, text)
            for match in matches:
                phone = self._clean_phone(match)
                if self._is_valid_phone(phone):
                    return phone

        return None

    def _clean_phone(self, phone: str) -> str:
        """Clean and format phone number"""
        if not phone:
            return None

        # Keep only digits, plus, parentheses, and basic separators
        cleaned = re.sub(r'[^\d\+\-\.\s\(\)]', '', phone)

        # Remove excessive whitespace
        cleaned = ' '.join(cleaned.split())

        return cleaned.strip()

    def _is_valid_phone(self, phone: str) -> bool:
        """Validate phone number"""
        if not phone:
            return False

        # Count digits only
        digits = re.sub(r'\D', '', phone)

        # Valid phone should have 7-15 digits
        if len(digits) < 7 or len(digits) > 15:
            return False

        # Filter out common false positives (dates, IDs, etc.)
        # Avoid numbers that look like years
        if phone.strip() in ['2020', '2021', '2022', '2023', '2024', '2025']:
            return False

        return True

    def _validate_and_clean_contact(self, contact: Dict) -> Dict:
        """Final validation and cleaning of contact information"""
        cleaned = {}

        # Validate and clean email
        if contact.get('email'):
            email = contact['email'].strip().lower()
            if self._is_valid_email(email):
                cleaned['email'] = email
            else:
                cleaned['email'] = None
        else:
            cleaned['email'] = None

        # Validate and clean phone
        if contact.get('phone'):
            phone = self._clean_phone(contact['phone'])
            if self._is_valid_phone(phone):
                cleaned['phone'] = phone
            else:
                cleaned['phone'] = None
        else:
            cleaned['phone'] = None

        # Clean address
        if contact.get('address'):
            address = contact['address'].strip()
            # Remove excessive whitespace and newlines
            address = ' '.join(address.split())
            if len(address) > 10:  # Minimum reasonable address length
                cleaned['address'] = address
            else:
                cleaned['address'] = None
        else:
            cleaned['address'] = None

        return cleaned

    async def _extract_contact_with_ai(self, page_content: str, page: Page) -> Dict:
        """Use AI to extract contact information when structured methods fail"""
        try:
            from .openai_service import openai_service

            if not openai_service or not openai_service._initialized:
                return {}

            # Get focused content sections likely to contain contact info
            contact_sections = []

            contact_selectors = [
                'footer',
                '[class*="contact"]',
                '[id*="contact"]',
                '[class*="footer"]',
                'address'
            ]

            for selector in contact_selectors:
                try:
                    elements = await page.locator(selector).all()
                    for el in elements[:2]:
                        text = await el.text_content(timeout=2000)
                        if text and len(text.strip()) > 20:
                            contact_sections.append(text.strip()[:1000])
                except:
                    continue

            # Use OpenAI to extract from focused sections
            if contact_sections:
                combined_text = "\n\n".join(contact_sections[:3])

                import asyncio
                loop = asyncio.get_event_loop()
                ai_data = await loop.run_in_executor(
                    None,
                    openai_service.extract_business_info,
                    combined_text,
                    None
                )

                return {
                    'email': ai_data.get('email'),
                    'phone': ai_data.get('phone'),
                    'address': ai_data.get('location')
                }

        except Exception as e:
            print(f"  [WARNING] AI contact extraction error: {e}")

        return {}

    async def _extract_capabilities(self, page: Page) -> Dict:
        """Extract production capabilities and manufacturing info"""
        capabilities = {}

        capability_keywords = {
            'production_capacity': ['production capacity', 'manufacturing capacity', 'output'],
            'equipment': ['equipment', 'machinery', 'machines'],
            'facility': ['facility', 'factory', 'plant', 'warehouse'],
            'employees': ['employees', 'workforce', 'staff', 'workers'],
            'technology': ['technology', 'automation', 'advanced'],
            'quality_control': ['quality control', 'QC', 'inspection', 'testing'],
            'r_and_d': ['R&D', 'research', 'development', 'innovation'],
            'oem_odm': ['OEM', 'ODM', 'custom', 'customization'],
        }

        try:
            page_content = await page.text_content('body', timeout=5000)
            if page_content:
                page_content = page_content.lower()

                for key, keywords in capability_keywords.items():
                    capabilities[key] = any(kw.lower() in page_content for kw in keywords)

        except Exception as e:
            print(f"  [WARNING]  Error extracting capabilities: {e}")

        return capabilities

    async def _extract_visual_indicators(self, page: Page) -> Dict:
        """Extract visual/professional indicators"""
        indicators = {
            'has_logo': False,
            'has_contact_form': False,
            'has_testimonials': False,
            'has_case_studies': False,
            'has_news_section': False,
            'has_gallery': False,
            'has_social_media': False
        }

        try:
            # Check for logo
            indicators['has_logo'] = await page.locator('img[alt*="logo"], [class*="logo"] img').count() > 0

            # Check for contact form
            indicators['has_contact_form'] = await page.locator('form[action*="contact"], form[class*="contact"]').count() > 0

            # Check for testimonials
            indicators['has_testimonials'] = await page.locator('[class*="testimonial"], [class*="review"]').count() > 0

            # Check for case studies/portfolio
            indicators['has_case_studies'] = await page.locator('[class*="case-study"], [class*="portfolio"], [class*="project"]').count() > 0

            # Check for news section
            indicators['has_news_section'] = await page.locator('[class*="news"], [class*="blog"], [class*="press"]').count() > 0

            # Check for gallery
            indicators['has_gallery'] = await page.locator('[class*="gallery"], [class*="images"]').count() > 0

            # Check for social media
            indicators['has_social_media'] = await page.locator('a[href*="linkedin"], a[href*="facebook"], a[href*="twitter"]').count() > 0

        except Exception as e:
            print(f"  [WARNING]  Error extracting visual indicators: {e}")

        return indicators

    async def _extract_about_info(self, page: Page) -> Dict:
        """Extract 'About' section information"""
        about = {
            'description': None,
            'founded_year': None,
            'team_size': None
        }

        try:
            # Look for about section
            about_selectors = ['[class*="about"]', '[id*="about"]', 'section:has-text("About")']

            for selector in about_selectors:
                try:
                    text = await page.locator(selector).first.text_content(timeout=2000)
                    if text and len(text) > 50:
                        about['description'] = text.strip()[:500]  # Limit to 500 chars

                        # Extract founded year
                        year_match = re.search(r'(19|20)\d{2}', text)
                        if year_match:
                            about['founded_year'] = int(year_match.group(0))

                        break
                except:
                    continue

        except Exception as e:
            print(f"  [WARNING]  Error extracting about info: {e}")

        return about

    async def _extract_products_services(self, page: Page) -> List[str]:
        """Extract products/services offered"""
        products = []

        try:
            # Look for products/services sections
            selectors = [
                '[class*="product"]',
                '[class*="service"]',
                '[id*="product"]',
                '[id*="service"]'
            ]

            for selector in selectors:
                try:
                    elements = await page.locator(selector).all()
                    for elem in elements[:10]:  # Limit to 10
                        text = await elem.text_content()
                        if text and len(text.strip()) > 3:
                            products.append(text.strip()[:100])
                except:
                    continue

        except Exception as e:
            print(f"  [WARNING]  Error extracting products: {e}")

        return list(set(products))[:20]  # Deduplicate and limit

    async def _extract_quality_signals(self, page: Page) -> Dict:
        """Extract quality and trust signals"""
        signals = {
            'has_https': page.url.startswith('https'),
            'has_awards': False,
            'mentions_quality': False,
            'mentions_compliance': False,
            'has_partnerships': False
        }

        try:
            page_content = await page.text_content('body', timeout=5000)
            if page_content:
                page_content = page_content.lower()

                signals['has_awards'] = any(kw in page_content for kw in ['award', 'recognition', 'winner'])
                signals['mentions_quality'] = any(kw in page_content for kw in ['quality', 'excellence', 'premium'])
                signals['mentions_compliance'] = any(kw in page_content for kw in ['compliant', 'compliance', 'certified'])
                signals['has_partnerships'] = any(kw in page_content for kw in ['partner', 'partnership', 'collaboration'])

        except Exception as e:
            print(f"  [WARNING]  Error extracting quality signals: {e}")

        return signals

    async def _extract_freshness_signals(self, page: Page) -> Dict:
        """Extract freshness and recent activity signals"""
        signals = {
            'recent_dates': False,
            'recent_date_count': 0,
            'has_activity_indicators': False,
            'latest_year': None
        }

        try:
            page_content = await page.text_content('body', timeout=5000)

            # Look for recent years (2024, 2025)
            import re
            current_year = 2025
            recent_years = [2024, 2025]

            year_matches = re.findall(r'\b(202[0-5])\b', page_content)
            if year_matches:
                recent_count = sum(1 for year in year_matches if int(year) in recent_years)
                if recent_count > 0:
                    signals['recent_dates'] = True
                    signals['recent_date_count'] = recent_count
                    signals['latest_year'] = max(int(year) for year in year_matches)

            # Look for activity indicators
            activity_keywords = [
                'updated', 'latest', 'recent', 'new', 'current',
                'today', 'this month', 'this year', 'now'
            ]

            if any(kw in page_content.lower() for kw in activity_keywords):
                signals['has_activity_indicators'] = True

        except Exception as e:
            print(f"  [WARNING]  Error extracting freshness signals: {e}")

        return signals

    async def _get_page_content(self, page: Page) -> str:
        """Get full page text content for AI analysis"""
        try:
            content = await page.text_content('body', timeout=5000)
            return content[:5000]  # Limit to 5000 chars
        except:
            return ""

# Singleton instance
playwright_analyzer = PlaywrightAnalyzer()
