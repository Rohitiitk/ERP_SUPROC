import os
import json
import time
import requests
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from supabase import create_client, Client
import openai
from .utils import get_top_producing_countries, search_suppliers, search_suppliers_v2, mail
from .erp_api import erp_bp
from .socketio_instance import socketio
from .chatbot_api import chatbot_bp
from .chat_history_api import chat_history_bp
from pathlib import Path
import sys

# Add discover_analysis folder to path for imports
discover_analysis_path = Path(__file__).resolve().parents[1] / 'discover_analysis'
if str(discover_analysis_path) not in sys.path:
    sys.path.insert(0, str(discover_analysis_path))

# Import SuplinkDatabase for smart caching
import importlib
SuplinkDatabase = None
suplink_db_instance = None  # Lazy-loaded instance

# Try multiple dynamic import paths to be resilient to different project layouts
try:
    module = importlib.import_module('services.suplink_db')
    SuplinkDatabase = getattr(module, 'SuplinkDatabase', None)
except Exception as e:
    # Fallbacks: try importing alternative module names that might exist in some setups
    try:
        module = importlib.import_module('suplink_db')
        SuplinkDatabase = getattr(module, 'SuplinkDatabase', None)
    except Exception as e2:
        print(f"[WARNING] Could not import SuplinkDatabase via importlib: {e}; {e2}")
        SuplinkDatabase = None

# =========================
# === Environment Load  ===
# =========================
# Load env explicitly from project root (../.env) and optional .env.local
ROOT_DIR = Path(__file__).resolve().parents[1]  # project root (one level above /api)

# Azure App Service detection - Azure uses /tmp/... for execution
if os.getenv('WEBSITE_SITE_NAME'):
    print(f"[AZURE] Detected Azure App Service")
    print(f"[AZURE] __file__ location: {Path(__file__).resolve()}")
    print(f"[AZURE] Current working directory: {os.getcwd()}")
    
    # In Azure, the code might be in /tmp/xxx or /home/site/wwwroot
    # Use the actual __file__ location as the root
    actual_root = Path(__file__).resolve().parents[1]
    
    # Check if discover_analysis exists relative to actual location
    if (actual_root / 'discover_analysis').exists():
        ROOT_DIR = actual_root
        print(f"[AZURE] Using actual code location as ROOT_DIR: {ROOT_DIR}")
    elif Path('/home/site/wwwroot').exists():
        ROOT_DIR = Path('/home/site/wwwroot')
        print(f"[AZURE] Using /home/site/wwwroot as ROOT_DIR")
    
elif os.getenv('DOCKER_CONTAINER'):
    # Docker: /app
    docker_root = Path('/app')
    if docker_root.exists():
        ROOT_DIR = docker_root
        print(f"[DOCKER] Detected Docker container, using ROOT_DIR: {ROOT_DIR}")

print(f"[STARTUP] Final ROOT_DIR: {ROOT_DIR}")
print(f"[STARTUP] discover_analysis exists: {(ROOT_DIR / 'discover_analysis').exists()}")

load_dotenv(ROOT_DIR / ".env")
load_dotenv(ROOT_DIR / ".env.local", override=True)

# Optional: import local, git-ignored hardcoded secrets if present.
# Create api/app_secrets.py with the variables below to hardcode secrets *safely* without committing them.
# Example (do NOT commit):
#   OPENAI_API_KEY = "sk-...."
#   SERPER_API_KEY = "serper-...."
#   TAVILY_API_KEY = "tvly-...."
#   TURNSTILE_SECRET_KEY = "0x...."
#   MASTER_SUPABASE_URL = "https://<your>.supabase.co"
#   MASTER_SUPABASE_KEY = "eyJhbGciOi..."
#   MAIL_SERVER = "smtp.gmail.com"
#   MAIL_PORT = 465
#   MAIL_USE_SSL = True
#   MAIL_USERNAME = "no-reply@suproc.com"
#   MAIL_PASSWORD = "app-password"
#   MAIL_DEFAULT_SENDER = "no-reply@suproc.com"
try:
    from .app_secrets import (
        OPENAI_API_KEY as _OPENAI_HC,
        SERPER_API_KEY as _SERPER_HC,
        TAVILY_API_KEY as _TAVILY_HC,
        TURNSTILE_SECRET_KEY as _TURNSTILE_HC,
        MASTER_SUPABASE_URL as _SB_URL_HC,
        MASTER_SUPABASE_KEY as _SB_KEY_HC,
        MAIL_SERVER as _MAIL_SERVER_HC,
        MAIL_PORT as _MAIL_PORT_HC,
        MAIL_USE_SSL as _MAIL_SSL_HC,
        MAIL_USERNAME as _MAIL_USER_HC,
        MAIL_PASSWORD as _MAIL_PASS_HC,
        MAIL_DEFAULT_SENDER as _MAIL_FROM_HC,
    )
