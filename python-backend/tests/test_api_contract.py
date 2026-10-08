"""API Route Contract Test

Loads FastAPI's registered route table and verifies that every frontend
API client endpoint and method matches a backend route and method.
"""

from app.main import app


def test_frontend_backend_api_contract():
    """Validates that all frontend client endpoints match backend FastAPI routes."""
    # 1. Collect all registered FastAPI routes from OpenAPI specification
    openapi = app.openapi()
    backend_routes = set()
    for path, methods_dict in openapi.get("paths", {}).items():
        for method in methods_dict.keys():
            backend_routes.add((method.upper(), path))

    # 2. Check essential routes that the frontend calls
    # Frontend calls are rewritten from /api/<path> to /api/v1/<path>
    expected_contracts = [
        # Auth
        ("POST", "/api/v1/auth/login"),
        ("POST", "/api/v1/auth/signup"),
        ("POST", "/api/v1/auth/logout"),
        ("GET", "/api/v1/auth/me"),
        ("POST", "/api/v1/auth/refresh"),
        ("POST", "/api/v1/auth/forgot-password"),
        ("POST", "/api/v1/auth/reset-password"),
        ("POST", "/api/v1/auth/verify-email"),

        # AI Mode
        ("POST", "/api/v1/ai-mode/search"),
        ("POST", "/api/v1/ai-mode/chat"),
        ("GET", "/api/v1/ai-mode/config"),
        ("POST", "/api/v1/ai-mode/config"),
        ("GET", "/api/v1/ai-mode/knowledge"),
        ("POST", "/api/v1/ai-mode/knowledge"),
        ("POST", "/api/v1/ai-mode/knowledge/sync"),
        ("DELETE", "/api/v1/ai-mode/knowledge/{source_id}"),
        ("GET", "/api/v1/ai-mode/deployments"),
        ("POST", "/api/v1/ai-mode/deployments"),
        ("GET", "/api/v1/ai-mode/deployments/{dep_id}"),
        ("GET", "/api/v1/ai-mode/widget/{deployment_id}"),
        ("GET", "/api/v1/ai-mode/widget/{deployment_id}/script.js"),
        ("POST", "/api/v1/ai-mode/track"),

        # Commerce
        ("GET", "/api/v1/commerce/products"),
        ("POST", "/api/v1/commerce/products"),
        ("DELETE", "/api/v1/commerce/products"),
        ("GET", "/api/v1/commerce/orders"),
        ("POST", "/api/v1/commerce/orders"),
        ("POST", "/api/v1/commerce/sync"),
        ("POST", "/api/v1/commerce/sync/trigger"),
        ("GET", "/api/v1/commerce/sync/jobs/{job_id}"),
        ("POST", "/api/v1/commerce/razorpay/create-order"),
        ("POST", "/api/v1/commerce/razorpay/verify"),

        # Compliance
        ("GET", "/api/v1/compliance/audit-logs"),
        ("POST", "/api/v1/compliance/export"),
        ("POST", "/api/v1/compliance/erase"),
    ]

    missing = []
    for method, path in expected_contracts:
        if (method, path) not in backend_routes:
            missing.append(f"{method} {path}")

    assert len(missing) == 0, f"Contract test failed! Missing backend routes: {missing}"
