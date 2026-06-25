"""CHOS-503 — OpenAPI contract tests (structural, dependency-light, always-on).

Validates the generated OpenAPI document the frontend + external consumers code
against: it is well-formed, every ``$ref`` resolves, and every operation declares
its responses. This catches a route whose schema drifts from what it returns
(e.g. a renamed field, a dropped response model) without needing a live server.

The heavier property-based conformance fuzzing lives in
``test_schemathesis_contract.py`` (Schemathesis vs the same OpenAPI).
"""

from main import app


def _iter_refs(node):
    if isinstance(node, dict):
        for key, value in node.items():
            if key == "$ref" and isinstance(value, str):
                yield value
            else:
                yield from _iter_refs(value)
    elif isinstance(node, list):
        for item in node:
            yield from _iter_refs(item)


def _resolve(spec: dict, ref: str):
    assert ref.startswith("#/"), f"only local refs supported, got {ref}"
    node = spec
    for part in ref[2:].split("/"):
        part = part.replace("~1", "/").replace("~0", "~")
        assert isinstance(node, dict) and part in node, f"unresolved $ref {ref}"
        node = node[part]
    return node


def test_openapi_is_3x_with_paths_and_component_schemas():
    spec = app.openapi()
    assert spec["openapi"].startswith("3."), spec["openapi"]
    assert spec.get("paths"), "no paths in the OpenAPI document"
    assert spec.get("components", {}).get("schemas"), "no component schemas"


def test_all_refs_resolve():
    """No dangling $ref — a renamed/removed schema would break consumers."""
    spec = app.openapi()
    refs = set(_iter_refs(spec))
    assert refs, "expected the schema to use component refs"
    for ref in refs:
        _resolve(spec, ref)


def test_every_operation_declares_responses():
    spec = app.openapi()
    http_methods = {"get", "post", "put", "patch", "delete"}
    missing = []
    for path, ops in spec["paths"].items():
        for method, op in ops.items():
            if method not in http_methods:
                continue
            if not op.get("responses"):
                missing.append(f"{method.upper()} {path}")
    assert not missing, f"operations with no declared responses: {missing}"


def test_request_bodies_reference_defined_schemas():
    """Every JSON request body points at a schema that exists in the document."""
    spec = app.openapi()
    for path, ops in spec["paths"].items():
        for method, op in ops.items():
            body = op.get("requestBody")
            if not body:
                continue
            content = body.get("content", {})
            for media, media_obj in content.items():
                schema = media_obj.get("schema")
                if schema and "$ref" in schema:
                    _resolve(spec, schema["$ref"])