except Exception:
    _OPENAI_HC = _SERPER_HC = _TAVILY_HC = _TURNSTILE_HC = None
    _SB_URL_HC = _SB_KEY_HC = None
    _MAIL_SERVER_HC = _MAIL_PORT_HC = _MAIL_SSL_HC = _MAIL_USER_HC = _MAIL_PASS_HC = _MAIL_FROM_HC = None

# =========================
# === Hardcoded Fallbacks - REMOVED FOR SECURITY
# =========================
# All API keys must be provided via environment variables

# =========================
# === OpenAI priming    ===
# =========================
# Prime OpenAI client (ALL chat calls use gpt-4o-mini as requested)
openai.api_key = os.getenv("OPENAI_API_KEY") or _OPENAI_HC
if not openai.api_key:
    print("WARNING [app]: OPENAI_API_KEY is not set")

# =========================
# === Flask & CORS      ===
# =========================
app = Flask(__name__)
# Allow credentials so cookies/headers (if any) are sent by the browser
CORS(app, supports_credentials=True)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'aslkdjfhg')

# =========================
# === Blueprints        ===
# =========================
app.register_blueprint(erp_bp, url_prefix='/api/erp')
app.register_blueprint(chatbot_bp)
app.register_blueprint(chat_history_bp)

# =========================
# === Mail Config       ===
# =========================
# Mail uses env first, then app_secrets.py if present, then safe defaults.
app.config.update(
    MAIL_SERVER=os.getenv("MAIL_SERVER", _MAIL_SERVER_HC or ""),
    MAIL_PORT=int(os.getenv("MAIL_PORT", _MAIL_PORT_HC if _MAIL_PORT_HC is not None else 465)),
    MAIL_USE_SSL=(os.getenv("MAIL_USE_SSL", str(_MAIL_SSL_HC if _MAIL_SSL_HC is not None else "True")) == "True"),
    MAIL_USERNAME=os.getenv("MAIL_USERNAME", _MAIL_USER_HC or ""),
    MAIL_PASSWORD=os.getenv("MAIL_PASSWORD", _MAIL_PASS_HC or ""),
    MAIL_DEFAULT_SENDER=os.getenv("MAIL_DEFAULT_SENDER", _MAIL_FROM_HC or "no-reply@suproc.com")
)
mail.init_app(app)

# =========================
# === API Keys Config   ===
# =========================
# Keep both env+secrets+hardcoded resolution so the app "just works".
app.config['OPENAI_API_KEY'] = os.getenv('OPENAI_API_KEY') or _OPENAI_HC or HARDCODED_OPENAI_API_KEY
app.config['SERPER_API_KEY'] = os.getenv('SERPER_API_KEY') or _SERPER_HC or HARDCODED_SERPER_API_KEY
app.config['TAVILY_API_KEY'] = os.getenv('TAVILY_API_KEY') or _TAVILY_HC or HARDCODED_TAVILY_API_KEY

if not app.config['SERPER_API_KEY']:
    print("WARNING [app]: SERPER_API_KEY is not set")
if not app.config['TAVILY_API_KEY']:
    print("WARNING [app]: TAVILY_API_KEY is not set (Standard/Pro will fall back to Serper if coded to do so).")

# =========================
# === Socket.IO Init    ===
# =========================
socketio.init_app(app, cors_allowed_origins="*")

# =========================
# === Supabase / Auth   ===
# =========================
TURNSTILE_SECRET_KEY = (
    os.getenv("TURNSTILE_SECRET_KEY")
    or _TURNSTILE_HC
    or HARDCODED_TURNSTILE_SECRET_KEY
)
TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
SUPABASE_URL = (
    os.getenv("MASTER_SUPABASE_URL")
    or _SB_URL_HC
    or HARDCODED_MASTER_SUPABASE_URL
)
SUPABASE_KEY = (
    os.getenv("MASTER_SUPABASE_KEY")
    or _SB_KEY_HC
    or HARDCODED_MASTER_SUPABASE_KEY
)

if not TURNSTILE_SECRET_KEY:
    print("WARNING: TURNSTILE_SECRET_KEY environment variable is not set!")

# Initialize Supabase Client (master) - use service_role key
# Service role key should bypass RLS policies
try:
    if SUPABASE_URL and SUPABASE_KEY:
        print(f"[DEBUG] Initializing Supabase with URL: {SUPABASE_URL}")
        print(f"[DEBUG] API Key starts with: {SUPABASE_KEY[:50]}..." if len(SUPABASE_KEY) > 50 else f"[DEBUG] API Key: {SUPABASE_KEY}")
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print(f"[DEBUG] Supabase client initialized successfully")
    else:
        raise RuntimeError("Missing SUPABASE_URL or SUPABASE_KEY")
