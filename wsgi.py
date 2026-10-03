"""
WSGI entrypoint for hosting LyricVibe FastAPI backend on PythonAnywhere.
PythonAnywhere uses WSGI; a2wsgi converts the FastAPI ASGI application to WSGI.
"""
import os
import sys

# Ensure current project directory is in the Python path
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from a2wsgi import ASGIMiddleware
from backend.main import app as asgi_app

# PythonAnywhere looks for the 'application' callable
application = ASGIMiddleware(asgi_app)
