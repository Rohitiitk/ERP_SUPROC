import asyncio
import aiohttp
from openai  import OpenAI
import json
from bs4 import BeautifulSoup
import re
import time
from urllib.parse import urlparse
from threading import Lock, Event
from concurrent.futures import ThreadPoolExecutor, as_completed
import random
import logging
import pyotp
from flask_mail import Message
from flask import current_app
import os
import sys
import requests
from flask_mail import Mail
import pycountry
from typing import Optional  # <-- Python 3.9 compatibility for Optional[T]
from pathlib import Path
from dotenv import load_dotenv

mail = Mail()

# =========================
# === Environment Load  ===
# =========================
# Load env explicitly from project root (../.env) and optional .env.local
ROOT_DIR = Path(__file__).resolve().parents[1]  # project root (one level above /api)
load_dotenv(ROOT_DIR / ".env")
load_dotenv(ROOT_DIR / ".env.local", override=True)

# === NEW: Add these global variables for local LLM ===
LOCAL_API_BASE = os.getenv("LLM_API_BASE")

SAFE_FALLBACK_CHAT_MODEL = "ollama/qwen2.5:0.5b-instruct"
DEFAULT_CHAT_MODEL = os.getenv("DEFAULT_CHAT_MODEL") or SAFE_FALLBACK_CHAT_MODEL
DEFAULT_EMBEDDING_MODEL = os.getenv("DEFAULT_EMBEDDING_MODEL", "ollama/nomic-embed-text")


def _looks_like_embedding_model(model_name: str) -> bool:
    normalized = model_name.lower()
    return any(keyword in normalized for keyword in ("embed", "text-embedding"))


def resolve_chat_model(candidate: Optional[str] = None) -> str:
    """Return a chat-capable model, skipping any embedding-only candidates."""
    ordered_candidates = [candidate, os.getenv("LLM_MODEL"), DEFAULT_CHAT_MODEL, SAFE_FALLBACK_CHAT_MODEL]
    for source in ordered_candidates:
        if not source:
            continue
        chosen = source.strip()
        if not chosen:
            continue
        if _looks_like_embedding_model(chosen):
            logging.warning("Chat model %s appears to be embedding-only; skipping", chosen)
            continue
        return chosen
    logging.warning("No valid chat model configured; defaulting to %s", SAFE_FALLBACK_CHAT_MODEL)
    return SAFE_FALLBACK_CHAT_MODEL


def resolve_embedding_model(candidate: Optional[str] = None) -> str:
    """Resolve the embedding model with sane defaults."""
    chosen = (candidate or os.getenv("EMBEDDING_MODEL") or DEFAULT_EMBEDDING_MODEL).strip()
    if not _looks_like_embedding_model(chosen):
        logging.warning(
            "Embedding model %s does not look like an embedding-targeted model; continuing anyway",
            chosen,
        )
    return chosen


LOCAL_CHAT_MODEL = resolve_chat_model()
LOCAL_EMBEDDING_MODEL = resolve_embedding_model()
# === END NEW CODE ===

# Optional: import local, git-ignored hardcoded secrets if present.
# Create api/app_secrets.py with the variables below to hardcode secrets *safely* without committing them.
# Example (do NOT commit):
#   OPENAI_API_KEY = "sk-...."
#   SERPER_API_KEY = "serper-...."
#   TAVILY_API_KEY = "tvly-...."
try:
    from .app_secrets import (
        OPENAI_API_KEY as _OPENAI_HC,
        SERPER_API_KEY as _SERPER_HC,
        TAVILY_API_KEY as _TAVILY_HC,
    )
except Exception:
    _OPENAI_HC = _SERPER_HC = _TAVILY_HC = None

# =========================
# === Hardcoded fallbacks
# =========================
# Preserve the same hardcoded OpenAI and Tavily fallbacks you already use in app.py
# HARDCODED_OPENAI_API_KEY = "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"
HARDCODED_OPENAI_API_KEY = None
HARDCODED_TAVILY_API_KEY = "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"
# (No hardcoded Serper key value available here; we resolve via env or app_secrets.)
# If you want to hardcode it, put SERPER_API_KEY in api/app_secrets.py or set it in env.

# =========================
# === Key resolvers     ===
# =========================
def resolve_openai_key(passed: Optional[str] = None) -> Optional[str]:
    """
    Priority: passed arg -> env -> app_secrets -> hardcoded fallback
    """
    return passed or os.getenv("OPENAI_API_KEY") or _OPENAI_HC or HARDCODED_OPENAI_API_KEY

def resolve_tavily_key(passed: Optional[str] = None) -> Optional[str]:
    """
    Priority: passed arg -> env -> app_secrets -> hardcoded fallback
    """
    return passed or os.getenv("TAVILY_API_KEY") or _TAVILY_HC or HARDCODED_TAVILY_API_KEY

def resolve_serper_key(passed: Optional[str] = None) -> Optional[str]:
    """
    Priority: passed arg -> env -> app_secrets
    (No hardcoded fallback unless you define one in app_secrets.py)
    """
    return passed or os.getenv("SERPER_API_KEY") or _SERPER_HC

# Try to use Google's libphonenumber if available for better validation/formatting.
try:
    import phonenumbers
    from phonenumbers.phonenumberutil import NumberParseException
except Exception:
    phonenumbers = None  # graceful fallback if not installed

# Complete User-Agent List for Rotation
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 6.1; WOW64; rv:52.0) Gecko/20100101 Firefox/52.0",
    "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:89.0) Gecko/20100101 Firefox/89.0",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 15_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.1 Mobile/15E148 Safari/604.1"
]

# Reasonable network timeouts
_AIOHTTP_TIMEOUT = aiohttp.ClientTimeout(total=10)  # seconds
_REQUESTS_TIMEOUT = 12  # seconds

# Get random user agent
def get_random_user_agent():
    return random.choice(USER_AGENTS)

