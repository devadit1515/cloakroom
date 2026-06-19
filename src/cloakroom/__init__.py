"""Cloakroom: cloud-agnostic PII/PHI/PFI masking middleware for LLM calls.

Pipeline: detect -> mask/tokenize -> LLM (tokens only) -> unmask + secondary scan.
Every layer sits behind a thin interface so the same orchestration runs on any cloud.
"""
from cloakroom.config import Settings
from cloakroom.pipeline import MaskingPipeline
from cloakroom.models import Category, ProcessResult, Span

__all__ = ["Settings", "MaskingPipeline", "Category", "ProcessResult", "Span"]
__version__ = "0.1.0"
