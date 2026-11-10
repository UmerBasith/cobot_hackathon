"""Tests always use a throw-away SQLite file — never the real Supabase database."""
import os

os.environ["RESQ_FORCE_SQLITE"] = "1"
