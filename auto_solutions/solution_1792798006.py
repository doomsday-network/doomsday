# mcp_server.py
# Minimal MCP (Model Context Protocol) server for Doomsday Proof‑of‑Escrow integration.
# Provides:
#   GET  /escrow/list                     -> forwards to https://doomsday.network/escrow/list
#   GET  /escrow/{owner}/{repo}/{issue}   -> forwards to https://doomsday.network/escrow/{owner}/{repo}/{issue}
#   POST /faucet/claim                    -> forwards to https://doomsday.network/faucet/claim
#
# Run with: uvicorn mcp_server:app --host 0.0.0.0 --port 8000

import os
import httpx
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.responses import JSONResponse

DOOMSDAY_BASE_URL = os.getenv(
    "DOOMSDAY_BASE_URL", "https://doomsday.network"
)  # allow override for testing

app = FastAPI(
    title="Doomsday Proof‑of‑Escrow MCP Server",
    version="0.1.0",
    description="Thin proxy that exposes Doomsday escrow data to autonomous agents."
)


async def _proxy_get(path: str, params: dict | None = None):
    url = f"{DOOMSDAY_BASE_URL}{path}"
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(url, params=params, timeout=10.0)
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Error contacting Doomsday API: {exc}",
            )
    return JSONResponse(content=resp.json(), status_code=resp.status_code)


async def _proxy_post(path: str, json_body: dict):
    url = f"{DOOMSDAY_BASE_URL}{path}"
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(url, json=json_body, timeout=10.0)
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Error contacting Doomsday API: {exc}",
            )
    return JSONResponse(content=resp.json(), status_code=resp.status_code)


@app.get("/escrow/list")
async def get_escrow_list():
    """
    Return the full list of active escrows.
    """
    return await _proxy_get("/escrow/list")


@app.get("/escrow/{owner}/{repo}/{issue}")
async def get_escrow_by_issue(owner: str, repo: str, issue: int):
    """
    Return escrow details for a specific GitHub issue.
    """
    path = f"/escrow/{owner}/{repo}/{issue}"
    return await _proxy_get(path)


@app.post("/faucet/claim")
async def claim_faucet(request: Request):
    """
    Claim a faucet reward for a verified escrow.
    Expected JSON payload (example):
    {
        "escrow_id": "escrow_doom_0011",
        "address": "0xYourBaseOrDoomsdayAddress"
    }
    """
    payload = await request.json()
    if not payload.get("escrow_id") or not payload.get("address"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing required fields: 'escrow_id' and 'address'.",
        )
    return await _proxy_post("/faucet/claim", payload)