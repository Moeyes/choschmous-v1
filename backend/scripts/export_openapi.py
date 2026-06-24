"""Export the FastAPI OpenAPI schema as a contract artifact (CHOS-203).

The interactive docs and ``/openapi.json`` endpoint are disabled outside local
environments (see ``main.py``), so this script produces the schema directly from
the app object. CI runs it to publish ``openapi.json`` as a build artifact, which
gives consumers a versioned, reviewable API contract independent of a running
server.

Usage::

    python scripts/export_openapi.py [output_path]   # default: openapi.json
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

# Ensure the backend root (parent of scripts/) is importable when run as a file.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Import the app the same way the ASGI server does. This requires the same
# environment the app needs to boot (DB_* / JWT secrets / REDIS_URL); CI injects
# throwaway values for these so the schema can be generated without real infra.
from main import app  # noqa: E402


def main() -> int:
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("openapi.json")
    schema = app.openapi()
    out.write_text(json.dumps(schema, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    paths = len(schema.get("paths", {}))
    print(f"Wrote OpenAPI contract to {out} ({paths} paths).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
