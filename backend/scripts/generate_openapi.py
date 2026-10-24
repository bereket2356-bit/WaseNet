"""
OpenAPI Schema Generation Script (Deliverable 4)
Extracts OpenAPI 3.1 specification directly from the FastAPI application and models.
Saves output to openapi.json (generated from code, never hand-written).
"""
import os
import sys
import json

# Ensure backend root is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app


def export_openapi_schema(output_path: str = "openapi.json"):
    openapi_schema = app.openapi()
    
    target_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", output_path))
    with open(target_path, "w", encoding="utf-8") as f:
        json.dump(openapi_schema, f, indent=2, ensure_ascii=False)

    print(f"[SUCCESS] Exported OpenAPI schema to: {target_path}")


if __name__ == "__main__":
    out_file = sys.argv[1] if len(sys.argv) > 1 else "openapi.json"
    export_openapi_schema(out_file)