# -------------------------
# Synchronous HTML fetcher
# -------------------------
def get_html_sync(link: str):
    """
    Synchronous HTML fetch used by QUICK validator to avoid 'coroutine never awaited'
    warnings when running from worker threads. Cleans the DOM similarly to async path.
    """
    headers = {'User-Agent': get_random_user_agent()}
    try:
        r = requests.get(link, headers=headers, timeout=_REQUESTS_TIMEOUT)
        r.raise_for_status()
        bs = BeautifulSoup(r.text, 'html.parser')
        if bs.head:
            bs.head.decompose()
        for script in bs(["script", "style"]):
            script.decompose()
        text = bs.get_text()
        text = re.sub(r'\s+', ' ', text)
        text = re.sub(r'\n+', '\n', text)
        text = text.strip()
        logging.info(f"[SYNC FETCH] OK {link}")
        return bs, text
    except Exception as e:
        logging.error(f"[SYNC FETCH] ERROR {link}: {e}")
        return None, None

# Async HTML fetch function with user-agent rotation
async def get_html_async(link):
    headers = {'User-Agent': get_random_user_agent()}
    async with aiohttp.ClientSession(headers=headers, timeout=_AIOHTTP_TIMEOUT) as session:
        try:
            async with session.get(link) as response:
                text = await response.text()
                bs = BeautifulSoup(text, 'html.parser')
                if bs.head:
                    bs.head.decompose()
                for script in bs(["script", "style"]):
                    script.decompose()
                text = bs.get_text()
                text = re.sub(r'\s+', ' ', text)
                text = re.sub(r'\n+', '\n', text)
                text = text.strip()
                logging.info(f"[ASYNC FETCH] OK {link}")
                return bs, text
        except Exception as e:
            logging.error(f"[ASYNC FETCH] ERROR {link}: {e}")
            return None, None

# ===== NEW: Shared-session async fetching (reduces overhead) =====
async def _fetch_single_with_session(session: aiohttp.ClientSession, link: str):
    try:
        async with session.get(link) as response:
            text = await response.text()
            bs = BeautifulSoup(text, 'html.parser')
            if bs.head:
                bs.head.decompose()
            for script in bs(["script", "style"]):
                script.decompose()
            text = bs.get_text()
            text = re.sub(r'\s+', ' ', text)
            text = re.sub(r'\n+', '\n', text)
            text = text.strip()
            logging.info(f"[ASYNC SHARED] OK {link}")
            return link, bs, text
    except Exception as e:
        logging.error(f"[ASYNC SHARED] ERROR {link}: {e}")
        return link, None, None

async def fetch_all_html_async_shared(links):
    headers = {'User-Agent': get_random_user_agent()}
    async with aiohttp.ClientSession(headers=headers, timeout=_AIOHTTP_TIMEOUT) as session:
        tasks = [_fetch_single_with_session(session, link) for link in links]
        return await asyncio.gather(*tasks)

def prefetch_html_texts(links):
    """
    Prefetch HTML texts for a list of links using a single aiohttp session.
    Returns: dict[str, str] mapping link -> website_text (cleaned). Missing/failed -> not included.
    """
    try:
        results = asyncio.run(fetch_all_html_async_shared(links))
        texts = {}
        for link, _bs, text in results:
            if text:
                texts[link] = text
        return texts
    except Exception as e:
        logging.error(f"Prefetch error: {e}")
        return {}

# Fetch all HTML async
async def fetch_all_html_async(links):
    tasks = [get_html_async(link) for link in links]
    results = await asyncio.gather(*tasks)
    return results

# Run async tasks (kept for completeness; not used by quick validator anymore)
def run_async_tasks(links):
    return asyncio.run(fetch_all_html_async(links))

# Search function to get supplier links (Serper)
def search(query, pages, location, serper_api_key):
    resolved_serper = resolve_serper_key(serper_api_key)
    if not resolved_serper:
        logging.error("SERPER_API_KEY missing. Cannot perform quick search.")
        return []

    links = []
    for page in range(0, pages):
        base_url = "https://google.serper.dev/search"
        payload = json.dumps({
            "q": f"{query} supplier in {location} -cart -basket -marketplace -directory -b2b",
            "num": 40,
            "page": page,
            "location": location
        })
        headers = {
            'X-API-KEY': resolved_serper,
            'Content-Type': 'application/json'
        }
        try:
            response = requests.request("POST", base_url, headers=headers, data=payload, timeout=_REQUESTS_TIMEOUT)
        except Exception as e:
            logging.error(f"Serper request error: {e}")
            continue
        if response.status_code == 200:
            jsonResponse = response.json()
            for item in jsonResponse.get("organic", []):
                if "link" in item:
                    links.append(item["link"].split('```')[0])  # Remove any trailing ``` from the URL
        else:
            logging.error(f"Error fetching search results: {response.status_code}")
    return links

# Function to remove repeating links
def remove_repeating_links(validated_links):
    seen_domains = set()
    unique_links = []

    for link, contact_details in validated_links:
        domain = urlparse(link).netloc
        if domain not in seen_domains:
            seen_domains.add(domain)
            unique_links.append((link, contact_details))

    return unique_links

