---
name: python-pro
description: "Advanced Python: async/await, type hints, dataclasses, context managers, decorators, testing patterns, and performance optimization."
metadata: {"moltbot":{"emoji":"🐍","requires":{"bins":["python3"]}}}
---

# Python Pro

Advanced Python patterns for production code.

## Type Hints (3.12+)

```python
from typing import TypeVar, Protocol, overload
from collections.abc import Callable, Sequence

# Generic function
T = TypeVar('T')
def first(items: Sequence[T]) -> T | None:
    return items[0] if items else None

# Protocol (structural typing)
class Serializable(Protocol):
    def to_dict(self) -> dict: ...

def save(obj: Serializable) -> None:
    data = obj.to_dict()

# Overload for different return types
@overload
def parse(value: str, as_list: Literal[True]) -> list[str]: ...
@overload
def parse(value: str, as_list: Literal[False]) -> str: ...
def parse(value: str, as_list: bool = False):
    return value.split(',') if as_list else value.strip()

# TypedDict
from typing import TypedDict
class UserDict(TypedDict):
    name: str
    email: str
    age: int | None
```

## Async/Await

```python
import asyncio
import aiohttp

async def fetch_all(urls: list[str]) -> list[dict]:
    async with aiohttp.ClientSession() as session:
        tasks = [fetch(session, url) for url in urls]
        return await asyncio.gather(*tasks)

async def fetch(session: aiohttp.ClientSession, url: str) -> dict:
    async with session.get(url) as response:
        return await response.json()

# Semaphore for rate limiting
sem = asyncio.Semaphore(10)
async def rate_limited_fetch(session, url):
    async with sem:
        return await fetch(session, url)

# Run
asyncio.run(fetch_all(["https://api.example.com/1", "https://api.example.com/2"]))
```

## Dataclasses & Pydantic

```python
from dataclasses import dataclass, field
from pydantic import BaseModel, validator

# Dataclass (simple data containers)
@dataclass(frozen=True)  # immutable
class Point:
    x: float
    y: float

# Pydantic (validation + serialization)
class User(BaseModel):
    name: str
    email: str
    age: int

    @validator('email')
    def validate_email(cls, v):
        if '@' not in v:
            raise ValueError('Invalid email')
        return v

user = User(name="Test", email="t@t.com", age=25)
user.model_dump()  # → dict
User.model_validate({"name": "Test", "email": "t@t.com", "age": 25})
```

## Context Managers

```python
from contextlib import contextmanager, asynccontextmanager

@contextmanager
def timer(label: str):
    import time
    start = time.perf_counter()
    yield
    elapsed = time.perf_counter() - start
    print(f"{label}: {elapsed:.3f}s")

with timer("database query"):
    result = db.execute(query)

# Async context manager
@asynccontextmanager
async def db_transaction():
    conn = await db.acquire()
    try:
        yield conn
        await conn.commit()
    except:
        await conn.rollback()
        raise
    finally:
        await conn.release()
```

## Decorators

```python
import functools
import time

def retry(max_attempts=3, delay=1):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(max_attempts):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    if attempt == max_attempts - 1:
                        raise
                    time.sleep(delay * (attempt + 1))
        return wrapper
    return decorator

@retry(max_attempts=3, delay=2)
def call_api(url):
    return requests.get(url).json()
```

## Testing

```bash
# pytest with fixtures and parametrize
pytest -xvs tests/

# Coverage
pytest --cov=src --cov-report=term-missing

# Parallel
pytest -n auto

# Specific test
pytest tests/test_user.py::test_create_user -v
```

```python
# Fixture pattern
import pytest

@pytest.fixture
def db():
    conn = create_test_db()
    yield conn
    conn.close()

@pytest.mark.parametrize("input,expected", [
    ("hello", "HELLO"),
    ("world", "WORLD"),
    ("", ""),
])
def test_uppercase(input, expected):
    assert input.upper() == expected
```

## Performance

```bash
# Profile
python3 -m cProfile -s cumulative app.py | head -20

# Line profiler
pip install line_profiler
kernprof -l -v script.py

# Memory profiler
pip install memory_profiler
python3 -m memory_profiler script.py
```

## Notes

- Use `ruff` for linting and formatting — it's 10-100x faster than flake8+black.
- `uv` is the fastest package manager. Use it over pip when possible.
- Type hints are documentation that the compiler checks. Use them everywhere.
- `match` statements (3.10+) are cleaner than if/elif chains for structural matching.
- Prefer `pathlib.Path` over `os.path` for file operations.
