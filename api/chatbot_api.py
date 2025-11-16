# chatbot_api.py

import os
import openai
import json
from flask import Blueprint, request, jsonify, Response, stream_with_context
import logging
from docstring_parser import parse
from supabase import create_client, Client  
import jwt 

# We import all the tools the AI can use
from .chatbot_tools import available_tools, answer_text, navigate, tool_executor, navigate_message, ask_for_search_mode, start_supplier_search

chatbot_bp = Blueprint('chatbot_bp', __name__)

supabase: Client = None

# A strict, code-based navigation map for the "Fast Path"
NAVIGATION_MAP = {
    '/': ['home', 'homepage', 'discover ai'],
    '/bidding': ['bidding', 'biddings', 'marketplace'],
    '/suplinks': ['suplinks', 'supplier directory', 'suppliers', 'supplier'],
    '/rfq': ['rfq', 'request for quotation'],
    '/rfp': ['rfp', 'request for proposal'],
    '/my-projects': ['my projects', 'my project'],
    '/my-bids': ['my bids', 'my bid'],
    '/profile': ['profile', 'my profile'],
    '/supplier-registration': ['supplier registration', 'register'],
    '/enhance-profile': ['enhance profile'],
    '/workspace': ['erp', 'workspace', 'dashboard']
}

def init_supabase_client():
    global supabase
    if supabase is None:
        supabase_url = os.getenv("MASTER_SUPABASE_URL")
        supabase_key = os.getenv("MASTER_SUPABASE_KEY")
        if not supabase_url or not supabase_key:
            raise ValueError("Supabase URL or Service Key is not configured.")
        supabase = create_client(supabase_url, supabase_key)

# REPLACE your old format_tools_for_openai function with this one
def format_tools_for_openai(tools):
    formatted_tools = []
    for func in tools:
        docstring = parse(func.__doc__)
        params = { "type": "object", "properties": {}, "required": [] }
        if docstring.params:
            params["required"] = [p.arg_name for p in docstring.params if not p.is_optional]
            for param in docstring.params:
                # Assuming all params are strings for simplicity.
                # You can extend this for other types if needed.
                params["properties"][param.arg_name] = { "type": "string", "description": param.description }
        
        formatted_tools.append({
            "type": "function",
            "function": {
                "name": func.__name__,
                "description": docstring.short_description,
                "parameters": params
            }
        })
    return formatted_tools

def get_user_id_from_token(request):
    """Extracts user ID from the Authorization header."""
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return None
    try:
        token = auth_header.split(" ")[1]
        decoded_token = jwt.decode(token, options={"verify_signature": False})
        return decoded_token.get('sub')
    except Exception:
        return None

# In chatbot_api.py