# Function to exclude B2B websites
def exclude_b2b_websites(urls):
    exclude_domains = [
        "alibaba", "indiamart", "amazon", "made-in-china", "globalsources",
        "tradeindia", "ec21", "dhgate", "tradeeasy", "exportersindia",
        "ecplaza", "exporthub", "globalsources", "indiaMART", "indiamart",
        "ekart", "amazon", "walmart", "eBay", "shopify", "bigcommerce",
        "woocommerce", "etsy", "overstock", "newegg", "aliexpress",
        "tradekey", "tradeboss", "hktdc", "kompass", "yellowpages",
        "zoominfo", "yellowbook", "yell", "made-in-india", "manufacturers",
        "sourcingguides", "globaltrade", "business.com", "connect.in",
        "exporters.sg", "exporters.eu", "supplierdirectory", "businessdirectory",
        "b2bmarketplace", "businessexchange", "globalb2b", "b2bcentral",
        "industrialb2b", "b2bfinders", "b2bconnect", "b2bworld", "businessnetwork",
        "tradedirect", "bizb2b", "supplychainb2b", "b2bsourcing", "b2bsupplier",
        "b2bsupplierdirectory", "b2bsuppliers", "b2bmanufacturers",
        "b2btraders", "b2bwholesale", "b2bexporters", "b2bimporters",
        "b2bproducts", "b2bservices", "b2bmarket", "b2bsearch", "b2bgateway",
        "b2bhub", "b2bplatform", "b2bshop", "b2bdirectory", "b2bonline",
        "b2bportal", "b2bconnectors", "b2bcommerce", "b2bnetwork", "b2bworldwide",
        "b2bzone", "b2bcentral", "b2binternational", "b2bmarketplace",
        "b2bsales", "b2bsupplies", "b2bsupplierhub", "b2btrading",
        "b2bproductsupply", "b2bvendor", "b2bsupplychain", "b2bconnectors",
        "b2bwholesaler", "b2bexporthub", "b2bimporthub", "accio", "pinterest", "bbc", "cnn", "magicpin", "swiggy", "zomato", "bigbazzar", 
        "suppliers.com", "supplier.com", "supplierhub.com", "talabat", "248am", "linkedin", "reddit", "facebook", "wikipedia", "forbes", "fairwild"
    ]

    filtered_urls = [url for url in urls if not any(domain.lower() in url.lower() for domain in exclude_domains)]
    filtered_urls = [url for url in filtered_urls if not any(word in url.lower() for word in ["list", "data", "dictionary", "word", "aspx", "pdf", "txt", "doc", "xls", "video", "image"])]
    return filtered_urls

# ===== NEW: quick regex-based contact extraction (fallback before LLM) =====
EMAIL_REGEX = re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.IGNORECASE)

# Broader phone regex to capture international, spaces, dots, dashes, parentheses, and '00' intl prefix.
PHONE_REGEX = re.compile(
    r"(?:\+|00)?\s?(?:\d[\s().-]?){6,15}\d",
    re.IGNORECASE
)
# Href tel: extractor
TEL_HREF_REGEX = re.compile(r'href=[\'"]tel:([^\'"]+)[\'"]', re.IGNORECASE)

FAX_NEAR_REGEX = re.compile(r"fax", re.IGNORECASE)
PHONE_KEYWORDS = re.compile(r"(phone|tel|telephone|contact|call|office|hq|switchboard)", re.IGNORECASE)

def _digits_only(s: str) -> str:
    return "".join(ch for ch in s if ch.isdigit())

def _normalize_00_to_plus(s: str) -> str:
    s = s.strip()
    if s.startswith("00"):
        return "+" + s[2:]
    return s

def _clean_visible_number(raw: str) -> str:
    # Keep + and digits and common separators/parentheses; normalize multiple spaces
    cleaned = re.sub(r"[^0-9+\s().-]", "", raw)
    cleaned = _normalize_00_to_plus(cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned

def extract_emails(html_text: str) -> list:
    if not html_text:
        return []
    emails = EMAIL_REGEX.findall(html_text)
    # Deduplicate preserving order
    seen = set()
    out = []
    for e in emails:
        e_l = e.lower()
        if e_l not in seen:
            seen.add(e_l)
            out.append(e)
    return out

def extract_candidate_phones(html_text: str) -> list:
    """
    Return a list of dicts: [{"raw": "...", "clean": "...", "context": "...", "score": int}, ...]
    Scoring: prefer tel: links, numbers near phone keywords; downrank fax; prefer longer numbers and with country codes.
    """
    if not html_text:
        return []

    text = html_text
    candidates = []

    # Collect tel: links
    for m in TEL_HREF_REGEX.finditer(text):
        raw = m.group(1)
        clean = _clean_visible_number(raw)
        if clean:
            start = max(0, m.start() - 80)
            end = min(len(text), m.end() + 80)
            ctx = text[start:end]
            candidates.append({"raw": raw, "clean": clean, "context": ctx, "score": 5})

    # Collect general visible patterns
    for m in PHONE_REGEX.finditer(text):
        raw = m.group(0)
        clean = _clean_visible_number(raw)
        if not clean:
            continue
        start = max(0, m.start() - 50)
        end = min(len(text), m.end() + 50)
        ctx = text[start:end]

        score = 0
        if PHONE_KEYWORDS.search(ctx):
            score += 3
        if FAX_NEAR_REGEX.search(ctx):
            score -= 4
        digits = len(_digits_only(clean))
        if digits >= 10:
            score += 1
        if clean.startswith("+"):
            score += 1

        candidates.append({"raw": raw, "clean": clean, "context": ctx, "score": score})

    # Merge near-duplicates by digit equivalence
    buckets = {}
    for c in candidates:
        key = _digits_only(c["clean"])
        if not key:
            continue
        if key not in buckets or c["score"] > buckets[key]["score"]:
            buckets[key] = c

    # Return sorted by score desc
    deduped = list(buckets.values())
    deduped.sort(key=lambda x: x["score"], reverse=True)
    return deduped

def _guess_region_alpha2(region: str) -> Optional[str]:
    try:
        if not region:
            return None
        matches = pycountry.countries.search_fuzzy(region)
        if matches:
            return matches[0].alpha_2
    except Exception:
        return None
    return None

def _format_with_phonenumbers(number: str, region_alpha2: Optional[str]) -> Optional[str]:
    if phonenumbers is None:
        return None
    try:
        # For parsing, remove (0) optional trunk; lib can mis-parse otherwise.
        to_parse = number.replace("(0)", "").replace(" ", "")
        parsed = phonenumbers.parse(to_parse, region_alpha2 if region_alpha2 else None)
        if not phonenumbers.is_possible_number(parsed) or not phonenumbers.is_valid_number(parsed):
            return None
        return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.INTERNATIONAL)
    except NumberParseException:
        return None
    except Exception:
        return None