except Exception as e:
    print(f"Error initializing Supabase client: {e}")
    import traceback
    traceback.print_exc()
    supabase = None

# =========================
# === Health Check      ===
# =========================
@app.route("/healthz")
def healthz():
    return jsonify({"ok": True})

# =========================
# === Auth: /api/login  ===
# =========================
@app.route('/api/login', methods=['POST'])
def login():
    """
    Handles user login, including Turnstile CAPTCHA verification.
    """
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    token = data.get('cf-turnstile-response')

    if not all([email, password, token]):
        return jsonify({"message": "Missing email, password, or captcha token."}), 400

    # --- Turnstile Verification ---
    try:
        payload = {
            'secret': TURNSTILE_SECRET_KEY,
            'response': token,
            'remoteip': request.remote_addr
        }
        response = requests.post(
            TURNSTILE_VERIFY_URL,
            data=payload,
            headers={'Content-Type': 'application/x-www-form-urlencoded'}
        )

        # Debug breadcrumbs
        print(f"DEBUG: Cloudflare response status code: {response.status_code}")
        print(f"DEBUG: Cloudflare response URL: {response.url}")
        print(f"DEBUG: Cloudflare response history (redirects): {response.history}")

        response.raise_for_status()
        try:
            result = response.json()
        except ValueError:
            raw_preview = response.text[:200] if response.text else 'No body'
            print(f"Turnstile verification returned non-JSON payload: {raw_preview}")
            return jsonify({"message": "Unexpected response from CAPTCHA verification. Please try again."}), 502

        if not result.get('success'):
            print("Turnstile verification failed:", result.get('error-codes', 'No error codes'))
            return jsonify({"message": "CAPTCHA verification failed. Please try again."}), 403

    except requests.exceptions.RequestException as e:
        print(f"Error during Turnstile verification request: {e}")
        return jsonify({"message": "Could not verify CAPTCHA. Please try again later."}), 500
    except Exception as e:
        print(f"Unexpected error during Turnstile verification: {e}")
        return jsonify({"message": "An unexpected error occurred while verifying CAPTCHA."}), 500

    # --- Supabase Authentication ---
    if not supabase:
        return jsonify({"message": "Server configuration error."}), 500

    try:
        auth_response = supabase.auth.sign_in_with_password({
            "email": email,
            "password": password
        })

        return jsonify({
            "message": "Login successful",
            "access_token": auth_response.session.access_token,
            "refresh_token": auth_response.session.refresh_token,
            "user": auth_response.user.dict()
        }), 200

    except Exception as e:
        error_message = str(e)
        print(f"Supabase auth error: {error_message}")
        return jsonify({"message": "Invalid login credentials."}), 401

# =========================
# === OpenAI Helper     ===
# =========================
def get_ai_completion(prompt_text, model="gpt-4o-mini"):
    """Generic function to get a completion from OpenAI (kept on gpt-4o-mini)."""
    try:
        completion = openai.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt_text}]
        )
        return completion.choices[0].message.content.strip()
    except Exception as e:
        print(f"Error calling OpenAI: {e}")
        return None

# =========================
# === AI Routes         ===
# =========================
@app.route('/api/generate-project-summary', methods=['POST'])
def generate_project_summary():
    """
    Generates a detailed summary for a sourcing project.
    """
    data = request.get_json()
    project_id = data.get('projectId')
    if not project_id:
        return jsonify({"error": "Project ID is required"}), 400

    try:
        project_res = supabase.table('sourcing_projects').select('*').eq('id', project_id).single().execute()
        if not project_res.data:
            return jsonify({"error": "Project not found"}), 404
        project = project_res.data
    except Exception as e:
        return jsonify({"error": f"Database error: {e}"}), 500

    prompt = f"""
    Generate a concise and professional summary for the following sourcing project. The summary should be easy for potential suppliers to understand at a glance.
    Project Title: "{project.get('title')}"
    Project Type: {project.get('type')}
    Description: "{project.get('description', 'No description provided.')}"
    Key Requirements: {project.get('requirements', {})}
    Based on these details, create a summary of 2-3 sentences.
    """
    summary = get_ai_completion(prompt, model="gpt-4o-mini")
    if summary:
        return jsonify({"summary": summary})
    else:
        return jsonify({"error": "Failed to generate summary from AI"}), 500

