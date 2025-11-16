import json
import os
import time
import psycopg2
from flask import request, jsonify, Blueprint
from .socketio_instance import socketio
from supabase import create_client, Client
from dotenv import load_dotenv
from datetime import datetime, date
from pathlib import Path
import uuid
import requests
import openai
from urllib.parse import parse_qsl, quote, unquote, urlsplit, urlunsplit, urlencode

# --- Local Imports ---
from . import database_manager
from collections import defaultdict
from decimal import Decimal
from typing import Any, Dict, Iterable, List, Tuple, Optional

# Load environment variables
SCRIPT_DIR = Path(__file__).parent.resolve()
ROOT_DIR = SCRIPT_DIR.parent
load_dotenv(ROOT_DIR / ".env")
load_dotenv(ROOT_DIR / ".env.local", override=True)

# --- OpenAI Config (ENV first, optional) ---
openai.api_key = os.environ.get("OPENAI_API_KEY")
OPENAI_CHAT_MODEL = os.environ.get("OPENAI_CHAT_MODEL", "gpt-4o-mini")

# --- Industry Config Paths ---
INDUSTRY_CONFIGS = {
    'manufacturing': 'erp_configs/manuf_erp_config.json',
    'trading': 'erp_configs/tnd_erp_config.json',
    'retail': 'erp_configs/retail_erp_config.json',
    'epc': 'erp_configs/erc_erp_config.json',
    'ecommerce': 'erp_configs/ecom_erp_config.json',
    'education': 'erp_configs/education_erp_config.json',
    'healthcare': 'erp_configs/healthcare_erp_config.json',
    'services': 'erp_configs/services_erp_config.json',
    'finance': 'erp_configs/finance_erp_config.json',
    'nonprofit': 'erp_configs/nonprofit_erp_config.json',
    'custom': 'erp_configs/default_erp_config.json'
}

# --- Overview Analytics Helpers ---

def _safe_number(value: Any, default: float = 0.0) -> float:
    if value is None:
        return default
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, Decimal):
        return float(value)
    try:
        return float(str(value))
    except (TypeError, ValueError):
        return default


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(round(_safe_number(value, float(default))))
    except (TypeError, ValueError):
        return default


def _parse_period(raw_value: Any) -> datetime | None:
    if not raw_value:
        return None
    if isinstance(raw_value, datetime):
        return raw_value
    if isinstance(raw_value, date):
        return datetime.combine(raw_value, datetime.min.time())

    value = str(raw_value)
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y-%m", "%Y%m%d", "%d-%m-%Y", "%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S"):
        try:
            parsed = datetime.strptime(value, fmt)
            return parsed
        except ValueError:
            continue
    try:
        if value.endswith("Z"):
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _filter_rows_for_user(rows: Iterable[Dict[str, Any]], user_id: str | None) -> List[Dict[str, Any]]:
    if not rows:
        return []
    if not user_id:
        return list(rows)
    rows_list = list(rows)
    if rows_list and isinstance(rows_list[0], dict) and "user_id" in rows_list[0]:
        return [row for row in rows_list if row.get("user_id") == user_id]
    return rows_list