def _needs_llm_selection(cands: list) -> bool:
    # Trigger LLM if multiple plausible options or the best one looks incomplete (<9 digits)
    if len(cands) == 0:
        return False
    if len(cands) > 1:
        return True
    best = cands[0]
    if len(_digits_only(best["clean"])) < 9:
        return True
    return False

def _select_phone_via_llm(candidates: list, url: str, region: str, openai_api_key: str) -> str:
    """
    Ask OpenAI to pick the primary business phone number using context and return only the number.
    """
    try:
        # openai.api_key = resolve_openai_key(openai_api_key)
        # openai.api_base = LOCAL_API_BASE
        # openai.api_key = "ollama" # Dummy key

        client = OpenAI(api_key="ollama",base_url=LOCAL_API_BASE)
        
        model_to_use = LOCAL_CHAT_MODEL
        shortlist = candidates[:6]  # cap to keep prompt small
        items = []
        for i, c in enumerate(shortlist, 1):
            ctx = " ".join(c["context"].split())[:220]
            items.append(f"{i}. {c['clean']}  | context: {ctx}")
        joined = "\n".join(items)

        prompt = f"""
You are validating contact phones on a supplier website.

Task:
- From the list below, choose the MAIN business phone number for the company.
- Prefer numbers labeled Phone/Tel/Contact/Office/HQ; avoid Fax/WhatsApp unless it's the only option.
- Prefer the most complete version (with country code). If the country is clear, fix missing '00' vs '+' and keep the full number.
- Use cues from the text, page language, addresses, the region '{region}', and the domain '{url}'.
- Return ONLY the chosen number as written (or an improved international format), no extra words.

Candidates:
{joined}
"""
        client= OpenAI(api_key="ollama",base_url=LOCAL_API_BASE)
        model_to_use = LOCAL_CHAT_MODEL
        resp = client.chat.completions.create(
            model=model_to_use,
            messages=[
                {"role": "system", "content": "You are a careful data extractor for procurement. Return only the phone number."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,
            max_tokens=50
        )
        out = (resp.choices[0].message.content or "").strip()
        # Clean small artifacts and normalize 00→+
        out = _clean_visible_number(out)
        return out
    except Exception as e:
        logging.error(f"LLM phone selection error: {e}")
        return ""

def extract_contacts_fast(html_text: str) -> str:
    """
    Fast heuristic extraction for email/phone to avoid an extra LLM call when possible.
    Returns a formatted string like:
      'Email: someone@example.com\nPhone: +1 555 123 4567'
    or '' if nothing found.
    """
    if not html_text:
        return ""
    emails = extract_emails(html_text)
    phones = extract_candidate_phones(html_text)
    email_val = emails[0] if emails else ""
    phone_val = phones[0]["clean"] if phones else ""
    if not email_val and not phone_val:
        return ""
    out = []
    if email_val:
        out.append(f"Email: {email_val}")
    if phone_val:
        out.append(f"Phone: {phone_val}")
    return "\n".join(out)

def get_contact_details_smart(html_text: str, url: str, region: str, openai_api_key: str) -> str:
    """
    Robust contact extractor:
      1) Gather all candidate phones (incl. tel: links) + emails
      2) Score/normalize, de-duplicate
      3) If multiple/ambiguous or short/truncated → verify with OpenAI to pick the correct one
      4) Validate/format with libphonenumbers when available
      5) Return "Email: ...\nPhone: ..." (or empty if none)
    """
    if not html_text:
        return ""

    emails = extract_emails(html_text)
    candidates = extract_candidate_phones(html_text)
    region_alpha2 = _guess_region_alpha2(region)

    chosen_phone = ""
    if not candidates:
        chosen_phone = ""
    else:
        if _needs_llm_selection(candidates):
            chosen_phone = _select_phone_via_llm(candidates, url, region, openai_api_key)
            if not chosen_phone:
                # Fallback to best-scored candidate
                chosen_phone = candidates[0]["clean"]
        else:
            chosen_phone = candidates[0]["clean"]

    # Normalize 00→+ and try formatting with libphonenumbers
    if chosen_phone:
        formatted = _format_with_phonenumbers(chosen_phone, region_alpha2)
        # If lib returns a good international format, prefer it; else keep the site's original (cleaned)
        if formatted:
            # Preserve (0) if the source had it and it seems to be the same base number
            src_digits = _digits_only(chosen_phone)
            fmt_digits = _digits_only(formatted)
            if src_digits and fmt_digits and src_digits.endswith(fmt_digits[-8:]):
                # Keep the more detailed/verbose form if it includes (0)
                if "(0)" in chosen_phone and not "(0)" in formatted:
                    chosen_phone = chosen_phone
                else:
                    chosen_phone = formatted
            else:
                chosen_phone = formatted

    # Package result
    parts = []
    if emails:
        parts.append(f"Email: {emails[0]}")
    if chosen_phone:
        parts.append(f"Phone: {chosen_phone}")

    return "\n".join(parts).strip()

# Function to validate links using OpenAI (QUICK path now uses SYNC fetch)
def validate_link(link, product_name, region, openai_api_key):
    tick = time.time()
    logging.info(f"[QUICK VALIDATE] fetching {link}")
    _bs, website_text = get_html_sync(link)
    if website_text is None:
        logging.info(f"REJECTED: {link} - Unable to fetch content (sync)")
        return None

    tock = time.time()
    logging.info(f"FETCHED HTML OF {link} IN {tock - tick:.2f} SECONDS")

    # Truncate to reduce LLM latency (keeps enough signal)
    truncated = (website_text or "")[:3500]

    prompt = f"""
    You are an expert at evaluating website content and you are an expert analyst. Your task is to determine if the website is exclusively about suppliers for the following product: {product_name} in {region}.

    Instructions:
    1. Analyze the HTML content provided.
    2. Identify if the HTML content is focused on supplying {product_name}.
    3. Exclude blogs, insights, intelligence, reports, analysis, news, and social media websites.
    4. Exclude websites if they sell small quantities that means they are not suppliers.

    HTML content:
    {truncated}

    Return format:
    - If the website is about suppliers, return: link: {link}
    - If not, return: link: None
    """

    try:
        # openai.api_key = resolve_openai_key(openai_api_key)

        client= OpenAI(api_key="ollama",base_url=LOCAL_API_BASE)
        model_to_use = LOCAL_CHAT_MODEL
        response = client.chat.completions.create(
            model=model_to_use,
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": prompt}
            ]
        )
        tock = time.time()

        response_content = response.choices[0].message.content.strip()
        logging.info(f"RAW RESPONSE FOR {link}: {response_content}")

        if "link: None" in response_content:
            logging.info(f"REJECTED: {link} IN {tock - tick:.2f} SECONDS - {response_content}")
            return None
        elif "link:" in response_content:
            result = response_content.split("link:")[1].strip()
            logging.info(f"ACCEPTED: {link} IN {tock - tick:.2f} SECONDS")
            # Smart contacts (regex + optional LLM validation + libphonenumber)
            contact_details = get_contact_details_smart(website_text, link, region, openai_api_key)
            return result, contact_details
        else:
            logging.info(f"REJECTED: {link} IN {tock - tick:.2f} SECONDS - Invalid response format: {response_content}")
            return None, None

    except Exception as e:
        logging.error(f"UNEXPECTED ERROR FOR LINK {link}: {e}")
        return None, None

# ===== NEW: Validate link from pre-fetched text (no extra HTTP per link) =====
def validate_link_from_text(link: str, product_name: str, region: str, website_text: str, openai_api_key: str):
    tick = time.time()
    if not website_text:
        logging.info(f"REJECTED: {link} - No pre-fetched content")
        return None

    # Truncate to reduce LLM latency while keeping enough signal
    truncated = website_text[:3500]

    prompt = f"""
    You are an expert at evaluating website content and you are an expert analyst. Your task is to determine if the website is exclusively about suppliers for the following product: {product_name} in {region}.

    Instructions:
    1. Analyze the HTML content provided.
    2. Identify if the HTML content is focused on supplying {product_name}.
    3. Exclude blogs, insights, intelligence, reports, analysis, news, and social media websites.
    4. Exclude websites if they sell small quantities that means they are not suppliers.

    HTML content:
    {truncated}

    Return format:
    - If the website is about suppliers, return: link: {link}
    - If not, return: link: None
    """

    try:
        # openai.api_key = resolve_openai_key(openai_api_key)

        client= OpenAI(api_key="ollama",base_url=LOCAL_API_BASE)
        model_to_use = LOCAL_CHAT_MODEL
        response = client.chat.completions.create(
            model=model_to_use,
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2
        )

        response_content = response.choices[0].message.content.strip()
        if "link: None" in response_content:
            logging.info(f"REJECTED (prefetched): {link}")
            return None
        elif "link:" in response_content:
            result = response_content.split("link:")[1].strip()
            # Smart contacts (regex + optional LLM validation + libphonenumber)
            contact_details = get_contact_details_smart(website_text, link, region, openai_api_key)
            return result, contact_details
        else:
            logging.info(f"REJECTED (prefetched): {link} — invalid response format")
            return None, None
    except Exception as e:
        logging.error(f"UNEXPECTED ERROR (prefetched) FOR LINK {link}: {e}")
        return None, None

# (Kept for compatibility if referenced elsewhere)
def get_contact_details(html_content, openai_api_key):
    """
    Legacy minimal LLM extractor. Prefer get_contact_details_smart() which verifies phone numbers.
    """
    prompt = f"""
    You are an expert at getting contact details from HTML content. Analyse the HTML content, specifically understand if you find any contact information like email and phone numbers, add it to the output in the format where email will go in the email field and contact or phone number will go in the phone field:

    Email: [email address]
    Phone: [phone number]

    HTML content:
    {html_content}

    DO NOT ADD ANY OTHER INFORMATION OTHER THAN THE CONTACT DETAILS THAT IS ONLY THE EMAIL AND PHONE NUMBER, IF THERE IS NO CONTACT DETAILS, RETURN AN EMPTY STRING.
    """

    try:
        # openai.api_key = resolve_openai_key(openai_api_key)
        client= OpenAI(api_key="ollama",base_url=LOCAL_API_BASE)
        model_to_use = LOCAL_CHAT_MODEL
        response = client.chat.completions.create(
            model=model_to_use,
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": prompt}
            ]
        )
        contact_details = response.choices[0].message.content.strip()
        return contact_details
    except Exception as e:
        logging.error(f"Error getting contact details: {e}")
        return ""

