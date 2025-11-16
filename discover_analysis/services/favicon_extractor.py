"""
Favicon Extractor - Extract favicon URL from websites
Supports multiple favicon detection methods
"""
import re
from typing import Optional
from urllib.parse import urljoin, urlparse
from playwright.async_api import Page
import asyncio


class FaviconExtractor:
    """
    Extract favicon URL from websites using multiple detection methods
    """

    async def get_favicon_url(self, page: Page, base_url: str) -> Optional[str]:
        """
        Extract favicon URL from a webpage

        Args:
            page: Playwright page object
            base_url: Base URL of the website

        Returns:
            Absolute URL to favicon or None if not found
        """
        favicon_url = None

        try:
            # Method 1: Check for link rel="icon"
            favicon_url = await self._check_link_tag(page, base_url, 'link[rel="icon"]')
            if favicon_url:
                return favicon_url

            # Method 2: Check for link rel="shortcut icon"
            favicon_url = await self._check_link_tag(page, base_url, 'link[rel="shortcut icon"]')
            if favicon_url:
                return favicon_url

            # Method 3: Check for apple-touch-icon
            favicon_url = await self._check_link_tag(page, base_url, 'link[rel="apple-touch-icon"]')
            if favicon_url:
                return favicon_url

            # Method 4: Check for favicon.ico in root
            favicon_url = await self._check_default_favicon(page, base_url)
            if favicon_url:
                return favicon_url

            # Method 5: Check for og:image (fallback)
            favicon_url = await self._check_og_image(page, base_url)
            if favicon_url:
                return favicon_url

        except Exception as e:
            print(f"  [WARNING]  Error extracting favicon: {e}")

        return favicon_url

    async def _check_link_tag(self, page: Page, base_url: str, selector: str) -> Optional[str]:
        """
        Check for favicon in link tag

        Args:
            page: Playwright page
            base_url: Base URL
            selector: CSS selector for link tag

        Returns:
            Absolute favicon URL or None
        """
        try:
            href = await page.get_attribute(selector, 'href', timeout=2000)
            if href:
                # Convert to absolute URL
                absolute_url = urljoin(base_url, href)

                # Verify the URL is accessible
                if await self._verify_url(page, absolute_url):
                    return absolute_url
        except:
            pass

        return None

    async def _check_default_favicon(self, page: Page, base_url: str) -> Optional[str]:
        """
        Check for default favicon.ico in website root

        Args:
            page: Playwright page
            base_url: Base URL

        Returns:
            Absolute favicon URL or None
        """
        try:
            parsed = urlparse(base_url)
            favicon_url = f"{parsed.scheme}://{parsed.netloc}/favicon.ico"

            # Verify the URL is accessible
            if await self._verify_url(page, favicon_url):
                return favicon_url
        except:
            pass

        return None

    async def _check_og_image(self, page: Page, base_url: str) -> Optional[str]:
        """
        Check for Open Graph image as fallback

        Args:
            page: Playwright page
            base_url: Base URL

        Returns:
            Absolute image URL or None
        """
        try:
            content = await page.get_attribute('meta[property="og:image"]', 'content', timeout=2000)
            if content:
                absolute_url = urljoin(base_url, content)

                # Only use if it's a reasonable size (likely a logo, not a banner)
                if await self._verify_url(page, absolute_url):
                    return absolute_url
        except:
            pass

        return None

    async def _verify_url(self, page: Page, url: str) -> bool:
        """
        Verify that a URL is accessible

        Args:
            page: Playwright page
            url: URL to verify

        Returns:
            True if URL is accessible, False otherwise
        """
        try:
            response = await page.request.get(url, timeout=5000)
            return response.status == 200
        except:
            return False

    def get_google_favicon_url(self, domain: str) -> str:
        """
        Get favicon via Google's favicon service (fallback method)
        Uses high resolution (512px) for crisp display at larger sizes

        Args:
            domain: Website domain (e.g., 'example.com')

        Returns:
            Google favicon service URL
        """
        # Clean domain
        if domain.startswith('http'):
            parsed = urlparse(domain)
            domain = parsed.netloc

        return f"https://www.google.com/s2/favicons?domain={domain}&sz=512"

    def get_duckduckgo_favicon_url(self, domain: str) -> str:
        """
        Get favicon via DuckDuckGo's favicon service (alternative fallback)

        Args:
            domain: Website domain (e.g., 'example.com')

        Returns:
            DuckDuckGo favicon service URL
        """
        # Clean domain
        if domain.startswith('http'):
            parsed = urlparse(domain)
            domain = parsed.netloc

        return f"https://icons.duckduckgo.com/ip3/{domain}.ico"


# Singleton instance
favicon_extractor = FaviconExtractor()
