import os
import uuid
from cryptography.fernet import Fernet
from supabase import create_client, Client
from dotenv import load_dotenv
from typing import Optional
# Load environment variables from .env file
load_dotenv()

# --- MASTER DATABASE AND ENCRYPTION SETUP (OPTIONAL FOR ERP-ONLY MODE) ---
MASTER_URL = os.environ.get("MASTER_SUPABASE_URL")
MASTER_KEY = os.environ.get("MASTER_SUPABASE_KEY")
ENCRYPTION_KEY = os.environ.get("APP_ENCRYPTION_KEY")

# Initialize master Supabase client only if credentials are provided
master_supabase: Client = None
cipher_suite = None

if MASTER_URL and MASTER_KEY:
    master_supabase = create_client(MASTER_URL, MASTER_KEY)
    print("[INFO] Master Supabase client initialized")
else:
    print("[WARNING] MASTER_SUPABASE_URL and MASTER_SUPABASE_KEY not set - master database features disabled")

if ENCRYPTION_KEY:
    cipher_suite = Fernet(ENCRYPTION_KEY.encode())
else:
    print("[WARNING] APP_ENCRYPTION_KEY not set - encryption disabled")

# --- In-memory storage for ERP-only mode (when no master database) ---
_workspace_credentials = {}

# --- CORE FUNCTIONS (SIMPLIFIED) ---

def save_workspace_credentials(workspace_id: str, user_supabase_url: str, user_supabase_key: str, user_db_url: str):
    """
    Saves or updates a workspace's credentials.
    Uses master database if available, otherwise stores in memory.
    """
    try:
        if master_supabase:
            # Use master database
            master_supabase.table('workspaces').upsert({
                'id': workspace_id,
                'encrypted_supabase_url': user_supabase_url,
                'encrypted_supabase_key': user_supabase_key,
                'encrypted_db_url': user_db_url
            }).execute()
            print(f"Successfully saved credentials for workspace: {workspace_id}")
        else:
            # Use in-memory storage
            _workspace_credentials[workspace_id] = {
                'supabase_url': user_supabase_url,
                'supabase_key': user_supabase_key,
                'db_url': user_db_url
            }
            print(f"Successfully saved credentials in memory for workspace: {workspace_id}")
        return workspace_id
    except Exception as e:
        print(f"ERROR in save_workspace_credentials: {e}")
        raise

def find_workspace_by_project(supabase_url: str | None, db_url: str | None) -> Optional[dict]:
    """
    Returns a workspace record that matches the provided Supabase project credentials.
    """
    try:
        if master_supabase:
            # Search in master database
            if db_url:
                response = master_supabase.table('workspaces').select('*').eq('encrypted_db_url', db_url).limit(1).execute()
                if response.data:
                    return response.data[0]
            if supabase_url:
                response = master_supabase.table('workspaces').select('*').eq('encrypted_supabase_url', supabase_url).limit(1).execute()
                if response.data:
                    return response.data[0]
        else:
            # Search in memory
            for wid, creds in _workspace_credentials.items():
                if (db_url and creds.get('db_url') == db_url) or (supabase_url and creds.get('supabase_url') == supabase_url):
                    return {'id': wid, **creds}
        return None
    except Exception as e:
        print(f"ERROR in find_workspace_by_project: {e}")
        return None

def get_user_credentials(workspace_id: str) -> Optional[dict]:
    """
    Retrieves stored credentials for the workspace identifier.
    """    
    if not workspace_id:
        raise ValueError("Workspace ID cannot be empty.")
        
    try:
        if master_supabase:
            # Get from master database
            response = master_supabase.table('workspaces').select('*').eq('id', workspace_id).single().execute()
            
            if not response.data:
                return None

            record = response.data
            
            return {
                "supabase_url": record['encrypted_supabase_url'],
                "supabase_key": record['encrypted_supabase_key'],
                "db_url": record['encrypted_db_url']
            }
        else:
            # Get from memory
            return _workspace_credentials.get(workspace_id)
    except Exception as e:
        print(f"ERROR in get_user_credentials for workspace {workspace_id}: {e}")
        return None

def delete_user_credentials(workspace_id: str):
    """
    Deletes stored credentials for a workspace.
    """
    try:
        if master_supabase:
            master_supabase.table('workspaces').delete().eq('id', workspace_id).execute()
            print(f"Deleted credentials for workspace: {workspace_id}")
        else:
            if workspace_id in _workspace_credentials:
                del _workspace_credentials[workspace_id]
                print(f"Deleted in-memory credentials for workspace: {workspace_id}")
    except Exception as e:
        print(f"ERROR in delete_user_credentials: {e}")
        raise
    """
    Deletes a workspace's credentials from the master database.
    This is a critical step in the ERP deletion process.
    """
    try:
        master_supabase.table('workspaces').delete().eq('id', workspace_id).execute()
        print(f"Successfully deleted credentials for workspace: {workspace_id}")
    except Exception as e:
        print(f"ERROR in delete_user_credentials for workspace {workspace_id}: {e}")
        raise