# ===== FIXED: Do not wait for all threads when we reach the target; cancel remaining =====
def run_threads_and_async(validate_link_func, links, validated_links, product_name, region, openai_api_key, max_workers: int = None):
    lock = Lock()
    stop_event = Event()

    if max_workers is None:
        max_workers = min(32, max(4, len(links) or 1))

    def worker(link):
        if stop_event.is_set():
            return None
        result = validate_link_func(link, product_name, region, openai_api_key)
        if result:
            with lock:
                validated_links.append(result)
                if len(validated_links) >= 15:  # Stop after collecting enough valid links
                    stop_event.set()
        return result

    executor = ThreadPoolExecutor(max_workers=max_workers)
    futures = [executor.submit(worker, link) for link in links]

    try:
        for future in as_completed(futures):
            if stop_event.is_set():
                break
            future.result()
    except Exception as e:
        logging.error(f"Exception in worker thread: {e}")
    finally:
        # Cancel anything not yet started and don't wait for running ones
        for f in futures:
            if not f.done():
                f.cancel()
        try:
            executor.shutdown(wait=False, cancel_futures=True)
        except TypeError:
            # For Python versions without cancel_futures, fall back:
            executor.shutdown(wait=False)

# Function to get top producing countries using OpenAI
def get_top_producing_countries(product_name, openai_api_key):
    """
    Returns a list of top 5 producing countries for the given product,
    each with name, ISO code, and a flag URL.
    Falls back cleanly if GPT output is irregular.
    """
    prompt = (
        f"List the top 5 countries producing “{product_name}”.\n"
        "Return **only** the country names, one per line, no extra text."
    )

    try:
        # openai.api_key = resolve_openai_key(openai_api_key)

        client= OpenAI(api_key="ollama",base_url=LOCAL_API_BASE)
        model_to_use = LOCAL_CHAT_MODEL
        resp = client.chat.completions.create(
            model=model_to_use ,
            messages=[
                {"role": "system",  "content": "You are a helpful assistant."},
                {"role": "user",    "content": prompt}
            ],
            temperature=0.2,
            max_tokens=100
        )
        content = resp.choices[0].message.content.strip()

        # Split into lines, strip bullets/numbers
        lines = [
            line.strip().lstrip("-–—0123456789. ")
            for line in content.splitlines()
            if line.strip()
        ][:5]  # take first 5

        result = []
        for name in lines:
            try:
                # fuzzy-match with pycountry
                country = pycountry.countries.search_fuzzy(name)[0]
                code = country.alpha_2.lower()
            except Exception:
                code = ""

            flag = f"https://flagcdn.com/w20/{code}.png" if code else ""
            result.append({
                "name": name,
                "code": code,
                "flag": flag
            })

        return result

    except Exception as e:
        logging.error(f"Error getting top producing countries: {e}")
        return []