@chatbot_bp.route('/api/chatbot', methods=['POST'])
def handle_chat():
    data = request.get_json()
    user_message = data.get('message')
    session_id = data.get('sessionId')

    if not all([user_message, session_id]):
        return jsonify({"error": "Missing message or sessionId."}), 400

    try:
        init_supabase_client()
        openai.api_key = os.getenv("OPENAI_API_KEY")

        session_res = supabase.table('chat_sessions').select('title').eq('id', session_id).single().execute()
        is_new_chat = session_res.data and session_res.data['title'] == 'New Chat'
        supabase.table('chat_messages').insert({'session_id': session_id, 'sender': 'user', 'content': user_message}).execute()
        if is_new_chat:
            new_title = (user_message[:40] + '...') if len(user_message) > 40 else user_message
            supabase.table('chat_sessions').update({'title': new_title}).eq('id', session_id).execute()

        embedding_response = openai.embeddings.create(input=user_message, model="text-embedding-3-small")
        query_embedding = embedding_response.data[0].embedding
        matched_chunks = supabase.rpc('match_knowledge_base', { 'query_embedding': query_embedding, 'match_threshold': 0.30, 'match_count': 5 }).execute()
        context_text = "\n\n---\n\n".join([chunk['content'] for chunk in matched_chunks.data]) if matched_chunks.data else "No relevant context found."

        # Fetch history, but EXCLUDE the message we are currently processing to avoid duplication.
        history_res = supabase.table('chat_messages').select('sender, content') \
            .eq('session_id', session_id) \
            .neq('content', user_message) \
            .order('created_at', desc=False) \
            .limit(10) \
            .execute()
            
        conversation_history = []
        if history_res.data:
            for message in history_res.data:
                role = 'assistant' if message['sender'] == 'bot' else 'user'
                conversation_history.append({"role": role, "content": message['content']})

        system_prompt = f"""
        You are a friendly and proactive sourcing assistant for the Suproc platform. Your name is Kai.
        Your goal is to be a helpful guide, not just a question-answerer. You must understand the user's true intent behind their request.

        **Your Core Behavior:**
        1.  **Acknowledge & Clarify:** When a user states a need (e.g., "I need peru balsam"), first acknowledge it cheerfully. Then, ALWAYS ask clarifying questions to understand their project. Good questions are: "What is your use case?", "What kind of product are you building?", "What is your business goal?".
        2.  **Offer Expanded Help:** Proactively offer to help with more than just the single item. For example, suggest finding suppliers for *all* components of their end product, or offer to do initial business research.
        3.  **Guide with Choices:** Present the user with clear options. For instance, "Got it. So, we can start finding suppliers right away, or would you like me to do some business research on that first?".
        4.  **Use Your Tools:**
            - If the user wants to find suppliers for a product, you MUST use the `ask_for_search_mode` tool first.
            - If the user has already been asked for the search mode and they reply with a choice (e.g., "quick", "pro", "standard search"), you MUST use the `start_supplier_search` tool.
            - If the user agrees to research, use the `business_research` tool.
        5.  **Be Conversational:** Use friendly, human-like language. Phrases like "Sounds good!", "Got it!", and "Let's dive in." are great.
        6.  **Initiate Search:** If the user wants to find suppliers (e.g., "I need widgets," "find suppliers for peru balsam"), you MUST immediately call the `ask_for_search_mode` tool. Do not ask any other clarifying questions first.
        7.  **Process Selection:** If the user has already been asked for the search mode and they reply with a choice (e.g., "quick", "pro", "standard search"), you MUST call the `start_supplier_search` tool.
        **Context Sources (Use both):**
        1.  **Knowledge Base:** Use the provided context to answer direct questions about the Suproc platform.
        2.  **Conversation History:** Use the chat history to understand what has already been discussed.

        Context from knowledge base:
        {context_text}
        """

        # Correctly construct the message list with the current user message at the end
        messages_for_api = [
            {"role": "system", "content": system_prompt},
            *conversation_history,
            {"role": "user", "content": user_message}
        ]
        
        formatted_tools = format_tools_for_openai(available_tools)

        first_response = openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages_for_api,
            tools=formatted_tools,
            tool_choice="auto",
        )
        response_message = first_response.choices[0].message
        tool_calls = response_message.tool_calls

        if tool_calls:
            tool_call = tool_calls[0]
            function_name = tool_call.function.name
            function_args = json.loads(tool_call.function.arguments)
            function_to_call = tool_executor.get(function_name)

            if function_name in ['ask_for_search_mode', 'start_supplier_search']:
                json_response_str = function_to_call(**function_args)
                json_response = json.loads(json_response_str)
                bot_message_to_save = json_response.get("parameters", {}).get("message", "")
                if bot_message_to_save:
                    supabase.table('chat_messages').insert({'session_id': session_id, 'sender': 'bot', 'content': bot_message_to_save}).execute()
                return jsonify(json_response)

            messages_for_api.append(response_message)
            function_response = function_to_call(**function_args)
            messages_for_api.append({
                "tool_call_id": tool_call.id,
                "role": "tool",
                "name": function_name,
                "content": function_response,
            })
            
            second_response = openai.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages_for_api,
                stream=True
            )
            
            def stream_and_save(response_stream):
                full_response_text = ""
                for chunk in response_stream:
                    content = chunk.choices[0].delta.content or ""
                    if content:
                        full_response_text += content
                        yield content
                supabase.table('chat_messages').insert({'session_id': session_id, 'sender': 'bot', 'content': full_response_text}).execute()
            
            return Response(stream_with_context(stream_and_save(second_response)), mimetype='text/plain')
        else:
            plain_response_stream = openai.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages_for_api,
                stream=True
            )
            def stream_and_save(response_stream):
                full_response_text = ""
                for chunk in response_stream:
                    content = chunk.choices[0].delta.content or ""
                    if content:
                        full_response_text += content
                        yield content
                supabase.table('chat_messages').insert({'session_id': session_id, 'sender': 'bot', 'content': full_response_text}).execute()

            return Response(stream_with_context(stream_and_save(plain_response_stream)), mimetype='text/plain')

    except Exception as e:
        return jsonify({"error": str(e)}), 500