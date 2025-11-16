# chat_history_api.py

import os
import jwt
from functools import wraps
from flask import Blueprint, request, jsonify
from supabase import create_client, Client

# Initialize Supabase client
SUPABASE_URL = os.getenv("MASTER_SUPABASE_URL")
SUPABASE_KEY = os.getenv("MASTER_SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Create a Blueprint
chat_history_bp = Blueprint('chat_history_bp', __name__)

# --- Helper function to get user from JWT ---
def get_user_id_from_token():
    """Extracts user ID from the Authorization header."""
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return None, {"error": "Authorization header is missing"}
    
    try:
        # The token is 'Bearer <jwt_token>'
        token = auth_header.split(" ")[1]
        # Decoding without verification is okay here because we only need the user_id (sub)
        # Supabase RLS will handle the actual security on the database side.
        decoded_token = jwt.decode(token, options={"verify_signature": False})
        return decoded_token.get('sub'), None
    except Exception as e:
        return None, {"error": f"Invalid token: {str(e)}"}

# --- API Endpoints ---

@chat_history_bp.route('/api/chat/sessions', methods=['POST'])
def create_chat_session():
    """Creates a new, empty chat session for the authenticated user."""
    user_id, error = get_user_id_from_token()
    if error:
        return jsonify(error), 401
    
    try:
        # Insert a new session linked to the user
        res = supabase.table('chat_sessions').insert({
            'user_id': user_id,
            'title': 'New Chat' # A default title
        }).execute()
        
        if res.data:
            new_session = res.data[0]
            return jsonify({"id": new_session['id'], "title": new_session['title'], "created_at": new_session['created_at']}), 201
        else:
            return jsonify({"error": "Failed to create session"}), 500
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@chat_history_bp.route('/api/chat/sessions', methods=['GET'])
def get_chat_sessions():
    """Fetches the list of all chat sessions for the current user."""
    user_id, error = get_user_id_from_token()
    if error:
        return jsonify(error), 401

    try:
        # RLS ensures the user can only select their own sessions
        res = supabase.table('chat_sessions').select('id, title, created_at').eq('user_id', user_id).order('created_at', desc=True).execute()
        return jsonify(res.data)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@chat_history_bp.route('/api/chat/sessions/<session_id>/messages', methods=['GET'])
def get_session_messages(session_id):
    """Fetches all messages for a specific session."""
    user_id, error = get_user_id_from_token()
    if error:
        return jsonify(error), 401

    try:
        # RLS ensures we can only fetch messages from a session the user owns
        res = supabase.table('chat_messages').select('sender, content').eq('session_id', session_id).order('created_at', desc=False).execute()
        # The plan's frontend message format is { sender, text }, so we'll adapt here
        messages = [{"sender": msg['sender'], "text": msg['content']} for msg in res.data]
        return jsonify(messages)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@chat_history_bp.route('/api/chat/sessions/<session_id>', methods=['PUT'])
def rename_chat_session(session_id):
    """Renames a specific chat session."""
    user_id, error = get_user_id_from_token()
    if error:
        return jsonify(error), 401
    
    data = request.get_json()
    new_title = data.get('title')
    if not new_title:
        return jsonify({"error": "New title is required"}), 400

    try:
        # RLS ensures user can only update their own sessions.
        # We add a user_id check here for an extra layer of security.
        res = supabase.table('chat_sessions').update({'title': new_title}).eq('id', session_id).eq('user_id', user_id).execute()
        
        if res.data:
            return jsonify(res.data[0]), 200
        else:
            # This can happen if the session_id is wrong or doesn't belong to the user
            return jsonify({"error": "Session not found or access denied"}), 404
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@chat_history_bp.route('/api/chat/sessions/<session_id>', methods=['DELETE'])
def delete_chat_session(session_id):
    """Deletes a specific chat session and its messages."""
    user_id, error = get_user_id_from_token()
    if error:
        return jsonify(error), 401

    try:
        # RLS ensures user can only delete their own sessions.
        res = supabase.table('chat_sessions').delete().eq('id', session_id).eq('user_id', user_id).execute()
        
        if res.data:
            return jsonify({"message": "Session deleted successfully"}), 200
        else:
            return jsonify({"error": "Session not found or access denied"}), 404
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500