# Function to extract company name from URL
def extract_company_name(url):
    parsed_url = urlparse(url)
    domain_parts = parsed_url.netloc.split('.')
    if 'www' in domain_parts:
        domain_parts.remove('www')
    company_name = domain_parts[0].capitalize()
    return company_name

# ===== UPDATED: Main search function for suppliers (Serper/legacy) — stays fast; no prefetch =====
def search_suppliers(product_name, region, serper_api_key, openai_api_key):
    log_filename = setup_logging(product_name, region)
    start_time = time.time()

    resolved_serper = resolve_serper_key(serper_api_key)
    if not resolved_serper:
        logging.error("SERPER_API_KEY missing. Quick search cannot proceed.")
        return []

    links = search(product_name, 1, region, resolved_serper)
    logging.info("==============================================================================================")
    logging.info(f"{len(links)} LINKS FOUND FOR '{product_name.upper()}' IN '{region.upper()}'")
    logging.info("==============================================================================================")
    for link in links:
        logging.info(str(link))
    logging.info("==============================================================================================")

    filtered_links = exclude_b2b_websites(links)
    logging.info("==============================================================================================")
    logging.info(f"{len(filtered_links)} LINKS FOUND FOR '{product_name}' IN '{region}' AFTER B2B FILTERING")
    logging.info("==============================================================================================")
    for link in filtered_links:
        logging.info(str(link))

    # IMPORTANT: Do NOT prefetch here. Validate per-link and stop early at 10 to keep quick mode fast.
    validated_links = []
    run_threads_and_async(
        validate_link,
        filtered_links,
        validated_links,
        product_name,
        region,
        resolve_openai_key(openai_api_key)
    )

    validated_links = remove_repeating_links(validated_links)

    end_time = time.time()

    result_list = []
    for url, contact_details in validated_links:
        if url is None or "None **Reason:**" in url:
            continue
        company_name = extract_company_name(url)

        # Clean up contact details
        contact_details_clean = (contact_details or "").replace('```', '').strip()
        email = ""
        phone = ""
        if "Email:" in contact_details_clean:
            email_part = contact_details_clean.split('Email:')[1]
            if "Phone:" in email_part:
                email = email_part.split('Phone:')[0].strip()
            else:
                email = email_part.strip()
        if "Phone:" in contact_details_clean:
            phone = contact_details_clean.split('Phone:')[1].strip()

        result_list.append({
            "name": company_name,
            "url": url,
            "email": email,
            "phone": phone
        })

    elapsed_time = end_time - start_time
    elapsed_time_str = f"{elapsed_time:.2f} seconds"

    logging.info("==============================================================================================")
    logging.info(f"TOTAL TIME TAKEN: {elapsed_time_str}")
    logging.info("==============================================================================================")
    logging.info(f"{len(validated_links)} VALIDATED FOR '{product_name}' IN '{region}'")
    logging.info("==============================================================================================")
    for link, _ in validated_links:
        logging.info(str(link))
    logging.info("==============================================================================================")

    return result_list  # Return the list of suppliers

# Logging setup function (to both file and stdout for Azure log tail)
def setup_logging(product_name, region):
    log_time = time.strftime('%Y-%m-%d-%H-%M-%S')
    log_filename = f"logs/{product_name}-{region}-{log_time}.log"

    if not os.path.exists("logs"):
        os.makedirs("logs")

    root = logging.getLogger()
    # Clear existing handlers to avoid duplicate lines across requests
    for h in list(root.handlers):
        root.removeHandler(h)

    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]',
        handlers=[
            logging.FileHandler(log_filename),
            logging.StreamHandler(sys.stdout)  # ensure visibility in `az webapp log tail`
        ]
    )

    return log_filename

