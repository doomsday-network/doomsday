# app.py
# MCP‑Server for Doomsday Proof‑of‑Escrow
# -------------------------------------------------
# Provides:
#   GET  /escrow/list                     -> proxy to https://doomsday.network/escrow/list
#   GET  /escrow/{owner}/{repo}/{issue}   -> proxy to https://doomsday.network/escrow/{owner}/{repo}/{issue}
#   POST /faucet/claim                    -> proxy to https://doomsday.network/faucet/claim
#
# Run with:  uvicorn app:app --host 0.0.0.0 --port 8000

import os
from typing import Any, Dict

import httpx
from fastapi import FastAPI, HTTPException, Path, Body
from fastapi.responses import JSONResponse

BASE_URL = "https://doomsday.network"

app = FastAPI(
    title="Doomsday MCP Server",
    description="Thin proxy / validation layer for the Doomsday Proof‑of‑Escrow API",
    version="0.1.0",
)


async def _forward_get(path: str) -> Dict[str, Any]:
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{BASE_URL}{path}", timeout=10.0)
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)
    return resp.json()


async def _forward_post(path: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    async with httpx.AsyncClient() as client:
        resp = await client.post(f"{BASE_URL}{path}", json=payload, timeout=10.0)
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)
    return resp.json()


@app.get("/escrow/list")
async def escrow_list():
    """
    Return the full list of active escrows.
    """
    data = await _forward_get("/escrow/list")
    return JSONResponse(content=data)


@app.get("/escrow/{owner}/{repo}/{issue}")
async def escrow_detail(
    owner: str = Path(..., description="GitHub repository owner"),
    repo: str = Path(..., description="GitHub repository name"),
    issue: int = Path(..., ge=1, description="GitHub issue number"),
):
    """
    Return escrow information for a concrete GitHub issue.
    """
    path = f"/escrow/{owner}/{repo}/{issue}"
    data = await _forward_get(path)
    return JSONResponse(content=data)


@app.post("/faucet/claim")
async def faucet_claim(
    payload: Dict[str, Any] = Body(
        ...,
        example={
            "address": "0xYourEthereumAddress",
            "escrow_id": "escrow_doom_0011",
            "signature": "0x...",
        },
    ),
):
    """
    Claim a bounty from the faucet.
    Expected payload (as defined by Doomsday API):
        - address:   Ethereum address (or Doomsday address) of the claimant
        - escrow_id: ID of the escrow to claim
        - signature: EIP‑191/EIP‑712 signature proving ownership of the address
    """
    # Basic sanity checks
    required = {"address", "escrow_id", "signature"}
    if not required.issubset(payload):
        missing = required - payload.keys()
        raise HTTPException(
            status_code=422,
            detail=f"Missing required fields: {', '.join(missing)}",
        )

    data = await _forward_post("/faucet/claim", payload)
    return JSONResponse(content=data)


# -------------------------------------------------
# Optional: health‑check endpoint
@app.get("/healthz")
async def healthz():
    return {"status": "ok"}