@app.route('/api/enhance-supplier-description', methods=['POST'])
def enhance_supplier_description():
    """
    Generates a professional company description for a supplier.
    """
    data = request.get_json()
    supplier_id = data.get('supplierId')
    if not supplier_id:
        return jsonify({"error": "Supplier ID is required"}), 400

    try:
        supplier_res = supabase.table('suppliers').select('*').eq('id', supplier_id).single().execute()
        if not supplier_res.data:
            return jsonify({"error": "Supplier not found"}), 404
        supplier = supplier_res.data
    except Exception as e:
        return jsonify({"error": f"Database error fetching supplier: {e}"}), 500

    prompt = f"""
    Based on the following supplier details, generate a compelling and professional company description of about 100-150 words suitable for a procurement platform.
    - Company Name: {supplier.get('company_legal_name')}
    - Category: {supplier.get('category', 'N/A')}
    - Location: {supplier.get('city')}, {supplier.get('country')}
    """
    description = get_ai_completion(prompt, model="gpt-4o-mini")
    if description:
        return jsonify({"description": description})
    else:
        return jsonify({"error": "Failed to generate description from AI"}), 500

@app.route('/api/get-recommendations', methods=['POST'])
def get_recommendations():
    """
    Finds the most relevant suppliers from the internal DB using vector search.
    """
    data = request.get_json()
    project_id = data.get('projectId')
    if not project_id:
        return jsonify({"error": "Project ID is required"}), 400

    try:
        # Step 1: Get the project's embedding.
        project_res = supabase.table('sourcing_projects').select('embedding').eq('id', project_id).single().execute()
        project_embedding = project_res.data.get('embedding')

        if not project_embedding:
            # Fallback: If no embedding, just return an empty list for now.
            return jsonify([])

        # Step 2: Call the database function to get matches.
        matched_suppliers = supabase.rpc('match_suppliers', {
            'query_embedding': project_embedding,
            'match_threshold': 0.3,  # Similarity score threshold
            'match_count': 10         # Max number of suppliers to return
        }).execute()

        # Step 3: Fetch full details for the matched suppliers
        supplier_ids = [s['id'] for s in matched_suppliers.data]
        if not supplier_ids:
            return jsonify([])

        full_supplier_details = supabase.table('suppliers').select(
            "id, user_id, company_legal_name, location, supplier_type, suppliers_materials ( name ), suppliers_services ( name )"
        ).in_('id', supplier_ids).execute()

        return jsonify(full_supplier_details.data)

    except Exception as e:
        print(f"Error getting recommendations: {e}")
        return jsonify({"error": "Could not retrieve recommendations."}), 500

