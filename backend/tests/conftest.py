import pytest

# Configure asyncio mode for pytest-asyncio
pytest_plugins = ("pytest_asyncio",)


def pytest_collection_modifyitems(config, items):
    """Auto-mark async tests so we don't need @pytest.mark.asyncio everywhere."""
    for item in items:
        if "asyncio" in item.keywords:
            continue
        if hasattr(item, "function") and item.function.__code__.co_flags & 0x80:
            item.add_marker(pytest.mark.asyncio)
