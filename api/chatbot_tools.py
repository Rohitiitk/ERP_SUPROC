# chatbot_tools.py
import os
import json
import requests
from docstring_parser import parse


"""
This file defines the 'tools' our chatbot can use.
Each tool is a function that the AI will learn to call.
"""

def answer_text(text: str):
    """
    The default tool. Use this when the correct action is to simply
    respond with a text-based answer to the user.
    """
    return {
        "action": "answer_text",
        "parameters": {
            "message": text
        }
    }

def navigate(path: str, message: str = None):
    """
    Use this tool to navigate the user to a specific page within the web application.
    The 'path' should be a valid route, e.g., '/profile' or '/my-projects'.
    Optionally, provide a message to display to the user while navigating.
    """
    return {
        "action": "navigate",
        "parameters": {
            "path": path,
            "message": message or f"Navigating you to {path}..."
        }
    }

# This is a more advanced tool for later, but we define it now.
def search_and_navigate(query: str, message: str = None):
    """
    A more advanced tool for the future. For now, it will just navigate.
    Example: "Find suppliers for peru balsam" might navigate to '/discover-ai?query=peru+balsam'.
    """
    # For now, we can make this a simple redirect to the main search page.
    path = f"/discover-ai?query={query.replace(' ', '+')}"
    return {
        "action": "navigate",
        "parameters": {
            "path": path,
            "message": message or f"Searching for '{query}'..."
        }
    }

import os
import json
import requests
from docstring_parser import parse

def business_research(query: str):
    """
    Performs business research on a given topic, product, or company using a search engine.
    Use this to find information on market trends, business strategies, product components, or supplier landscapes.

    :param query: A detailed search query. For example: "market trends for peru balsam in the perfume industry".
    """
    print(f"--- Executing Business Research Tool with query: {query} ---")
    try:
        serper_api_key = os.getenv("SERPER_API_KEY")
        if not serper_api_key:
            return json.dumps({"error": "SERPER_API_KEY is not configured."})

        payload = json.dumps({"q": query, "num": 5})
        headers = {'X-API-KEY': serper_api_key, 'Content-Type': 'application/json'}
        response = requests.post("https://google.serper.dev/search", headers=headers, data=payload)
        response.raise_for_status()
        
        results = response.json()
        
        snippets = []
        if "organic" in results:
            for item in results["organic"][:3]:
                snippet = item.get("snippet", "")
                if snippet:
                    snippets.append(snippet)
        
        if not snippets:
            return json.dumps({"result": "No relevant information was found."})
            
        summary = " ".join(snippets)
        return json.dumps({"research_summary": summary})

    except Exception as e:
        print(f"Error in business_research tool: {e}")
        return json.dumps({"error": str(e)})

# --- NEW TOOL 1: Ask the user for the search mode ---
def ask_for_search_mode(product_name: str):
    """
    When a user asks to find suppliers for a specific product, call this function to ask them which search mode they'd like to use.
    This will prompt the user to choose between Quick, Standard, and Pro search modes.

    :param product_name: The name of the product the user wants to find suppliers for.
    """
    print(f"--- Triggering Ask For Search Mode for product: {product_name} ---")
    # This doesn't perform logic, it just tells the frontend what to display
    return json.dumps({
        "action": "ask_search_mode",
        "parameters": {
            "product_name": product_name,
            "message": "I can certainly help find suppliers for that! Which search mode should I use?"
        }
    })

# --- NEW TOOL 2: Navigate to the search flow once the mode is chosen ---
def start_supplier_search(product_name: str, mode: str):
    """
    Once the user has confirmed which search mode they want to use for a product, call this function to navigate them to the supplier search flow.

    :param product_name: The name of the product to search for.
    :param mode: The search mode chosen by the user. Must be one of 'quick', 'basic', or 'advanced'.
    """
    print(f"--- Starting Supplier Search for '{product_name}' with mode '{mode}' ---")
    
    path = f"/?product={product_name.replace(' ', '+')}&mode={mode}&initiateSearch=true"
    
    message = f"Great! Let's find suppliers for '{product_name}'. Kicking off a '{mode}' search for you now..."
    return json.dumps({
        "action": "navigate",
        "parameters": {"path": path, "message": message}
    })

# This function is a helper for the navigate tool below
def navigate_message(path: str):
    """
    Navigates the user to a page, confirming the action with a message.
    :param path: The path to navigate to (e.g., '/bidding', '/rfq').
    """
    message = f"Sure, navigating you to the {path.replace('/', '') or 'home'} page now."
    return {"action": "navigate", "parameters": {"path": path, "message": message}}


# This is a list of the tools we will expose to the AI
available_tools = [
    answer_text,
    navigate,
    search_and_navigate,
    business_research,
    ask_for_search_mode,
    start_supplier_search
]

# A mapping from the function name to the actual function object
# This is crucial for executing the tool the AI chooses
tool_executor = {
    "business_research": business_research,
    "ask_for_search_mode": ask_for_search_mode,
    "start_supplier_search": start_supplier_search,
}