@app.route('/api/generate-and-save-project-embedding', methods=['POST'])
def generate_and_save_project_embedding():
    """
    Generates and saves an embedding for a specific sourcing project.
    """
    data = request.get_json()
    project_id = data.get('projectId')
    if not project_id:
        return jsonify({"error": "Project ID is required"}), 400

    try:
        # 1. Fetch the project's text content
        project_res = supabase.table('sourcing_projects').select('title, description, requirements').eq('id', project_id).single().execute()
        if not project_res.data:
            return jsonify({"error": "Project not found"}), 404

        project = project_res.data

        # 2. Combine the text fields into a single string for embedding
        content_to_embed = f"Title: {project.get('title', '')}\nDescription: {project.get('description', '')}\nRequirements: {json.dumps(project.get('requirements', {}))}"

        # 3. Generate the embedding with OpenAI
        embedding_response = openai.embeddings.create(
            model="text-embedding-3-small",
            input=content_to_embed
        )
        embedding = embedding_response.data[0].embedding

        # 4. Save the embedding to the database
        supabase.table('sourcing_projects').update({'embedding': embedding}).eq('id', project_id).execute()

        return jsonify({"message": f"Embedding generated and saved for project {project_id}"}), 200

    except Exception as e:
        print(f"Error generating embedding for project {project_id}: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/generate-supplier-embedding', methods=['POST'])
def generate_supplier_embedding():
    """
    Generates and saves an embedding for a specific supplier.
    """
    data = request.get_json()
    supplier_id = data.get('supplierId')
    if not supplier_id:
        return jsonify({"error": "Supplier ID is required"}), 400

    try:
        # 1. Fetch all relevant text data for the supplier
        supplier_res = supabase.table('suppliers').select(
            'company_legal_name, description, category, supplier_type, suppliers_materials(name), suppliers_services(name)'
        ).eq('id', supplier_id).single().execute()

        if not supplier_res.data:
            return jsonify({"error": "Supplier not found"}), 404

        supplier = supplier_res.data

        # 2. Combine all text into a single document
        materials = [m['name'] for m in supplier.get('suppliers_materials', []) if m.get('name')]
        services = [s['name'] for s in supplier.get('suppliers_services', []) if s.get('name')]

        content_to_embed = (
            f"Supplier Name: {supplier.get('company_legal_name', '')}. "
            f"Description: {supplier.get('description', '')}. "
            f"Category: {supplier.get('category', '')}. "
            f"Type: {supplier.get('supplier_type', '')}. "
            f"Services Offered: {', '.join(services)}. "
            f"Materials Provided: {', '.join(materials)}."
        )

        # 3. Generate the embedding
        embedding_response = openai.embeddings.create(
            model="text-embedding-3-small",
            input=content_to_embed
        )
        embedding = embedding_response.data[0].embedding

        # 4. Save the embedding to the suppliers table
        supabase.table('suppliers').update({'embedding': embedding}).eq('id', supplier_id).execute()

        return jsonify({"message": f"Embedding generated for supplier {supplier_id}"}), 200

    except Exception as e:
        print(f"Error generating embedding for supplier {supplier_id}: {e}")
        return jsonify({"error": str(e)}), 500

# =========================
# === Product Insights  ===
# =========================
@app.route('/api/top-countries')
def top_countries():
    product = request.args.get('product', '')
    countries = get_top_producing_countries(product, app.config['OPENAI_API_KEY'])
    return jsonify(countries)

@app.route('/api/results')
def results():
    product = request.args.get('product', '')
    country = request.args.get('country', '')
    suppliers = search_suppliers(
        product,
        country,
        app.config['SERPER_API_KEY'],
        app.config['OPENAI_API_KEY']
    )
    return jsonify(suppliers)

@app.route('/api/top-rankings')
def top_rankings():
    try:
        json_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'top_rankings.json')
        with open(json_path, 'r') as f:
            data = json.load(f)
        return jsonify(data)
    except FileNotFoundError:
        return jsonify({"error": "top_rankings.json not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/search')
def unified_search():
    """
    Unified search entry with modes:
      - mode=quick     → existing Serper flow
      - mode=basic     → Tavily (basic, 1 credit)
      - mode=advanced  → Tavily (advanced, 2 credits)
    """
    product = request.args.get('product', '')
    country = request.args.get('country', '')
    mode = (request.args.get('mode', 'quick') or 'quick').lower()
    max_results = request.args.get('max_results', type=int)  # optional override

    if not product or not country:
        return jsonify({"error": "Missing product or country"}), 400

    if mode == 'quick':
        # Legacy Serper-based search (unchanged; validate_link now uses sync fetch underneath)
        suppliers = search_suppliers(
            product,
            country,
            app.config['SERPER_API_KEY'],
            app.config['OPENAI_API_KEY']
        )
    else:
        depth = 'advanced' if mode == 'advanced' else 'basic'
        suppliers = search_suppliers_v2(
            product_name=product,
            region=country,
            serper_api_key=app.config['SERPER_API_KEY'],
            openai_api_key=app.config['OPENAI_API_KEY'],
            tavily_api_key=app.config.get('TAVILY_API_KEY'),
            mode=mode,
            tavily_depth=depth,
            tavily_max_results=max_results
        )

    return jsonify(suppliers)

# =========================
# === Quick FAQs (AI)   ===
# =========================
# Simple in-memory cache to speed up repeated FAQ loads
_FAQ_CACHE = {}  # key: product_lower -> {"ts": epoch_seconds, "data": {"faqs":[...]}}
_FAQ_CACHE_TTL = int(os.getenv("FAQ_CACHE_TTL_SECONDS", "3600"))  # default 1 hour

@app.route('/api/faq')
def product_faq():
    """
    Returns 5 crisp FAQs for the given product to show during loading.
    Shape: {"faqs":[{"title": "...", "answer": "..."} * up to 5]}
    Uses OpenAI gpt-4o-mini and caches by product.
    """
    product = (request.args.get('product') or '').strip()
    if not product:
        return jsonify({"faqs": []})

    key = product.lower()

    # Serve from cache if fresh
    cached = _FAQ_CACHE.get(key)
    now = time.time()
    if cached and (now - cached["ts"] <= _FAQ_CACHE_TTL):
        return jsonify(cached["data"])

    try:
        # Ensure key is set (already set above, but safe)
        openai.api_key = app.config['OPENAI_API_KEY']

        prompt = f"""
Return a pure JSON object with key "faqs" containing exactly 5 items.
Each item has: "title" (<=80 chars) and "answer" (1–3 concise sentences, professional).
Focus them for product "{product}" as:
1) Profit & Uses — how businesses deploy it and where it drives margin/value.
2) Market & Competitors — direct and indirect substitutes; quick landscape.
3) News & Watch-outs — notable recent developments, regulations, or supply/price signals (generic if uncertain).
4) Supply & Inputs — key raw materials, sourcing geographies, and common bottlenecks.
5) Buyer Tips — typical specs/grades, certifications, or MOQ/lead-time considerations.

Rules:
- JSON only. No markdown or extra fields. No preface/suffix text.
- Keep answers crisp; practical takeaways for buyers.
        """.strip()

        completion = openai.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0.2,
            max_tokens=450,
            messages=[
                {"role": "system", "content": "You generate brief, useful procurement FAQs and output JSON only."},
                {"role": "user", "content": prompt}
            ],
        )

        raw = completion.choices[0].message.content.strip()

        # Best-effort JSON parse (in case model adds stray whitespace or code fences)
        def _coerce_json(s: str):
            try:
                return json.loads(s)
            except Exception:
                start = s.find("{")
                end = s.rfind("}")
                if start != -1 and end != -1 and end > start:
                    try:
                        return json.loads(s[start:end+1])
                    except Exception:
                        return {"faqs": []}
                return {"faqs": []}

        data = _coerce_json(raw)
        faqs = data.get("faqs", [])
        clean = []
        for item in faqs[:5]:
            title = str(item.get("title", "")).strip()
            answer = str(item.get("answer", "")).strip()
            if title and answer:
                clean.append({"title": title[:120], "answer": answer})

        payload = {"faqs": clean}
        # Write to cache
        _FAQ_CACHE[key] = {"ts": now, "data": payload}
        return jsonify(payload)
    except Exception as e:
        print("FAQ generation error:", e)
        return jsonify({"faqs": []})

@app.route('/api/save-search-and-analyze', methods=['POST'])
def save_search_and_analyze():
    """
    Save discover AI search results to database and trigger comprehensive analysis
    WITH SMART CACHING: Skip analysis if suppliers already exist for this search query
    """
    print(f"\n{'='*80}")
    print(f"[API] /api/save-search-and-analyze endpoint called")
    print(f"[TIME] {datetime.now()}")
    print(f"{'='*80}")

    try:
        data = request.get_json()
        print(f"[DEBUG] Request data received: {list(data.keys()) if data else 'None'}")

        # Extract required fields
        search_term = data.get('search_term')
        country = data.get('country')
        results = data.get('results', [])
        mode = data.get('mode', 'quick')
        user_id = data.get('user_id')

        # Validate required fields
        if not search_term or not country:
            return jsonify({"error": "search_term and country are required"}), 400

        print(f"[DEBUG] Extracted: search_term='{search_term}', country='{country}', mode='{mode}', results_count={len(results)}")

        # === SMART URL-LEVEL DEDUPLICATION ===
        # Check which specific URLs are NEW (haven't been analyzed before)
        should_skip_analysis = False
        new_urls_count = 0

        print(f"[DEBUG] Starting URL deduplication check...")
        if SuplinkDatabase is not None:
            try:
                global suplink_db_instance
                if suplink_db_instance is None:
                    suplink_db_instance = SuplinkDatabase()

                # Extract all URLs from search results
                urls_in_results = [r.get('url') for r in results if r.get('url')]

                if urls_in_results:
                    # Check which URLs already exist in database
                    url_status = suplink_db_instance.check_existing_urls(urls_in_results)

                    # Count NEW URLs (ones that don't exist yet)
                    new_urls_count = sum(1 for exists in url_status.values() if not exists)
                    existing_urls_count = len(urls_in_results) - new_urls_count

                    print(f"\n{'='*80}")
                    print(f"[URL DEDUPLICATION] Search: '{search_term}' + '{country}'")
                    print(f"[RESULTS] Total URLs: {len(urls_in_results)}")
                    print(f"[EXISTING] Already analyzed: {existing_urls_count} URLs")
                    print(f"[NEW] Need analysis: {new_urls_count} URLs")

                    # FORCE ANALYSIS EVERY TIME - Never skip
                    should_skip_analysis = False
                    print(f"[FORCE ANALYSIS] Running analysis for all URLs (including re-analysis of existing)")
                    print(f"[ANALYZE] Will process {len(urls_in_results)} suppliers")

                    print(f"{'='*80}\n")
                else:
                    print(f"[WARNING] No URLs found in search results")

            except Exception as cache_err:
                print(f"[WARNING] URL deduplication check failed, proceeding with analysis: {cache_err}")
                should_skip_analysis = False

        # Insert into discover_ai_searches table
        insert_data = {
            'search_term': search_term,
            'country': country,
            'results': results,
            'mode': mode
        }

        # Always add user_id (required by RLS policy) - use provided value or null
        insert_data['user_id'] = user_id

        # Save to Supabase
        print(f"[DEBUG] Saving to discover_ai_searches table...")
        print(f"[DEBUG] Insert data keys: {list(insert_data.keys())}, user_id: {user_id}")
        print(f"[DEBUG] Supabase client type: {type(supabase)}, Auth: {supabase.auth if hasattr(supabase, 'auth') else 'N/A'}")
         
        response = None
        try:
            response = supabase.table('discover_ai_searches').insert(insert_data).execute()
        except Exception as db_error:
            # Handle RLS policy errors more gracefully
            error_msg = str(db_error)
            print(f"[DEBUG] Database insert error: {error_msg}")
            
            # Check if it's an RLS policy error (PostgreSQL error code 42501)
            if '42501' in error_msg or 'row-level security policy' in error_msg:
                print(f"[WARNING] RLS Policy violation detected - trying alternative approach")
                print(f"[DEBUG] The service_role key should bypass RLS - checking configuration...")
                
                # If user_id is None/null, try providing a dummy value to satisfy RLS
                if not user_id:
                    print(f"[DEBUG] Attempting with a system-level user ID...")
                    insert_data['user_id'] = 'system-discover-ai'
                    try:
                        response = supabase.table('discover_ai_searches').insert(insert_data).execute()
                        print(f"[SUCCESS] Insert succeeded with system user ID")
                    except Exception as retry_error:
                        print(f"[ERROR] Retry with system user also failed: {retry_error}")
                        raise retry_error
                else:
                    # User ID was provided but RLS still failed
                    print(f"[ERROR] RLS policy violation even with user_id provided: {user_id}")
                    raise db_error
            else:
                raise db_error

        if response.data:
            print(f"[DEBUG] Successfully saved to database. Record ID: {response.data[0].get('id')}")
            print(f"[SEARCH SAVED] Product: {search_term}, Country: {country}, Mode: {mode}")

            # Only trigger analysis if cache check didn't find existing data
            print(f"[DEBUG] should_skip_analysis={should_skip_analysis}, new_urls_count={new_urls_count}")
            if not should_skip_analysis:
                # Trigger comprehensive business analysis script in background
                import subprocess
                import sys
                from pathlib import Path
                import os

                # Get the search_id that was just saved
                search_id = response.data[0].get('id') if response.data else None

                # Try multiple paths to find discover_analysis folder
                script_path = None
                
                # Get the actual location of app.py (works in Azure temp directory)
                app_py_location = Path(__file__).resolve().parent.parent
                
                potential_paths = [
                    # Try relative to actual __file__ location (works in Azure /tmp)
                    app_py_location / 'discover_analysis' / 'comprehensive_business_analysis.py',
                    # Try current working directory
                    Path(os.getcwd()) / 'discover_analysis' / 'comprehensive_business_analysis.py',
                    # Try ROOT_DIR
                    Path(ROOT_DIR) / 'discover_analysis' / 'comprehensive_business_analysis.py',
                    # Try one level up from cwd (Azure sometimes uses nested structure)
                    Path(os.getcwd()).parent / 'discover_analysis' / 'comprehensive_business_analysis.py',
                ]
                
                print(f"[DEBUG] Searching for analysis script...")
                print(f"[DEBUG] app_py_location: {app_py_location}")
                print(f"[DEBUG] Checking {len(potential_paths)} potential paths...")
                
                for i, potential_path in enumerate(potential_paths, 1):
                    print(f"[DEBUG] Path {i}: {potential_path} - Exists: {potential_path.exists()}")
                    if potential_path.exists():
                        script_path = potential_path
                        print(f"[SUCCESS] Found script at: {script_path}")
                        break

                if script_path:
                    try:
                        discover_analysis_folder = script_path.parent
                        
                        # Build command with search_id and user_id arguments
                        command = [sys.executable, str(script_path)]
                        if search_id:
                            command.extend(['--search-id', str(search_id)])
                        if user_id:
                            command.extend(['--user-id', str(user_id)])

                        # Run the Python script in the background
                        # Use None for stdout/stderr to inherit parent's streams (show logs in terminal)
                        # For Azure/Docker: use shell=False and proper environment
                        import platform
                        
                        # Azure App Service detection
                        is_azure = os.getenv('WEBSITE_SITE_NAME') is not None
                        
                        if is_azure or platform.system() == 'Linux':
                            # Azure/Linux: Run with proper permissions and environment
                            env = os.environ.copy()
                            env['PYTHONUNBUFFERED'] = '1'  # Force unbuffered output
                            
                            process = subprocess.Popen(
                                command,
                                cwd=str(discover_analysis_folder),
                                stdout=subprocess.PIPE,  # Capture for Azure logs
                                stderr=subprocess.STDOUT,  # Merge stderr to stdout
                                text=True,
                                env=env,
                                bufsize=1  # Line buffered
                            )
                            
                            # Start a thread to read and print output in real-time
                            import threading
                            def log_output():
                                try:
                                    for line in process.stdout:
                                        print(f"[ANALYSIS] {line.rstrip()}")
                                except Exception as e:
                                    print(f"[ANALYSIS ERROR] Failed to read output: {e}")
                            
                            thread = threading.Thread(target=log_output, daemon=True)
                            thread.start()
                        else:
                            # Windows local development: inherit stdout/stderr
                            process = subprocess.Popen(
                                command,
                                cwd=str(discover_analysis_folder),
                                stdout=None,  # Inherit parent's stdout
                                stderr=None,  # Inherit parent's stderr
                                text=True
                            )

                        print(f"\n{'='*80}")
                        print(f"[ANALYSIS TRIGGERED] Comprehensive analysis script started")
                        print(f"[SCRIPT PATH] {script_path}")
                        print(f"[SEARCH ID] {search_id}")
                        print(f"[USER ID] {user_id}")
                        print(f"[PROCESS ID] PID: {process.pid}")
                        print(f"[ENVIRONMENT] {'Azure/Docker' if is_azure or platform.system() == 'Linux' else 'Windows Local'}")
                        print(f"[OUTPUT] Logs will appear below in real-time...")
                        print(f"{'='*80}\n")

                    except Exception as e:
                        print(f"[WARNING] Failed to trigger analysis script: {e}")
                        import traceback
                        traceback.print_exc()
                else:
                    print(f"[WARNING] Analysis script not found in any of these locations:")
                    for path in potential_paths:
                        print(f"  - {path}")
                    print(f"[DEBUG] Current working directory: {os.getcwd()}")
                    print(f"[DEBUG] ROOT_DIR: {ROOT_DIR}")
                    print(f"[DEBUG] __file__: {__file__}")
            else:
                print(f"\n{'='*80}")
                print(f"[ANALYSIS SKIPPED] All suppliers already analyzed")
                print(f"[REASON] No new URLs to process")
                print(f"{'='*80}\n")

            # Build response message
            message = f"Search saved and analysis triggered for all suppliers"

            return jsonify({
                "message": message,
                "search_id": response.data[0].get('id'),
                "all_urls_cached": False,  # Always run analysis
                "new_urls_count": len(results)  # Process all URLs
            }), 201
        else:
            return jsonify({"error": "Failed to save search"}), 500

    except Exception as e:
        error_msg = str(e)
        print(f"[ERROR] save_search_and_analyze: {error_msg}")
        import traceback
        traceback.print_exc()
        
        # Return more specific error info for RLS issues
        if '42501' in error_msg or 'row-level security' in error_msg.lower():
            return jsonify({
                "error": "Database permission error - RLS policy may need adjustment. Ensure user_id is properly provided.",
                "details": error_msg
            }), 403
        
        return jsonify({"error": str(e)}), 500

@app.route('/api/suppliers-by-search', methods=['GET'])
def get_suppliers_by_search():
    """
    Get suppliers discovered from a specific search.
    Returns ONLY suppliers from the given search_id, not all suppliers in database.

    Query Parameters:
        search_id: The discover_ai_searches ID

    Returns:
        List of suppliers from this specific search, sorted by score
    """
    try:
        search_id = request.args.get('search_id')

        if not search_id:
            return jsonify({"error": "search_id parameter is required"}), 400

        # Use SuplinkDatabase to get suppliers for this search
        if SuplinkDatabase is not None:
            try:
                global suplink_db_instance
                if suplink_db_instance is None:
                    suplink_db_instance = SuplinkDatabase()

                # Get suppliers for this specific search
                suppliers = suplink_db_instance.get_suppliers_by_search_id(search_id)

                print(f"[API] Retrieved {len(suppliers)} suppliers for search_id: {search_id}")

                return jsonify({
                    "suppliers": suppliers,
                    "count": len(suppliers),
                    "search_id": search_id
                }), 200

            except Exception as db_err:
                print(f"[ERROR] Database error: {db_err}")
                import traceback
                traceback.print_exc()
                return jsonify({"error": "Database error", "details": str(db_err)}), 500
        else:
            return jsonify({"error": "SuplinkDatabase not available"}), 500

    except Exception as e:
        print(f"[ERROR] get_suppliers_by_search: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# =========================
# === Run Server        ===
# =========================
if __name__ == "__main__":
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8000"))  # default 8000
    debug = os.environ.get("DEBUG", "true").lower() == "true"
    socketio.run(app, host=host, port=port, debug=debug, allow_unsafe_werkzeug=True)

@app.get("/api/health")
def health():
    return {"status": "ok"}, 200

@app.route("/api/health", methods=["GET"])
def _health():
    return {"status": "ok"}, 200

from flask import send_from_directory
from flask_cors import CORS as _CORS_REAPPLY  # avoid shadowing
import os as _os_shadow
try:
    _CORS_REAPPLY(app, resources={r"/api/*": {"origins": _os_shadow.getenv("CORS_ALLOWED_ORIGINS","*").split(",")}}, supports_credentials=True)
except Exception as _e:
    pass

APP_DIR = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.abspath(os.path.join(APP_DIR, "..", "dist"))
if os.path.isdir(DIST):
    @app.route("/")
    def _index():
        return send_from_directory(DIST, "index.html")
    @app.route("/<path:path>")
    def _spa(path):
        fp = os.path.join(DIST, path)
        return send_from_directory(DIST, path) if os.path.exists(fp) else send_from_directory(DIST, "index.html")
