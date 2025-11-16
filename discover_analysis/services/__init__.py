"""
Suproc Services Package
Services for supplier discovery, analysis, and evaluation
"""

from .serper import serper_api
from .playwright_analyzer import playwright_analyzer
from .suplink_db import get_suplink_db

# Initialize supabase_db as a lazy getter
supabase_db = None

# Optional imports (may fail due to dependency issues) - Silently fail
try:
    from .openai_service import openai_service
except Exception:
    openai_service = None

try:
    from .verification import verification_service
except Exception:
    verification_service = None

try:
    from .scoring_simplified import simplified_scoring_engine as scoring_engine
except Exception:
    scoring_engine = None

try:
    from .database import database
except Exception:
    database = None

try:
    from . import certifications_db
except Exception:
    certifications_db = None

__all__ = [
    'serper_api',
    'openai_service',
    'playwright_analyzer',
    'verification_service',
    'scoring_engine',
    'get_suplink_db',
    'supabase_db',
    'database',
    'certifications_db'
]
