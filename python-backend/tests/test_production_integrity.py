"""CI Integrity & Production Safety Tests

Enforces that:
1. Temporary databases function in isolated test fixtures.
2. Non-test production source files contain ZERO banned words (demo, mock, fake, example.com, password123, acme).
"""

import os
import re
import pytest
from sqlalchemy import select
from app.db.models import ProductModel


@pytest.mark.asyncio
async def test_isolated_database_fixture(isolated_test_db):
    """Verify that the isolated_test_db fixture provides a fresh, functional database."""
    prod = ProductModel(
        id="prod_isolated_1",
        workspace_id="ws_isolated_tenant",
        title="Isolated Test Product",
        price=199.0,
        stock=10
    )
    isolated_test_db.add(prod)
    await isolated_test_db.commit()

    res = await isolated_test_db.execute(select(ProductModel).where(ProductModel.id == "prod_isolated_1"))
    found = res.scalars().first()
    assert found is not None
    assert found.title == "Isolated Test Product"
    assert found.price == 199.0


def test_no_banned_fake_or_demo_tokens_in_production_source():
    """CI Check: Fails if 'demo', 'mock', 'fake', 'example.com', 'password123', or 'acme'
    appear in non-test production source code.
    """
    banned_terms = ["demo", "mock", "fake", "example.com", "password123", "acme"]
    pattern = re.compile(r'(\bacme\b|acme|\b(?:demo|mock|fake|example\.com|password123)\b)', re.IGNORECASE)

    root_dirs = [
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app")),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "src")),
    ]

    violations = []

    for root_dir in root_dirs:
        for dirpath, _, filenames in os.walk(root_dir):
            # Skip build caches and node modules
            if any(skip in dirpath for skip in ["__pycache__", "node_modules", ".next"]):
                continue

            for f in filenames:
                if f.endswith((".py", ".ts", ".tsx", ".js", ".jsx", ".json")):
                    filepath = os.path.join(dirpath, f)
                    with open(filepath, "r", encoding="utf-8", errors="ignore") as fp:
                        for line_num, line in enumerate(fp, 1):
                            match = pattern.search(line)
                            if match:
                                rel_path = os.path.relpath(filepath, os.path.join(root_dir, ".."))
                                violations.append(
                                    f"{rel_path}:{line_num} contains forbidden token '{match.group(0)}': {line.strip()[:80]}"
                                )

    assert len(violations) == 0, (
        f"Production integrity check failed! Found {len(violations)} forbidden token(s) in non-test source files:\n"
        + "\n".join(violations)
    )
