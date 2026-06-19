"""Vercel Python serverless entry point for Cloakroom.

The static frontend (served from ``web/dist``) and this API share one domain, so
the browser can call ``/api/process`` same-origin. We mount the real Cloakroom
FastAPI app under ``/api`` and let Vercel route every ``/api/*`` request here.

This runs the free default stack only -- regex detection + in-memory vault +
mock LLM -- so it needs no external services, keys, or database. Heavier
adapters (Presidio, Redis/DynamoDB, Ollama/Bedrock) stay dormant.
"""
import os
import sys

# The cloakroom package lives in ../src; make it importable inside the lambda.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from fastapi import FastAPI  # noqa: E402

from cloakroom.service.app import app as cloakroom_app  # noqa: E402

# Outer app receives the original "/api/..." path from Vercel; mounting the real
# app at "/api" strips the prefix so its "/process", "/healthz" routes match.
app = FastAPI()
app.mount("/api", cloakroom_app)