def _latest_row_by_period(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not rows:
        return {}

    def row_key(row: Dict[str, Any]):
        for key in ("period_end", "period", "period_start", "month", "captured_at", "created_at", "updated_at", "date"):
            candidate = row.get(key)
            parsed = _parse_period(candidate)
            if parsed:
                return parsed
        return datetime.min

    return max(rows, key=row_key, default={})


def _compute_month_groups(rows: List[Dict[str, Any]], value_key: str) -> List[Dict[str, Any]]:
    month_totals = defaultdict(float)
    for row in rows:
        for key in ("period", "month", "period_start", "date", "captured_at", "created_at"):
            date_val = row.get(key)
            parsed = _parse_period(date_val)
            if parsed:
                month_label = parsed.strftime("%Y-%m")
                month_totals[month_label] += _safe_number(row.get(value_key))
                break
    return [
        {"month": month, "value": round(amount, 2)}
        for month, amount in sorted(month_totals.items())
    ]


def _compute_orders_month_groups(orders: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    month_totals = defaultdict(float)
    for order in orders:
        date_val = order.get("order_date") or order.get("created_at") or order.get("date")
        parsed = _parse_period(date_val)
        if not parsed:
            continue
        month_totals[parsed.strftime("%Y-%m")] += _safe_number(order.get("total_amount") or order.get("amount") or order.get("total"))
    return [
        {"month": month, "value": round(amount, 2)}
        for month, amount in sorted(month_totals.items())
    ]


def _supplier_counts(orders: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    counts = defaultdict(int)
    for order in orders:
        supplier = (
            order.get("supplier_name")
            or order.get("supplier")
            or order.get("vendor_name")
            or order.get("vendor")
            or order.get("supplier_id")
            or "Unknown"
        )
        counts[str(supplier)] += 1
    sorted_counts = sorted(counts.items(), key=lambda item: item[1], reverse=True)
    return [{"supplier": supplier, "orders": count} for supplier, count in sorted_counts[:8]]


def _purchase_expense_totals(metrics_rows: List[Dict[str, Any]], orders: List[Dict[str, Any]]) -> Dict[str, float]:
    purchase_total = 0.0
    expense_total = 0.0

    for row in metrics_rows:
        purchase_total += _safe_number(
            row.get("purchases") or row.get("purchase_total") or row.get("purchase_amount") or row.get("revenue")
        )
        expense_total += _safe_number(
            row.get("expenses") or row.get("expense_total") or row.get("operating_expenses")
        )

    if purchase_total == 0.0 and orders:
        for order in orders:
            purchase_total += _safe_number(
                order.get("total_amount") or order.get("amount") or order.get("total") or 0.0
            )
            expense_total += _safe_number(
                order.get("expense_amount") or order.get("expense") or 0.0
            )

    if purchase_total == 0.0 and expense_total == 0.0:
        return {"purchases": 0.0, "expenses": 0.0}

    return {
        "purchases": round(purchase_total, 2),
        "expenses": round(expense_total, 2)
    }


def _productivity_points(metrics_rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    points = []
    for row in metrics_rows:
        for key in ("productivity_index", "project_completion_rate", "productivity", "completion_rate"):
            if key in row:
                date_candidates = [
                    row.get("period"), row.get("month"), row.get("period_start"),
                    row.get("period_end"), row.get("captured_at"), row.get("created_at")
                ]
                parsed_date = None
                for candidate in date_candidates:
                    parsed_date = _parse_period(candidate)
                    if parsed_date:
                        break
                label = parsed_date.strftime("%Y-%m") if parsed_date else str(len(points) + 1)
                points.append({"period": label, "value": round(_safe_number(row[key]), 2)})
                break
    return sorted(points, key=lambda point: point["period"])


PILLAR_KEYWORDS: Dict[str, Tuple[str, List[str]]] = {
    "finance": ("Import financial actuals", ["ledger", "finance", "balance", "account", "general"]),
    "customers": ("Add your customers", ["customer", "client"]),
    "suppliers": ("Add your suppliers", ["supplier", "vendor", "partner"]),
    "sales": ("Log sales orders", ["sales", "invoice", "quote", "opportunity"]),
    "purchases": ("Track purchase orders", ["purchase", "procurement", "po"]),
    "projects": ("Create projects or jobs", ["project", "job", "engagement"]),
    "inventory": ("Update inventory levels", ["inventory", "stock", "warehouse", "item"]),
    "employees": ("Invite your team", ["employee", "staff", "hr", "people"]),
    "tasks": ("Organise internal tasks", ["task", "todo", "activity"]),
}


def _normalize_label(value: Optional[str]) -> str:
    if not value:
        return ""
    return str(value)


def _find_entity_by_keywords(entities: Dict[str, Dict[str, Any]], keywords: List[str]) -> Optional[str]:
    lowered_keywords = [kw.lower() for kw in keywords]
    for entity_id, entity_cfg in entities.items():
        label = _normalize_label(entity_cfg.get("label", entity_id)).lower()
        entity_name = entity_id.lower()
        for kw in lowered_keywords:
            if kw in label or kw in entity_name:
                return entity_id
    return None


def _collect_entity_stats(user_supabase: Client, erp_config: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], Dict[str, Dict[str, Any]], int, int, int, Optional[str]]:
    """
    Returns:
        entity_stats: list of domains with entity counts/last updated
        entity_lookup: mapping entity_id -> {count, domain_id, label}
        total_entities, populated_entities, total_records, latest_timestamp
    """
    entity_stats: List[Dict[str, Any]] = []
    entity_lookup: Dict[str, Dict[str, Any]] = {}
    total_entities = 0
    populated_entities = 0
    total_records = 0
    latest_timestamp: Optional[str] = None

    for domain in erp_config.get("domains", []):
        domain_id = domain.get("id")
        domain_name = domain.get("name", domain_id)
        entities = domain.get("entities", {})
        domain_entities: List[Dict[str, Any]] = []

        for entity_id, entity_cfg in entities.items():
            total_entities += 1
            count = 0
            latest = None
            try:
                try:
                    query = user_supabase.table(entity_id).select(
                        "id, updated_at, created_at", count="exact"
                    ).order("updated_at", desc=True).limit(1)
                    response = query.execute()
                except Exception:
                    query = user_supabase.table(entity_id).select(
                        "id, created_at", count="exact"
                    ).limit(1)
                    response = query.execute()
                count = response.count or 0
                if response.data:
                    row = response.data[0]
                    latest = row.get("updated_at") or row.get("created_at")
            except Exception:
                count = 0
                latest = None

            if count > 0:
                populated_entities += 1
                total_records += count
                if latest:
                    try:
                        parsed_latest = _parse_period(latest)
                        if parsed_latest:
                            timestamp_iso = parsed_latest.isoformat()
                            if not latest_timestamp or timestamp_iso > latest_timestamp:
                                latest_timestamp = timestamp_iso
                    except Exception:
                        pass

            domain_entities.append(
                {
                    "entityId": entity_id,
                    "label": entity_cfg.get("label", entity_id),
                    "count": count,
                    "lastUpdated": latest,
                    "domainId": domain_id,
                    "domainName": domain_name,
                }
            )
            entity_lookup[entity_id] = {
                "count": count,
                "label": entity_cfg.get("label", entity_id),
                "domainId": domain_id,
                "domainName": domain_name,
            }

        entity_stats.append(
            {
                "domainId": domain_id,
                "domainName": domain_name,
                "entities": domain_entities,
                "totalEntities": len(domain_entities),
                "populatedEntities": sum(1 for ent in domain_entities if ent["count"] > 0),
                "totalRecords": sum(ent["count"] for ent in domain_entities),
            }
        )

    return entity_stats, entity_lookup, total_entities, populated_entities, total_records, latest_timestamp


def _build_onboarding_checklist(
    entity_lookup: Dict[str, Dict[str, Any]],
    erp_config: Dict[str, Any],
    metrics_rows: List[Dict[str, Any]],
    orders_rows: List[Dict[str, Any]],
    rfq_rows: List[Dict[str, Any]],
    rfp_rows: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    checklist: List[Dict[str, Any]] = []

    all_entities: Dict[str, Dict[str, Any]] = {}
    for domain in erp_config.get("domains", []):
        all_entities.update(domain.get("entities", {}))

    keyword_entity_map: Dict[str, Optional[str]] = {}
    for pillar_key, (_, keywords) in PILLAR_KEYWORDS.items():
        keyword_entity_map[pillar_key] = _find_entity_by_keywords(all_entities, keywords)

    def entity_count(key: str) -> int:
        entity_id = keyword_entity_map.get(key)
        if not entity_id:
            return 0
        lookup = entity_lookup.get(entity_id)
        if not lookup:
            return 0
        return int(lookup.get("count", 0) or 0)

    def checklist_entry(
        item_id: str,
        title: str,
        description: str,
        completed: bool,
        linked_entity_key: Optional[str] = None,
        action_label: str = "Open workspace",
    ) -> Dict[str, Any]:
        entity_info: Optional[Dict[str, Any]] = None
        if linked_entity_key:
            entity_id = keyword_entity_map.get(linked_entity_key)
            if entity_id and entity_id in entity_lookup:
                entity_info = {
                    "entityId": entity_id,
                    "domainId": entity_lookup[entity_id]["domainId"],
                    "domainName": entity_lookup[entity_id]["domainName"],
                }
        return {
            "id": item_id,
            "title": title,
            "description": description,
            "completed": completed,
            "actionLabel": action_label,
            "linkedEntity": entity_info,
        }

    checklist.append(
        checklist_entry(
            "finance_snapshot",
            "Record your first financial snapshot",
            "Add revenue, expenses, and cash data so forecasts and summaries have real numbers.",
            completed=len(metrics_rows) > 0,
            linked_entity_key="finance",
        )
    )

    checklist.append(
        checklist_entry(
            "customer_directory",
            "Import customers or clients",
            "Keep your CRM in sync by adding customer profiles, territories, and account owners.",
            completed=entity_count("customers") > 0,
            linked_entity_key="customers",
        )
    )

    checklist.append(
        checklist_entry(
            "supplier_directory",
            "Add preferred suppliers",
            "Centralise vendor contacts, payment terms, and performance notes.",
            completed=entity_count("suppliers") > 0,
            linked_entity_key="suppliers",
        )
    )

    checklist.append(
        checklist_entry(
            "sales_pipeline",
            "Log open sales or quotes",
            "Capture opportunities and orders so revenue forecasts stay aligned with delivery.",
            completed=entity_count("sales") > 0 or len(orders_rows) > 0,
            linked_entity_key="sales",
        )
    )

    checklist.append(
        checklist_entry(
            "purchase_orders",
            "Track purchase orders or procurement",
            "Map inbound spend and receipting activity to stay ahead of supplier lead times.",
            completed=entity_count("purchases") > 0,
            linked_entity_key="purchases",
        )
    )

    checklist.append(
        checklist_entry(
            "project_tracking",
            "Set up active projects",
            "Plan milestones, budgets, and delivery owners so utilisation and margin trends are available.",
            completed=entity_count("projects") > 0,
            linked_entity_key="projects",
        )
    )

    checklist.append(
        checklist_entry(
            "inventory_baseline",
            "Record your initial inventory levels",
            "Track stock availability, valuation, and replenishment triggers from day one.",
            completed=entity_count("inventory") > 0,
            linked_entity_key="inventory",
        )
    )

    checklist.append(
        checklist_entry(
            "team_directory",
            "Invite team members / employees",
            "Maintain HR and responsibility data to power capacity, approvals, and workflow routing.",
            completed=entity_count("employees") > 0,
            linked_entity_key="employees",
        )
    )

    checklist.append(
        checklist_entry(
            "rfq_launch",
            "Create your first RFQ or sourcing event",
            "Use Suproc's sourcing workspace to engage suppliers and capture responses.",
            completed=len(rfq_rows) > 0,
            linked_entity_key="suppliers",
        )
    )

    checklist.append(
        checklist_entry(
            "rfp_launch",
            "Publish a project RFP",
            "Track complex projects with structured proposals, evaluation criteria, and scoring.",
            completed=len(rfp_rows) > 0,
            linked_entity_key="projects",
        )
    )

    checklist.append(
        checklist_entry(
            "workspace_navigation",
            "Review each ERP domain",
            "Walk through every domain template to understand which records you can maintain.",
            completed=any(info.get("count", 0) > 0 for info in entity_lookup.values()),
            linked_entity_key=None,
        )
    )

    return checklist
def _ensure_sync_table(user_supabase: Client, table_name: str):
    table_sql = f"""
    CREATE TABLE IF NOT EXISTS public."{table_name}" (
        id uuid PRIMARY KEY,
        user_id text,
        source_project_id uuid,
        title text,
        description text,
        status text,
        budget numeric,
        deadline date,
        total_items integer,
        type text,
        created_at timestamp with time zone DEFAULT now(),
        updated_at timestamp with time zone DEFAULT now(),
        metadata jsonb
    );
    """
    trigger_sql = f"""
    CREATE OR REPLACE FUNCTION public.{table_name}_set_timestamp()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS {table_name}_touch ON public."{table_name}";
    CREATE TRIGGER {table_name}_touch
    BEFORE UPDATE ON public."{table_name}"
    FOR EACH ROW
    EXECUTE PROCEDURE public.{table_name}_set_timestamp();
    """
    rls_sql = f'ALTER TABLE public."{table_name}" ENABLE ROW LEVEL SECURITY;'

    user_supabase.rpc('execute_sql', {'sql_statement': table_sql}).execute()
    user_supabase.rpc('execute_sql', {'sql_statement': trigger_sql}).execute()
    user_supabase.rpc('execute_sql', {'sql_statement': rls_sql}).execute()


def _sync_request_payload(payload: Dict[str, Any]) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    metadata = payload.get("metadata")
    if metadata is None:
        metadata = {}
    record = {
        "id": payload.get("projectId"),
        "source_project_id": payload.get("projectId"),
        "title": payload.get("title"),
        "description": payload.get("description"),
        "status": payload.get("status"),
        "budget": payload.get("budget"),
        "deadline": payload.get("deadline"),
        "total_items": payload.get("totalItems"),
        "type": payload.get("type"),
        "created_at": payload.get("createdAt"),
        "metadata": metadata,
    }
    return record, metadata

# --- Helper Functions ---

def _extract_user_id_from_request() -> str | None:
    """
    Resolve the caller's user/session id in this priority:
    1) X-User-ID header
    2) Cookie 'versatileErpUserId'
    3) Socket.IO environ (for WS events)
    """
    user_id = request.headers.get("X-User-ID")
    if not user_id:
        user_id = request.cookies.get("versatileErpUserId")
    if not user_id:
        sid = getattr(request, "sid", None)
        if sid:
            user_id = socketio.server.environ.get(sid, {}).get("userId")
    return user_id

def get_client_for_request() -> Client:
    """
    Gets a Supabase client using user-provided credentials.
    Users must configure their workspace credentials first.
    """
    session_id = _extract_user_id_from_request()
    if not session_id:
        raise ConnectionRefusedError("Please configure your workspace credentials first.")

    credentials = database_manager.get_user_credentials(session_id)
    if not credentials:
        raise ValueError(f"Workspace credentials not found. Please reconfigure your workspace.")

    return create_client(credentials["supabase_url"], credentials["supabase_key"])

def normalize_supabase_db_url(db_url: str) -> str:
    """
    Normalizes Supabase Postgres URLs so psycopg2 can reliably connect.
    - Ensures username/password are percent-encoded.
    - Defaults to /postgres if no database name is supplied.
    - Forces sslmode=require because Supabase databases expect TLS.
    """
    if not db_url:
        raise ValueError("Supabase DB URL is required.")

    trimmed = db_url.strip()
    parts = urlsplit(trimmed)

    if parts.scheme not in ("postgres", "postgresql"):
        raise ValueError("Supabase DB URL must start with postgresql://")

    username = parts.username
    password = parts.password
    host = parts.hostname or ""
    port = f":{parts.port}" if parts.port else ""

    if password is not None and username is None:
        raise ValueError("Supabase DB URL password is present but username is missing.")

    encoded_userinfo = ""
    if username is not None:
        encoded_userinfo = quote(unquote(username))
        if password is not None:
            encoded_userinfo += f":{quote(unquote(password), safe='')}"
        encoded_userinfo += "@"

    netloc = f"{encoded_userinfo}{host}{port}"
    path = parts.path or "/postgres"

    query_params = dict(parse_qsl(parts.query, keep_blank_values=True))
    query_params.setdefault("sslmode", "require")
    normalized_query = urlencode(query_params)

    return urlunsplit((parts.scheme, netloc, path, normalized_query, parts.fragment))


def run_initial_setup_script(db_url):
    """
    Connects directly to the user's database to execute the initial setup/reset script.
    """
    if not db_url:
        raise ConnectionError("Database URL is not configured.")
    normalized_db_url = normalize_supabase_db_url(db_url)
    sql_script = """
    GRANT ALL ON SCHEMA public TO postgres;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;

    CREATE OR REPLACE FUNCTION get_existing_tables()
    RETURNS TABLE (table_name TEXT) LANGUAGE sql STABLE AS $$
    SELECT tablename::text FROM pg_tables WHERE schemaname = 'public';
    $$;

    CREATE OR REPLACE FUNCTION execute_sql(sql_statement TEXT)
    RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
    BEGIN
        EXECUTE sql_statement;
    END;
    $$;

    CREATE OR REPLACE FUNCTION create_new_entity_table(table_name TEXT, columns_sql TEXT)
    RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
    BEGIN
        EXECUTE format('CREATE TABLE public.%I (%s);', table_name, columns_sql);
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', table_name);
        EXECUTE format('ALTER TABLE public.%I OWNER TO postgres;', table_name);
    END;
    $$;

    ALTER FUNCTION get_existing_tables() OWNER TO postgres;
    ALTER FUNCTION execute_sql(text) OWNER TO postgres;
    ALTER FUNCTION create_new_entity_table(text, text) OWNER TO postgres;

    CREATE TABLE IF NOT EXISTS public.chat_history (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id text NOT NULL,
      role text NOT NULL,
      content text NOT NULL,
      created_at timestamp with time zone DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.user_configurations (
        user_id text PRIMARY KEY NOT NULL,
        industry_id text,
        config_json jsonb NOT NULL,
        created_at timestamp with time zone DEFAULT now(),
        updated_at timestamp with time zone DEFAULT now()
    );

    CREATE OR REPLACE FUNCTION trigger_set_timestamp()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS set_timestamp ON public.user_configurations;
    CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON public.user_configurations
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

    NOTIFY pgrst, 'reload schema';
    """
    try:
        conn = psycopg2.connect(normalized_db_url)
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute(sql_script)
    except psycopg2.OperationalError as exc:
        message = str(exc)
        if "Cannot assign requested address" in message:
            raise ConnectionError(
                "Supabase direct connections use IPv6. Use the Session pooler connection string from your Supabase dashboard (host *.pooler.supabase.com) or enable IPv6 support in your runtime."
            ) from exc
        raise ConnectionError(f"Unable to reach the Supabase database: {message}") from exc
    finally:
        if 'conn' in locals() and conn:
            conn.close()


def ensure_user_configuration_table(user_supabase: Client, user_id: str, retries: int = 5, delay_seconds: float = 1.0):
    """
    PostgREST caches the schema, so right after creating tables we may briefly
    see PGRST205 (table not in schema cache). Retry a few times with a small delay.
    """
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            response = user_supabase.table('user_configurations').select('user_id', count='exact').eq('user_id', user_id).execute()
            return response
        except Exception as exc:
            message = str(exc)
            last_error = exc
            if "PGRST205" in message and attempt < retries - 1:
                time.sleep(delay_seconds)
                continue
            raise
    if last_error:
        raise last_error

# --- Blueprint Definition ---
erp_bp = Blueprint('erp_bp', __name__)

@erp_bp.route("/configure", methods=["POST"])
def configure_workspace():
    # Simplified configuration for ERP-only mode - no auth required
    data = request.json
    url = data.get('supabase_url')
    key = data.get('supabase_key')
    db_url = data.get('supabase_db_url')

    if not all([url, key, db_url]):
        return jsonify({"error": "All Supabase fields are required."}), 400

    try:
        normalized_db_url = normalize_supabase_db_url(db_url)
        existing_workspace = database_manager.find_workspace_by_project(url, normalized_db_url)
        
        # Generate a unique workspace ID if no existing workspace found
        if existing_workspace:
            workspace_id = existing_workspace['id']
        else:
            import uuid
            workspace_id = str(uuid.uuid4())

        database_manager.save_workspace_credentials(workspace_id, url, key, normalized_db_url)

        if not existing_workspace:
            run_initial_setup_script(normalized_db_url)

        user_supabase = create_client(url, key)
        try:
            response = ensure_user_configuration_table(user_supabase, workspace_id)
        except Exception as ensure_error:
            error_message = str(ensure_error)
            if "PGRST205" in error_message:
                run_initial_setup_script(normalized_db_url)
                response = ensure_user_configuration_table(user_supabase, workspace_id)
            else:
                raise
        is_configured = response.count > 0

        return jsonify({
            "status": "ok",
            "message": "Configuration processed successfully.",
            "workspace_id": workspace_id,
            "user_id": workspace_id,
            "is_configured": is_configured
        })
    except Exception as e:
        return jsonify({"error": f"Failed to configure workspace. Details: {e}"}), 500

@erp_bp.route("/workspace", methods=["GET"])
def workspace():
    try:
        industry = request.args.get('industry', 'custom')
        user_id = _extract_user_id_from_request()
        if not user_id:
            return jsonify({"error": "Missing user id"}), 401

        credentials = database_manager.get_user_credentials(user_id)
        if not credentials:
            return jsonify({"error": "Invalid session. Please re-configure your workspace."}), 401

        user_supabase = create_client(credentials["supabase_url"], credentials["supabase_key"])

        config_template_path = INDUSTRY_CONFIGS.get(industry, 'erp_configs/default_erp_config.json')
        absolute_path = SCRIPT_DIR / config_template_path
        with open(absolute_path, 'r') as f:
            config_data = json.load(f)

        user_supabase.table('user_configurations').upsert({
            "user_id": user_id,
            "config_json": json.dumps(config_data),
            "industry_id": industry
        }).execute()

        type_mapping = {
            "text": "text", "textarea": "text", "email": "text", "tel": "text",
            "number": "numeric", "date": "date", "select": "text",
            "boolean": "boolean", "foreign_key": "uuid"
        }

        for domain in config_data.get("domains", []):
            for entity_id, entity_config in domain.get("entities", {}).items():
                fields = entity_config.get("fields", [])
                columns_sql = ['"id" uuid PRIMARY KEY']
                for field in fields:
                    field_name = field.get("name")
                    if field_name and field_name.lower() != 'id':
                        sql_type = type_mapping.get(field.get("type", "text"), "text")
                        columns_sql.append(f'"{field_name}" {sql_type}')
                try:
                    user_supabase.rpc('create_new_entity_table', {
                        'table_name': entity_id,
                        'columns_sql': ', '.join(columns_sql)
                    }).execute()
                except Exception:
                    # table may already exist; continue
                    pass

        return jsonify({"status": "ok", "message": f"Workspace configured for {industry}."})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@erp_bp.route("/config")
def get_config():
    try:
        user_supabase = get_client_for_request()
        user_id = _extract_user_id_from_request()
        response = user_supabase.table('user_configurations').select('config_json').eq('user_id', user_id).single().execute()

        config_data = {"domains": []}
        if response.data and response.data.get('config_json'):
            config_data = response.data['config_json']
            if isinstance(config_data, str):
                config_data = json.loads(config_data)

        return jsonify({"erp_config": config_data})
    except ValueError as exc:
        return jsonify({"erp_config": {"domains": []}, "needs_setup": True, "error": str(exc)}), 404
    except Exception as e:
        if "PGRST116" in str(e) or "single row" in str(e).lower():
            return jsonify({"erp_config": {"domains": []}})
        return jsonify({"error": f"Could not fetch config: {e}"}), 500

@erp_bp.route("/delete", methods=["DELETE"])
def delete_erp_instance():
    user_id = _extract_user_id_from_request()
    try:
        if not user_id:
            return jsonify({"error": "User ID is required."}), 401

        credentials = database_manager.get_user_credentials(user_id)
        if not credentials or not credentials.get("db_url"):
            return jsonify({"status": "ok", "message": "No active ERP instance found to delete."})

        user_db_url = normalize_supabase_db_url(credentials["db_url"])

        tables_to_drop = set()
        try:
            user_supabase = get_client_for_request()
            erp_config = get_config_from_db_secure(user_supabase, user_id)
            for domain in erp_config.get("domains", []):
                for entity_id in domain.get("entities", {}):
                    tables_to_drop.add(entity_id)
        except Exception:
            # fall back to system tables only
            pass

        tables_to_drop.add("user_configurations")
        tables_to_drop.add("chat_history")

        with psycopg2.connect(user_db_url) as conn:
            conn.autocommit = True
            with conn.cursor() as cur:
                for table_name in tables_to_drop:
                    sql_statement = f'DROP TABLE IF EXISTS public."{table_name}" CASCADE;'
                    cur.execute(sql_statement)

        database_manager.delete_user_credentials(user_id)
        return jsonify({"status": "ok", "message": "ERP instance deleted successfully."})

    except Exception as e:
        return jsonify({"error": f"An unexpected error occurred during deletion: {e}"}), 500

@erp_bp.route("/overview", methods=["GET"])
def get_overview_snapshot():
    include_summary = request.args.get("includeSummary", "true").lower() != "false"

    try:
        user_supabase = get_client_for_request()
        user_id = _extract_user_id_from_request()
    except ValueError as exc:
        return jsonify({"error": str(exc), "needs_setup": True}), 400
    except Exception as exc:
        return jsonify({"error": f"Authentication failed: {exc}"}), 401

    metrics_rows: List[Dict[str, Any]] = []
    orders_rows: List[Dict[str, Any]] = []
    rfq_rows: List[Dict[str, Any]] = []
    rfp_rows: List[Dict[str, Any]] = []

    erp_config = get_config_from_db_secure(user_supabase, user_id)

    try:
        metrics_resp = user_supabase.table("business_metrics").select("*").execute()
        if metrics_resp.data:
            metrics_rows = list(metrics_resp.data)
    except Exception:
        metrics_rows = []

    try:
        orders_resp = user_supabase.table("orders").select("*").execute()
        if orders_resp.data:
            orders_rows = list(orders_resp.data)
    except Exception:
        orders_rows = []

    metrics_rows = _filter_rows_for_user(metrics_rows, user_id)
    orders_rows = _filter_rows_for_user(orders_rows, user_id)

    try:
        rfq_resp = user_supabase.table("rfq_requests").select("*").execute()
        if rfq_resp.data:
            rfq_rows = _filter_rows_for_user(list(rfq_resp.data), user_id)
    except Exception:
        rfq_rows = []

    try:
        rfp_resp = user_supabase.table("rfp_requests").select("*").execute()
        if rfp_resp.data:
            rfp_rows = _filter_rows_for_user(list(rfp_resp.data), user_id)
    except Exception:
        rfp_rows = []

    latest_metrics = _latest_row_by_period(metrics_rows)
    entity_stats, entity_lookup, total_entities, populated_entities, total_records, latest_timestamp = _collect_entity_stats(
        user_supabase, erp_config
    )
    onboarding_checklist = _build_onboarding_checklist(
        entity_lookup, erp_config, metrics_rows, orders_rows, rfq_rows, rfp_rows
    )

    unique_suppliers = {
        str(
            order.get("supplier_name")
            or order.get("supplier")
            or order.get("vendor_name")
            or order.get("vendor")
            or order.get("supplier_id")
        )
        for order in orders_rows
        if (
            order.get("supplier_name")
            or order.get("supplier")
            or order.get("vendor_name")
            or order.get("vendor")
            or order.get("supplier_id")
        )
    }
    unique_suppliers.discard("None")
    unique_suppliers.discard("null")
    unique_suppliers.discard("0")

    purchase_expense_totals = _purchase_expense_totals(metrics_rows, orders_rows)

    open_statuses = {"open", "pending", "sourcing", "requested", "draft"}
    pending_rfq = sum(1 for row in rfq_rows if str(row.get("status") or "").lower() in open_statuses)
    pending_rfp = sum(1 for row in rfp_rows if str(row.get("status") or "").lower() in open_statuses)
    total_pending_requests = pending_rfq + pending_rfp

    top_metrics = {
        "revenue": round(
            _safe_number(
                latest_metrics.get("revenue")
                or latest_metrics.get("net_revenue")
                or latest_metrics.get("purchase_total")
                or latest_metrics.get("sales")
                or purchase_expense_totals["purchases"]
            ),
            2,
        ),
        "orders": _safe_int(
            latest_metrics.get("orders")
            or latest_metrics.get("orders_count")
            or latest_metrics.get("order_volume")
            or len(orders_rows)
        ),
        "activeSuppliers": _safe_int(
            latest_metrics.get("active_suppliers")
            or latest_metrics.get("supplier_count")
            or latest_metrics.get("engaged_suppliers")
            or len(unique_suppliers)
        ),
        "pendingTasks": _safe_int(
            latest_metrics.get("pending_tasks")
            or latest_metrics.get("open_tasks")
            or latest_metrics.get("pending_actions")
            or total_pending_requests
        ),
        "performanceIndex": round(
            _safe_number(
                latest_metrics.get("performance_index")
                or latest_metrics.get("performance_score")
                or latest_metrics.get("efficiency_score")
                or latest_metrics.get("project_health")
            ),
            2,
        ),
    }

    monthly_revenue = _compute_month_groups(metrics_rows, "revenue")
    if not monthly_revenue:
        monthly_revenue = _compute_month_groups(metrics_rows, "net_revenue")
    if not monthly_revenue:
        monthly_revenue = _compute_orders_month_groups(orders_rows)

    supplier_totals = defaultdict(float)
    supplier_engagement: List[Dict[str, Any]] = []
    for row in metrics_rows:
        breakdown = (
            row.get("supplier_engagement_breakdown")
            or row.get("supplier_engagement_detail")
            or row.get("supplier_engagement")
        )
        if isinstance(breakdown, dict):
            for name, score in breakdown.items():
                supplier_totals[str(name)] += _safe_number(score)
        elif isinstance(breakdown, list):
            for item in breakdown:
                if isinstance(item, dict):
                    supplier_totals[str(item.get("supplier") or item.get("name") or item.get("label") or "Supplier")] += _safe_number(
                        item.get("score") or item.get("engagement") or item.get("value")
                    )
        elif breakdown is not None:
            supplier_totals["Overall"] += _safe_number(breakdown)

    if supplier_totals:
        supplier_engagement = [
            {"supplier": supplier, "engagement": round(score, 2)}
            for supplier, score in sorted(supplier_totals.items(), key=lambda item: item[1], reverse=True)[:8]
        ]
    else:
        supplier_engagement = [
            {"supplier": item["supplier"], "engagement": item["orders"]}
            for item in _supplier_counts(orders_rows)
        ]

    productivity_trend = _productivity_points(metrics_rows)
    if not productivity_trend and orders_rows:
        completion_buckets: Dict[str, Dict[str, int]] = defaultdict(lambda: {"completed": 0, "total": 0})
        for order in orders_rows:
            date_value = order.get("order_date") or order.get("created_at") or order.get("updated_at")
            parsed_date = _parse_period(date_value)
            if not parsed_date:
                continue
            label = parsed_date.strftime("%Y-%m")
            status = str(order.get("status") or "").lower()
            completion_buckets[label]["total"] += 1
            if status in {"completed", "complete", "fulfilled", "delivered", "closed"}:
                completion_buckets[label]["completed"] += 1

        for label in sorted(completion_buckets.keys()):
            bucket = completion_buckets[label]
            total = bucket["total"]
            completion_ratio = (bucket["completed"] / total * 100) if total else 0.0
            productivity_trend.append({"period": label, "value": round(completion_ratio, 2)})

    response_payload = {
        "topMetrics": top_metrics,
        "monthlyRevenue": monthly_revenue,
        "supplierEngagement": supplier_engagement,
        "purchaseExpenseRatio": purchase_expense_totals,
        "productivityTrend": productivity_trend,
        "aiSummary": None,
        "sourcingActivity": {
            "rfqOpen": pending_rfq,
            "rfqTotal": len(rfq_rows),
            "rfpOpen": pending_rfp,
            "rfpTotal": len(rfp_rows),
        },
    }

    response_payload["entityStats"] = entity_stats
    response_payload["onboardingChecklist"] = onboarding_checklist
    response_payload["dataHealth"] = {
        "totalEntities": total_entities,
        "populatedEntities": populated_entities,
        "totalRecords": total_records,
        "overallScore": round((populated_entities / total_entities) * 100, 1) if total_entities else 0.0,
        "lastUpdated": latest_timestamp,
    }
    response_payload["domainCoverage"] = [
        {
            "domainId": stat["domainId"],
            "domainName": stat["domainName"],
            "totalEntities": stat["totalEntities"],
            "populatedEntities": stat["populatedEntities"],
            "totalRecords": stat["totalRecords"],
        }
        for stat in entity_stats
    ]

    recent_activity: List[Dict[str, Any]] = []
    for row in orders_rows[:12]:
        recent_activity.append(
            {
                "type": "order",
                "description": row.get("order_number") or row.get("title") or "Order created",
                "timestamp": row.get("order_date") or row.get("created_at") or row.get("updated_at"),
                "meta": {"amount": _safe_number(row.get("total_amount") or row.get("amount") or row.get("total", 0))},
            }
        )
    for row in rfq_rows[:12]:
        recent_activity.append(
            {
                "type": "rfq",
                "description": row.get("title") or "RFQ published",
                "timestamp": row.get("created_at") or row.get("updated_at"),
            }
        )
    for row in rfp_rows[:12]:
        recent_activity.append(
            {
                "type": "rfp",
                "description": row.get("title") or "RFP published",
                "timestamp": row.get("created_at") or row.get("updated_at"),
            }
        )
    if metrics_rows:
        recent_activity.append(
            {
                "type": "finance",
                "description": "Financial metrics updated",
                "timestamp": metrics_rows[0].get("created_at") or metrics_rows[0].get("period_end"),
            }
        )

    response_payload["recentActivity"] = sorted(
        [item for item in recent_activity if item.get("timestamp")],
        key=lambda item: item["timestamp"],
        reverse=True,
    )[:12]

    if include_summary:
        try:
            summary_context = json.dumps(response_payload, default=lambda o: o if isinstance(o, (int, float, str, list, dict)) else str(o))
            messages = [
                {
                    "role": "system",
                    "content": "You are an ERP business analyst who writes concise executive summaries about operational health.",
                },
                {
                    "role": "user",
                    "content": (
                        "Analyse the following JSON payload of ERP dashboard metrics and craft a short narrative (2-3 paragraphs) "
                        "highlighting financial performance, supplier engagement, operational efficiency, and any risks. "
                        "Keep it under 160 words and use plain language. JSON:\n"
                        f"{summary_context}"
                    ),
                },
            ]
            summary_response = openai.chat.completions.create(
                model=OPENAI_CHAT_MODEL,
                messages=messages,
                temperature=0.4,
                max_tokens=220,
            )
            summary_text = summary_response.choices[0].message.content.strip()
            response_payload["aiSummary"] = summary_text
        except Exception as exc:
            response_payload["aiSummary"] = f"Could not generate AI summary: {exc}"

    return jsonify(response_payload)


def _sync_sourcing_request(table_name: str, expected_type: str):
    try:
        user_supabase = get_client_for_request()
        user_id = _extract_user_id_from_request()
        payload = request.json or {}

        project_id = payload.get("projectId")
        if not project_id:
            return jsonify({"error": "projectId is required."}), 400

        if not payload.get("type"):
            payload["type"] = expected_type

        record, metadata = _sync_request_payload(payload)
        record["user_id"] = user_id
        record["budget"] = _safe_number(record.get("budget")) if record.get("budget") is not None else None
        record["total_items"] = _safe_int(record.get("total_items")) if record.get("total_items") is not None else None
        if not record.get("deadline"):
            record["deadline"] = None
        record["created_at"] = record.get("created_at") or datetime.utcnow().isoformat()
        record["updated_at"] = datetime.utcnow().isoformat()
        record["metadata"] = metadata

        _ensure_sync_table(user_supabase, table_name)
        user_supabase.table(table_name).upsert(record).execute()
        socketio.emit('data_changed', {'entity_id': table_name})
        return jsonify({"status": "ok"})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@erp_bp.route("/sync/rfq", methods=["POST"])
def sync_rfq_request():
    return _sync_sourcing_request("rfq_requests", "RFQ")


@erp_bp.route("/sync/rfp", methods=["POST"])
def sync_rfp_request():
    return _sync_sourcing_request("rfp_requests", "RFP")

@erp_bp.route("/data/<entity_id>", methods=["GET"])
def get_entity_records(entity_id):
    try:
        user_supabase = get_client_for_request()
        response = user_supabase.table(entity_id).select("*").execute()
        return jsonify(response.data)
    except Exception as e:
        return jsonify({"error": str(e), "data": []}), 400

@erp_bp.route("/data/<entity_id>", methods=["POST"])
def create_entity_record(entity_id):
    try:
        user_supabase = get_client_for_request()
        user_id = _extract_user_id_from_request()
        payload = _normalize_record_payload(user_supabase, user_id, entity_id, request.json)
        if 'id' not in payload or not payload.get('id'):
            payload["id"] = str(uuid.uuid4())
        try:
            response = user_supabase.table(entity_id).insert(payload).execute()
        except Exception as exc:
            message = str(exc)
            if "violates row-level security policy" in message:
                _ensure_allow_all_policy(user_supabase, entity_id)
                response = user_supabase.table(entity_id).insert(payload).execute()
            else:
                raise
        socketio.emit('data_changed', {'entity_id': entity_id})
        return jsonify({"status": "ok", "data": response.data[0]})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@erp_bp.route("/data/<entity_id>/<record_id>", methods=["PUT"])
def update_entity_record(entity_id, record_id):
    try:
        user_supabase = get_client_for_request()
        user_id = _extract_user_id_from_request()
        payload = _normalize_record_payload(user_supabase, user_id, entity_id, request.json)
        try:
            response = user_supabase.table(entity_id).update(payload).eq('id', record_id).execute()
        except Exception as exc:
            message = str(exc)
            if "violates row-level security policy" in message:
                _ensure_allow_all_policy(user_supabase, entity_id)
                response = user_supabase.table(entity_id).update(payload).eq('id', record_id).execute()
            else:
                raise
        socketio.emit('data_changed', {'entity_id': entity_id})
        if response.data:
            return jsonify({"status": "ok", "data": response.data[0]})
        return jsonify({"error": "Record not found or no changes made"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@erp_bp.route("/data/<entity_id>/<record_id>", methods=["DELETE"])
def delete_entity_record(entity_id, record_id):
    try:
        user_supabase = get_client_for_request()
        user_supabase.table(entity_id).delete().eq('id', record_id).execute()
        socketio.emit('data_changed', {'entity_id': entity_id})
        return jsonify({"status": "ok", "id": record_id})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- Schema Customization ---
def get_config_from_db_secure(user_supabase, user_id):
    try:
        response = user_supabase.table('user_configurations').select('config_json').eq('user_id', user_id).single().execute()
        if not response.data or not response.data.get('config_json'):
            return {"domains": []}
        config_data = response.data['config_json']
        return json.loads(config_data) if isinstance(config_data, str) else config_data
    except Exception as exc:
        message = str(exc)
        if "PGRST116" in message or "single row" in message.lower():
            return {"domains": []}
        raise


def _find_entity_config(erp_config: Dict[str, Any], entity_id: str) -> Dict[str, Any] | None:
    for domain in erp_config.get("domains", []):
        entities = domain.get("entities", {})
        if entity_id in entities:
            return entities[entity_id]
    return None


def _normalize_record_payload(
    user_supabase: Client,
    user_id: str,
    entity_id: str,
    payload: Dict[str, Any] | None,
) -> Dict[str, Any]:
    if not isinstance(payload, dict):
        return {}

    cleaned_payload: Dict[str, Any] = {}

    try:
        erp_config = get_config_from_db_secure(user_supabase, user_id)
    except Exception:
        erp_config = {"domains": []}

    entity_config = _find_entity_config(erp_config, entity_id) or {}
    field_lookup = {field.get("name"): field for field in entity_config.get("fields", []) if field.get("name")}

    for key, value in payload.items():
        if isinstance(value, str):
            value = value.strip()
        if value == "":
            cleaned_payload[key] = None
            continue

        field = field_lookup.get(key)
        if not field:
            cleaned_payload[key] = value
            continue

        field_type = field.get("type", "text")
        if field_type in ("number", "numeric"):
            try:
                cleaned_payload[key] = float(value)
            except (TypeError, ValueError):
                cleaned_payload[key] = value
        elif field_type in ("boolean", "checkbox"):
            cleaned_payload[key] = str(value).lower() in ("true", "1", "yes", "on")
        else:
            cleaned_payload[key] = value

    return cleaned_payload


def _ensure_allow_all_policy(user_supabase: Client, table_name: str) -> None:
    policy_sql = f"""
    DO $policy$
    BEGIN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_policies
            WHERE schemaname = 'public'
              AND tablename = '{table_name}'
              AND policyname = 'allow_all'
        ) THEN
            EXECUTE 'CREATE POLICY "allow_all" ON public."{table_name}" FOR ALL USING (true) WITH CHECK (true);';
        END IF;
    END;
    $policy$;
    """
    user_supabase.rpc('execute_sql', {'sql_statement': policy_sql}).execute()

def save_config_to_db_secure(user_supabase, user_id, config_data):
    user_supabase.table('user_configurations').upsert({
        "user_id": user_id,
        "config_json": json.dumps(config_data)
    }).execute()

@erp_bp.route("/domains", methods=["POST"])
def add_domain():
    try:
        user_supabase = get_client_for_request()
        user_id = _extract_user_id_from_request()
        erp_config = get_config_from_db_secure(user_supabase, user_id)
        data = request.json
        domain_name = data.get('name')
        if not domain_name:
            return jsonify({"error": "Domain name is required"}), 400
        new_domain = {"id": domain_name.replace(" ", ""), "name": domain_name, "entities": {}}
        erp_config["domains"].append(new_domain)
        save_config_to_db_secure(user_supabase, user_id, erp_config)
        socketio.emit('config_changed')
        return jsonify(new_domain), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@erp_bp.route("/domains/<domain_id>", methods=["DELETE"])
def delete_domain(domain_id):
    try:
        user_supabase = get_client_for_request()
        user_id = _extract_user_id_from_request()
        erp_config = get_config_from_db_secure(user_supabase, user_id)
        domain_to_delete = next((d for d in erp_config['domains'] if d['id'] == domain_id), None)
        if not domain_to_delete:
            return jsonify({"error": "Domain not found"}), 404
        for entity_id in domain_to_delete.get("entities", {}):
            try:
                user_supabase.rpc('execute_sql', {'sql_statement': f'DROP TABLE IF EXISTS public."{entity_id}";'}).execute()
            except Exception:
                pass
        erp_config['domains'] = [d for d in erp_config['domains'] if d['id'] != domain_id]
        save_config_to_db_secure(user_supabase, user_id, erp_config)
        socketio.emit('config_changed')
        return jsonify({"status": "ok"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@erp_bp.route("/domains/<domain_id>", methods=["PUT"])
def edit_domain(domain_id):
    try:
        user_supabase = get_client_for_request()
        user_id = _extract_user_id_from_request()
        erp_config = get_config_from_db_secure(user_supabase, user_id)
        new_name = request.json.get('name')
        domain_to_edit = next((d for d in erp_config['domains'] if d['id'] == domain_id), None)
        if not domain_to_edit:
            return jsonify({"error": "Domain not found"}), 404
        domain_to_edit['name'] = new_name
        save_config_to_db_secure(user_supabase, user_id, erp_config)
        socketio.emit('config_changed')
        return jsonify(domain_to_edit), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@erp_bp.route("/domains/<domain_id>/entities", methods=["POST"])
def add_entity_to_domain(domain_id):
    try:
        user_supabase = get_client_for_request()
        user_id = _extract_user_id_from_request()
        erp_config = get_config_from_db_secure(user_supabase, user_id)
        data = request.json
        entity_label, fields = data.get('label'), data.get('fields')
        entity_id = entity_label.replace(" ", "")

        if not entity_label or not isinstance(fields, list) or len(fields) == 0:
            return jsonify({"error": "Entity label and at least one field are required."}), 400

        seen_columns: set[str] = set()

        type_mapping = {"text": "text", "textarea": "text", "email": "text", "tel": "text",
                        "number": "numeric", "date": "date", "select": "text"}
        columns_sql = ['"id" uuid PRIMARY KEY']
        for field in fields:
            raw_name = (field.get("name") or "").strip()
            if not raw_name:
                return jsonify({"error": "Each field needs a unique name."}), 400

            normalized_name = raw_name.lower()
            if normalized_name == 'id':
                continue

            if normalized_name in seen_columns:
                return jsonify({"error": f'Duplicate field name "{raw_name}" in entity definition.'}), 400

            seen_columns.add(normalized_name)
            sql_type = type_mapping.get(field.get("type", "text"), "text")
            columns_sql.append(f'"{raw_name}" {sql_type}')

        user_supabase.rpc('create_new_entity_table', {'table_name': entity_id, 'columns_sql': ', '.join(columns_sql)}).execute()
        _ensure_allow_all_policy(user_supabase, entity_id)

        domain = next((d for d in erp_config['domains'] if d['id'] == domain_id), None)
        if not any(f['name'] == 'id' for f in fields):
            fields.insert(0, {"name": "id", "label": "ID", "type": "text", "read_only": True})
        domain['entities'][entity_id] = {"label": entity_label, "fields": fields}
        save_config_to_db_secure(user_supabase, user_id, erp_config)
        socketio.emit('config_changed')
        return jsonify(domain['entities'][entity_id]), 201
    except Exception as e:
        return jsonify({"error": f"Failed to create entity: {e}"}), 500

@erp_bp.route("/domains/<domain_id>/entities/<entity_id>", methods=["PUT"])
def update_entity(domain_id, entity_id):
    try:
        user_supabase = get_client_for_request()
        user_id = _extract_user_id_from_request()
        erp_config = get_config_from_db_secure(user_supabase, user_id)
        domain = next((d for d in erp_config['domains'] if d['id'] == domain_id), None)
        if not domain or entity_id not in domain['entities']:
            return jsonify({"error": "Entity not found"}), 404

        new_entity_data = request.json
        old_fields = {f['name']: f for f in domain['entities'][entity_id].get('fields', [])}
        new_fields = {f['name']: f for f in new_entity_data.get('fields', [])}
        fields_to_add = set(new_fields.keys()) - set(old_fields.keys())
        fields_to_drop = set(old_fields.keys()) - set(new_fields.keys())

        type_mapping = {"text": "text", "textarea": "text", "number": "numeric", "date": "date", "boolean": "boolean"}

        # Handle added fields (with required/defaults)
        for field_name in fields_to_add:
            field_data = new_fields[field_name]
            col_type = type_mapping.get(field_data.get('type', 'text'), 'text')
            sql_statement = f'ALTER TABLE public."{entity_id}" ADD COLUMN "{field_name}" {col_type}'
            if field_data.get('required'):
                default_value = field_data.get('defaultValue', '')
                if col_type in ['text', 'date']:
                    sql_statement += f" DEFAULT '{default_value}' NOT NULL"
                elif col_type == 'boolean':
                    sql_statement += f" DEFAULT {'true' if str(default_value).lower() == 'true' else 'false'} NOT NULL"
                else:  # numeric
                    try:
                        dv = float(default_value)
                    except Exception:
                        dv = 0
                    sql_statement += f" DEFAULT {dv} NOT NULL"
            user_supabase.rpc('execute_sql', {'sql_statement': sql_statement}).execute()

        # Drop removed fields
        for field_name in fields_to_drop:
            user_supabase.rpc('execute_sql', {'sql_statement': f'ALTER TABLE public."{entity_id}" DROP COLUMN IF EXISTS "{field_name}";'}).execute()

        domain['entities'][entity_id] = new_entity_data
        save_config_to_db_secure(user_supabase, user_id, erp_config)
        socketio.emit('config_changed')
        return jsonify({"status": "ok", "data": new_entity_data})
    except Exception as e:
        return jsonify({"error": f"Failed to update entity: {e}"}), 500

@erp_bp.route("/domains/<domain_id>/entities/<entity_id>", methods=["DELETE"])
def delete_entity(domain_id, entity_id):
    try:
        user_supabase = get_client_for_request()
        user_id = _extract_user_id_from_request()
        erp_config = get_config_from_db_secure(user_supabase, user_id)
        domain = next((d for d in erp_config['domains'] if d['id'] == domain_id), None)
        if not domain or entity_id not in domain['entities']:
            return jsonify({"error": "Entity not found"}), 404
        user_supabase.rpc('execute_sql', {'sql_statement': f'DROP TABLE IF EXISTS public."{entity_id}";'}).execute()
        del domain['entities'][entity_id]
        save_config_to_db_secure(user_supabase, user_id, erp_config)
        socketio.emit('config_changed')
        return jsonify({"status": "ok"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- AI Endpoints ---

def get_all_erp_data(user_supabase, user_id):
    erp_config = get_config_from_db_secure(user_supabase, user_id)
    full_state = {}
    for domain_config in erp_config.get("domains", []):
        for entity_id in domain_config.get("entities", {}):
            try:
                response = user_supabase.table(entity_id).select("*", count='exact').execute()
                full_state[entity_id] = response.data
            except Exception:
                full_state[entity_id] = []
    return full_state

@erp_bp.route("/ai/report", methods=["POST"])
def handle_ai_report():
    """
    Generate a Markdown report using OpenAI based on full ERP data.
    """
    try:
        user_id = _extract_user_id_from_request()
        if not user_id:
            return jsonify({"error": "Missing user id"}), 401

        creds = database_manager.get_user_credentials(user_id)
        if not creds:
            return jsonify({"error": "Invalid session or missing workspace credentials."}), 401

        user_supabase = create_client(creds["supabase_url"], creds["supabase_key"])

        body = request.get_json(silent=True) or {}
        user_query = (body.get("query") or "").strip()
        if not user_query:
            return jsonify({"error": "Query is required."}), 400

        current_erp_data = get_all_erp_data(user_supabase, user_id)

        reporting_prompt = f"""
You are an expert data analyst and auditor for a corporate ERP system. Produce a clear, insightful Markdown report that directly answers the user's query using the provided data.

Requirements:
1) Accurate and data-driven. Use only the data below.
2) Well-structured Markdown (headings, tables, bullet points).
3) Compute useful metrics (totals, counts, averages) when relevant.
4) Proactively call out anomalies/outliers and suggest implications.

User Query: "{user_query}"

Full ERP Data (JSON):
{json.dumps(current_erp_data, indent=2, default=str)}

Begin the report now.
        """.strip()

        completion = openai.chat.completions.create(
            model=OPENAI_CHAT_MODEL,
            messages=[
                {"role": "system", "content": "You are an expert data analyst and auditor for an ERP system."},
                {"role": "user", "content": reporting_prompt}
            ],
            temperature=0.1,
        )
        report_content = completion.choices[0].message.content
        return jsonify({"report": report_content})
    except Exception as e:
        return jsonify({"error": f"An unexpected error occurred: {e}"}), 500

# --- SocketIO Chat Logic ---

def get_chatbot_system_prompt(user_supabase, user_id):
    json_instruction = """
When you answer, you MUST return *only* valid JSON matching the schema below.
Never add explanations outside the JSON block.

Schema:
{
  "intent": "The user's goal. Must be one of: 'create', 'list', 'delete', 'update', 'describe_entity', 'incomplete_create', 'question'",
  "entity": "The relevant entity ID (e.g., 'BillofMaterials', 'domain', 'entity').",
  "payload": { "key": "value" }
}
"""
    config_context = f"## ERP Schema (The Definitive Source of Truth)\n{json.dumps(get_config_from_db_secure(user_supabase, user_id), indent=2)}"
    data_context = f"## Sample of Existing Data (For Context on Updates/Deletes)\n{json.dumps(get_all_erp_data(user_supabase, user_id), indent=2, default=str)}"

    return f"""
You are an AI assistant inside an ERP application. Your primary job is to translate natural language into structured JSON actions.

--- How to Guide Users (Schema Management) ---
If the user asks how to perform actions related to changing the ERP structure (domains or entities), your intent MUST be 'question'. Your response should guide them on how to use the user interface.
- To create a new Domain: "To create a new Domain, click the `+ New Domain` button at the top of the left sidebar."
- To delete a Domain: "You can delete a domain by hovering over its name in the sidebar, clicking the three-dots menu that appears, and then selecting the `Delete Domain` option. Please be aware that this action is permanent and will delete all entities and data within it."
- To create a new Entity: "To create a new Entity within a domain, click the large `+ Add New Entity` button."
- To edit an Entity: "You can edit an entity's fields by clicking the three-dots menu next to the `+ Add New` button for that entity, and then choosing `Edit Entity`."

--- EXAMPLES ---
- User Query: "how do I add a new domain?"
- Your JSON Response:
  ```json
  {{
    "intent": "question",
    "entity": "domain",
    "payload": {{
      "response": "To create a new Domain, click the `+ New Domain` button at the top of the left sidebar."
    }}
  }}
   - **User Query 2:** "add a record in bill of materials"
   - **Your JSON Response 2 (Incomplete):**
     ```json
     {{
       "intent": "incomplete_create",
       "entity": "BillofMaterials",
       "payload": {{ "missing_fields": ["item", "quantity", "uom"] }}
     }}
     ```
   - **User Query 3:** "New job card for WO-001, operation is Assembly, status is Pending, and the start date is 03-08-2025."
   - **Your JSON Response 3 (Complete with Date):**
     ```json
     {{
       "intent": "create",
       "entity": "JobCard",
       "payload": {{
         "work_order": "WO-001",
         "operation": "Assembly",
         "status": "Pending",
         "actual_start_date": "03-08-2025"
       }}
     }}
     **2. For `update` or `delete` intents (VERY IMPORTANT):**
   - Users will identify records using human-readable text (e.g., a work order number or item name), NOT the database UUID `id`.
   - Your first job is to find the correct record in the 'Sample of Existing Data' to get its UUID `id`.
   - You MUST include this UUID `id` in the `payload` of your final JSON response. The action will fail without it.
   --- UPDATE/DELETE EXAMPLE ---
   - **Sample Data Context:**
     ```json
     {{
       "WorkOrder": [
         {{ "id": "a1b2c3d4-e5f6-7890-a1b2-c3d4e5f67890", "work_order": "WO-2025-001", "status": "Planned" }}
       ]
     }}
     ```
   - **User Query:** "Update the status of work order WO-2025-001 to 'In Progress'."
   - **Your JSON Response (after finding the ID from the context):**
     ```json
     {{
       "intent": "update",
       "entity": "WorkOrder",
       "payload": {{
         "id": "a1b2c3d4-e5f6-7890-a1b2-c3d4e5f67890",
         "status": "In Progress"
       }}
     }}
     ```
   ---
**2. When the user wants to UPDATE or DELETE a record:**
   - Your goal is to identify an EXISTING row to modify. Use the 'Sample of Existing Data' for context.
{json_instruction}
--- System Context ---
{config_context}
{data_context}
"""

def format_dates_in_payload(user_supabase, user_id, entity_id, payload):
    try:
        erp_config = get_config_from_db_secure(user_supabase, user_id)
        domain = next((d for d in erp_config['domains'] if entity_id in d.get('entities', {})), None)
        if not domain:
            return payload
        entity_config = domain['entities'][entity_id]
        date_fields = {field['name'] for field in entity_config.get('fields', []) if field.get('type') == 'date'}
        if not date_fields:
            return payload

        for field_name, value in payload.items():
            if field_name in date_fields and isinstance(value, str) and value:
                try:
                    dt_object = datetime.strptime(value, '%d-%m-%Y')
                except ValueError:
                    try:
                        dt_object = datetime.strptime(value, '%d-%m-%y')
                    except ValueError:
                        continue
                payload[field_name] = dt_object.strftime('%Y-%m-%d')
    except Exception:
        pass
    return payload

def execute_ai_action(user_supabase, user_id, action: dict):
    try:
        intent = action.get("intent")
        entity = action.get("entity")
        payload = action.get("payload") or {}

        if not intent or not entity:
            return f"AI response missing required fields (intent, entity): {json.dumps(action)}"

        if intent == "create":
            if not payload:
                return "Cannot create: payload is empty."
            payload = format_dates_in_payload(user_supabase, user_id, entity, payload)
            if 'id' not in payload:
                payload["id"] = str(uuid.uuid4())
            response = user_supabase.table(entity).insert(payload).execute()
            socketio.emit('data_changed', {'entity_id': entity})
            return f"Created new {entity} with ID: {response.data[0]['id']}"

        elif intent == "update":
            record_id = payload.get("id")
            if not record_id:
                return "Cannot update: 'id' is missing from payload. Please specify which record to update."

            update_data = format_dates_in_payload(user_supabase, user_id, entity, payload)
            update_data = {k: v for k, v in update_data.items() if k != 'id'}
            if not update_data:
                return "Cannot update: No fields to update were provided in the payload."

            response = user_supabase.table(entity).update(update_data).eq('id', record_id).execute()
            if not response.data:
                return f"Could not find a record with ID '{record_id}' in '{entity}' to update."

            socketio.emit('data_changed', {'entity_id': entity})
            return f"Updated {entity} record: {record_id}"

        elif intent == "delete":
            record_id = payload.get("id")
            if not record_id:
                return "Cannot delete: 'id' is missing from payload."
            user_supabase.table(entity).delete().eq('id', record_id).execute()
            socketio.emit('data_changed', {'entity_id': entity})
            return f"Deleted {entity} record: {record_id}"

        elif intent == "list":
            response = user_supabase.table(entity).select("*").limit(10).execute()
            formatted_data = json.dumps(response.data, indent=2, default=str)
            return f"Listing up to 10 records from {entity}:\n```json\n{formatted_data}\n```"

        elif intent == "describe_entity":
            erp_config = get_config_from_db_secure(user_supabase, user_id)
            domain = next((d for d in erp_config['domains'] if entity in d.get('entities', {})), None)
            if not domain:
                return f"I couldn't find an entity named '{entity}' in the ERP configuration."
            entity_config = domain['entities'][entity]
            fields = entity_config.get("fields", [])
            field_list = [f"`{field['name']}` ({field['label']}, type: {field['type']})" for field in fields]
            response_text = f"The '{entity_config['label']}' entity has the following fields:\n- " + "\n- ".join(field_list)
            return response_text

        else:
            return f"Action '{intent}' is not yet supported by execute_ai_action."
    except Exception as e:
        return f"Error executing action '{intent}': {e}"

def handle_ai_interaction(user_supabase, action: dict, user_id: str):
    intent = action.get("intent")

    if intent in ["create", "update", "delete", "list", "describe_entity"]:
        return execute_ai_action(user_supabase, user_id, action)
    elif intent == "incomplete_create":
        entity = action.get("entity")
        payload = action.get("payload", {})
        missing_fields = payload.get("missing_fields", [])
        if not entity or not missing_fields:
            return "I'm not sure which item you want to create or what information is missing. Could you please clarify?"
        missing_list = ", ".join([f"'{field}'" for field in missing_fields])
        return f"I can create a new '{entity}' for you, but I need a bit more information. Please provide the following: {missing_list}."
    elif intent == "question":
        payload = action.get("payload", {})
        response = payload.get("response")
        return response or "I'm not sure how to answer that. Could you try rephrasing your question?"
    else:
        if isinstance(action, str):
            return action
        return "I'm sorry, I didn't understand that. Could you please rephrase your request?"

@socketio.on("chat_message")
def handle_chat(data):
    user_message = data.get("message")
    user_id = data.get("userId")
    if not all([user_message, user_id]):
        socketio.emit("ai_reply", {"text": "Error: Message or User ID is missing."})
        return

    socketio.server.environ.setdefault(request.sid, {})
    socketio.server.environ[request.sid]['userId'] = user_id

    try:
        user_supabase = get_client_for_request()
        history_response = user_supabase.table('chat_history').select('role, content').eq('user_id', user_id).order('created_at', desc=False).limit(10).execute()
        chat_history = history_response.data

        system_prompt = get_chatbot_system_prompt(user_supabase, user_id)
        messages = [{"role": "system", "content": system_prompt}] + chat_history + [{"role": "user", "content": user_message}]

        completion = openai.chat.completions.create(
            model=OPENAI_CHAT_MODEL,
            messages=messages,
            response_format={"type": "json_object"},
        )
        action = json.loads(completion.choices[0].message.content)

        ai_reply_text = handle_ai_interaction(user_supabase, action, user_id)

        user_supabase.table('chat_history').insert([
            {'user_id': user_id, 'role': 'user', 'content': user_message},
            {'user_id': user_id, 'role': 'assistant', 'content': ai_reply_text}
        ]).execute()

        socketio.emit("ai_reply", {"text": ai_reply_text})
    except Exception as e:
        socketio.emit("ai_reply", {"text": f"An error occurred: {e}"})
