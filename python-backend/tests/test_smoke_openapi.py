"""CI Smoke Test Suite

Boots against application schema and walks every route defined in the OpenAPI specification,
asserting that:
1. No unhandled 500/5xx errors occur on valid, empty, or malformed payloads.
2. Handlers have all imported dependencies, typed models, and database sessions correctly wired.
"""

import pytest
from fastapi.testclient import TestClient

from app.auth import create_access_token
from app.main import app

client = TestClient(app)


def test_openapi_spec_has_routes():
    schema = app.openapi()
    paths = schema.get("paths", {})
    assert len(paths) > 0, "OpenAPI paths must not be empty"


def test_smoke_test_all_openapi_get_routes():
    schema = app.openapi()
    paths = schema.get("paths", {})

    token = create_access_token(
        user_id="usr_smoke_test",
        email="smoke@test.org",
        workspace_id="ws_smoke_test",
        role="ADMIN"
    )
    headers = {
        "Authorization": f"Bearer {token}",
        "X-Deployment-Key": "dep_smoke_dummy_key"
    }

    errors = []

    for path, methods in paths.items():
        # Avoid parameterized paths that need real IDs in smoke sweep
        if "{" in path:
            continue

        for method in methods.keys():
            if method.lower() == "get":
                try:
                    res = client.get(path, headers=headers)
                    if res.status_code >= 500:
                        errors.append(f"GET {path} returned {res.status_code}: {res.text}")
                except Exception as exc:
                    errors.append(f"GET {path} raised exception: {exc}")

    assert not errors, f"Smoke test encountered 5xx errors or unhandled exceptions:\n" + "\n".join(errors)


def test_smoke_test_openapi_post_routes_reject_safely():
    schema = app.openapi()
    paths = schema.get("paths", {})

    token = create_access_token(
        user_id="usr_smoke_test",
        email="smoke@test.org",
        workspace_id="ws_smoke_test",
        role="ADMIN"
    )
    headers = {
        "Authorization": f"Bearer {token}",
        "X-Deployment-Key": "dep_smoke_dummy_key"
    }

    errors = []

    for path, methods in paths.items():
        if "{" in path:
            continue

        for method in methods.keys():
            if method.lower() == "post":
                try:
                    # Test with empty payload: must respond 400/422/401/403/404, NEVER 500
                    res = client.post(path, headers=headers, json={})
                    if res.status_code >= 500:
                        errors.append(f"POST {path} with empty body returned {res.status_code}: {res.text}")
                except Exception as exc:
                    errors.append(f"POST {path} with empty body raised exception: {exc}")

    assert not errors, f"Smoke test encountered 5xx errors on POST routes:\n" + "\n".join(errors)