# Function to search product components
def search_product_components(product_name, serper_api_key):
    resolved_serper = resolve_serper_key(serper_api_key)
    if not resolved_serper:
        logging.error("SERPER_API_KEY missing for components search.")
        return []

    url = "https://google.serper.dev/search"
    headers = {"X-API-KEY": resolved_serper, "Content-Type": "application/json"}
    payload = {"q": f"{product_name} components list"}
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=_REQUESTS_TIMEOUT)
    except Exception as e:
        logging.error(f"Error fetching product components for {product_name}: {e}")
        return []
    if response.status_code == 200:
        search_results = response.json()
        return search_results.get('organic', [])[:3]
    else:
        logging.error(f"Error fetching product components for {product_name}: {response.status_code}")
        return []

# Function to get AI suggestions for components
def get_gpt_suggestions(main_product, openai_api_key, serper_api_key):
    search_results = search_product_components(main_product, serper_api_key)
    if not search_results:
        return ["No relevant search results found. Please check your product name."]
    try:
        # openai.api_key = resolve_openai_key(openai_api_key)

        client= OpenAI(api_key="ollama",base_url=LOCAL_API_BASE)
        model_to_use = LOCAL_CHAT_MODEL
        response = client.chat.completions.create(
            model=model_to_use,
            messages=[
                {"role": "system", "content": "You are an assistant. Only list the components needed to build the product. Do not add any introductory or closing sentences."},
                {"role": "user", "content": f"Provide a list of components needed to build a {main_product} based on these search results: {search_results}."}
            ],
            max_tokens=150
        )
        suggestions = response['choices'][0]['message']['content'].strip()
        components = [line.replace('**', '').strip() for line in suggestions.split('\n') if line.strip()]
        return components if components else ["No components found. Please check your product name."]
    except Exception as e:
        logging.error(f"Error getting GPT suggestions: {e}")
        return [f"Error: {str(e)}"]


# ============================
# === TAVILY INTEGRATION  ===
# ============================
# Compat import for different tavily-python versions:
# - Newer: from tavily import TavilyClient
# - Older: from tavily import Client  (alias to TavilyClient)
try:
    from tavily import TavilyClient  # modern
except Exception:
    try:
        from tavily import Client as TavilyClient  # backwards-compat
    except Exception:
        TavilyClient = None

def tavily_search_links(product_name: str, region: str, tavily_api_key: str, depth: str = "basic", max_results: int = 25) -> list:
    """
    Use Tavily Search API to get candidate supplier URLs.
    We filter B2B/social domains locally using exclude_b2b_websites().
    """
    # Resolve key: arg > env/app_secrets > hardcoded
    resolved_key = resolve_tavily_key(tavily_api_key)
    links = []

    if TavilyClient is None:
        logging.warning("Tavily client not available (package import failed). Falling back to Serper.")
        fallback_serper = resolve_serper_key(None)
        return search(product_name, 1, region, fallback_serper) if fallback_serper else []

    if not resolved_key:
        logging.warning("Tavily API key missing. Falling back to Serper.")
        fallback_serper = resolve_serper_key(None)
        return search(product_name, 1, region, fallback_serper) if fallback_serper else []

    try:
        # Per SDK: instantiate with keyword and set manual params explicitly.
        client = TavilyClient(api_key=resolved_key)
        q = f"bulk suppliers OR wholesale suppliers of {product_name} in {region}"
        logging.info(f"Tavily: search_depth={depth} max_results={max_results}")
        res = client.search(
            query=q,
            search_depth=depth,          # "basic" (1 credit) or "advanced" (2 credits)
            max_results=max_results,     # must be set explicitly
            include_answer=False,        # keep small response; not needed for our pipeline
            include_raw_content=False,   # not needed; we fetch pages ourselves
            include_images=False,
            auto_parameters=True,
            topic="general",
            days=365                      # keep broad window
        )
        for item in res.get("results", []):
            url = item.get("url")
            if url:
                links.append(url)

        if not links:
            logging.warning("Tavily returned 0 links; falling back to Serper for this query.")
            fallback_serper = resolve_serper_key(None)
            return search(product_name, 1, region, fallback_serper) if fallback_serper else []

        logging.info(f"Tavily returned {len(links)} links before local filtering.")
    except Exception as e:
        logging.error(f"Tavily search error: {e}. Falling back to Serper.")
        fallback_serper = resolve_serper_key(None)
        return search(product_name, 1, region, fallback_serper) if fallback_serper else []

    return links

# ===== FIXED: early-stop + explicit shutdown =====
def run_threads_and_async_with_limit(validate_link_func, links, validated_links, product_name, region, openai_api_key, limit: int = 20, prefetched_texts: dict = None, max_workers: int = None):
    """
    Same as run_threads_and_async, but with configurable validated limit.
    Optionally uses pre-fetched texts to avoid per-link HTTP requests.
    """

    lock = Lock()
    stop_event = Event()

    # Default max_workers tuned for I/O-bound work
    if max_workers is None:
        max_workers = min(32, max(4, len(links) or 1))

    def worker(link):
        if stop_event.is_set():
            return None
        # Prefer pre-fetched text if provided
        if prefetched_texts is not None and link in prefetched_texts:
            result = validate_link_from_text(link, product_name, region, prefetched_texts.get(link, ""), openai_api_key)
        else:
            result = validate_link_func(link, product_name, region, openai_api_key)
        if result:
            with lock:
                validated_links.append(result)
                if len(validated_links) >= limit:
                    stop_event.set()
        return result

    executor = ThreadPoolExecutor(max_workers=max_workers)
    futures = [executor.submit(worker, link) for link in links]

    try:
        for future in as_completed(futures):
            if stop_event.is_set():
                break
            future.result()
    except Exception as e:
        logging.error(f"Exception in worker thread: {e}")
    finally:
        for f in futures:
            if not f.done():
                f.cancel()
        try:
            executor.shutdown(wait=False, cancel_futures=True)
        except TypeError:
            executor.shutdown(wait=False)

