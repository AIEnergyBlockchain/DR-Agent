"""Small synchronous wrapper around httpx ASGITransport for local tests/smoke."""

from __future__ import annotations

import asyncio
from typing import Any

import httpx
from fastapi import FastAPI


class AppClient:
    def __init__(self, app: FastAPI, base_url: str = "http://testserver") -> None:
        self.app = app
        self.base_url = base_url
        self._runner = asyncio.Runner()
        self._client: httpx.AsyncClient | None = None
        self._transport: httpx.ASGITransport | None = None
        self._closed = False

    async def _ensure_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._transport = httpx.ASGITransport(app=self.app)
            self._client = httpx.AsyncClient(
                transport=self._transport,
                base_url=self.base_url,
            )
        return self._client

    async def _request(self, method: str, path: str, **kwargs: Any) -> httpx.Response:
        client = await self._ensure_client()
        return await client.request(method, path, **kwargs)

    def request(self, method: str, path: str, **kwargs: Any) -> httpx.Response:
        return self._runner.run(self._request(method, path, **kwargs))

    def get(self, path: str, **kwargs: Any) -> httpx.Response:
        return self.request("GET", path, **kwargs)

    def post(self, path: str, **kwargs: Any) -> httpx.Response:
        return self.request("POST", path, **kwargs)

    async def _aclose(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None
        if self._transport is not None:
            await self._transport.aclose()
            self._transport = None

    def close(self) -> None:
        if self._closed:
            return
        self._runner.run(self._aclose())
        self._runner.close()
        self._closed = True

    def __enter__(self) -> AppClient:
        return self

    def __exit__(self, exc_type: object, exc: object, tb: object) -> None:
        self.close()

    def __del__(self) -> None:
        try:
            self.close()
        except Exception:
            pass