def _truncate_to_two_sentences(text: str) -> str:
    """
    Post-process helper to ensure max 1–2 sentences, professional tone.
    """
    if not text:
        return ""
    # Normalize whitespace
    text = " ".join(text.strip().split())
    sentences = re.split(r'(?<=[.!?])\s+', text)
    trimmed = " ".join(sentences[:2]).strip()
    return trimmed

def summarise_supplier(product_name: str, region: str, url: str, website_text: str, openai_api_key: str) -> str:
    """
    Produce a concise 1-2 sentence summary describing why this page is a relevant supplier
    for the given product/location. Keep it professional and to the main point.
    """
    try:
        # openai.api_key = resolve_openai_key(openai_api_key)
        client= OpenAI(api_key="ollama",base_url=LOCAL_API_BASE)
        model_to_use = LOCAL_CHAT_MODEL 
        prompt = f"""Write a concise professional summary (1 sentence, max 2) explaining the key reason this page is a relevant bulk supplier for '{product_name}' in '{region}'. Focus on the primary capability, product fit, or scale; avoid fluff or marketing language.

URL: {url}

Page text (truncated):
{(website_text or '')[:2500]}
"""
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a procurement assistant. Be concise and specific."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
        )
        raw = (resp.choices[0].message.content or "").strip()
        return _truncate_to_two_sentences(raw)
    except Exception as e:
        logging.error(f"Summary generation error for {url}: {e}")
        return ""

def search_suppliers_v2(product_name: str, region: str, serper_api_key: str, openai_api_key: str,
                        tavily_api_key: str = None, mode: str = "quick",
                        tavily_depth: str = None, tavily_max_results: int = None):
    """
    Unified entry that supports:
      - mode='quick'     → Serper (legacy behaviour)
      - mode='basic'     → Tavily search_depth='basic' (1 credit)
      - mode='advanced'  → Tavily search_depth='advanced' (2 credits)

    Returns the same list shape as search_suppliers(), but each item may include a 'summary' field.
    """
    # Logging setup
    log_filename = setup_logging(product_name, region)
    start_time = time.time()
    logging.info("="*94)
    logging.info(f"SEARCH_V2 START mode={mode} product='{product_name}' region='{region}'")
    logging.info("="*94)

    links = []
    if (mode or "").lower() == "quick":
        serper_resolved = resolve_serper_key(serper_api_key)
        if not serper_resolved:
            logging.error("SERPER_API_KEY missing for quick mode; switching to Tavern basic.")
            # If Serper missing, fallback to Tavily basic
            depth = "basic"
            max_results = 25
            links = tavily_search_links(product_name, region, tavily_api_key, depth=depth, max_results=max_results)
            validated_limit = 20
        else:
            links = search(product_name, 1, region, serper_resolved)
            validated_limit = 15
            logging.info("Using Serper quick search (legacy).")
    else:
        depth = tavily_depth or ("advanced" if (mode or "").lower() == "advanced" else "basic")
        max_results = tavily_max_results or (40 if depth == "advanced" else 25)
        links = tavily_search_links(product_name, region, tavily_api_key, depth=depth, max_results=max_results)
        validated_limit = 20 if depth == "basic" else 25
        logging.info(f"Using Tavily search depth={depth} max_results={max_results}.")

    logging.info("="*94)
    logging.info(f"{len(links)} CANDIDATES BEFORE FILTERING")
    for link in links[:100]:
        logging.info(link)
    logging.info("="*94)

    # If somehow empty at this point, safety fallback to Serper
    if not links:
        logging.warning("No candidates from primary search path; falling back to Serper.")
        fallback_serper = resolve_serper_key(serper_api_key)
        if fallback_serper:
            links = search(product_name, 1, region, fallback_serper)
        if (mode or "").lower() != "quick":
            # keep higher limits if user asked for Standard/Pro
            validated_limit = max(20, validated_limit if 'validated_limit' in locals() else 20)

    filtered_links = exclude_b2b_websites(links)
    logging.info("="*94)
    logging.info(f"{len(filtered_links)} CANDIDATES AFTER B2B FILTER")
    logging.info("="*94)

    # ===== Prefetch texts once for all filtered links (shared session) — used for Tavily, OK to keep =====
    prefetched_texts = prefetch_html_texts(filtered_links)

    validated_links = []
    # Use adjustable limit and pre-fetched texts
    run_threads_and_async_with_limit(
        validate_link,
        filtered_links,
        validated_links,
        product_name,
        region,
        resolve_openai_key(openai_api_key),
        limit=validated_limit if 'validated_limit' in locals() else 20,
        prefetched_texts=prefetched_texts
    )

    # De-duplicate
    validated_links = remove_repeating_links(validated_links)

    # Build results (add summary for Tavily modes only; keep Quick snappy)
    result_list = []
    is_tavily = (mode or "").lower() in ("basic", "advanced")

    for url, contact_details in validated_links:
        if url is None or "None **Reason:**" in str(url):
            continue
        company_name = extract_company_name(url)

        # Extract email & phone from the contact_details string
        email_match = re.search(r"Email:\s*([^\n\r]+)", contact_details or "", re.IGNORECASE)
        phone_match = re.search(r"Phone:\s*([^\n\r]+)", contact_details or "", re.IGNORECASE)
        email = email_match.group(1).strip() if email_match else None
        phone = phone_match.group(1).strip() if phone_match else None

        summary = ""
        if is_tavily:
            try:
                website_text = prefetched_texts.get(url)  # use prefetched text to avoid another fetch
                if website_text:
                    summary = summarise_supplier(product_name, region, url, website_text, openai_api_key)
            except Exception as e:
                logging.error(f"Error generating summary for {url}: {e}")

        result_list.append({
            "name": company_name,
            "url": url,
            "email": email,
            "phone": phone,
            "summary": summary
        })

    end_time = time.time()
    elapsed_time = end_time - start_time
    logging.info("="*94)
    logging.info(f"SEARCH_V2 DONE in {elapsed_time:.2f}s; {len(result_list)} validated results")
    logging.info("="*94)

    return result_list


