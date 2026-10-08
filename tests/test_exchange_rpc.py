import os
import pytest
from fastapi.testclient import TestClient
from node.server import app, chain
import node.server as server_mod


@pytest.fixture
def client():
    return TestClient(app)


def test_exchange_status(client):
    res = client.get("/rpc/exchange/status")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "online"
    assert data["network"] == "mainnet"
    assert "chain_height" in data
    assert "best_block_hash" in data
    assert "mempool_size" in data


def test_exchange_create_address(client):
    res = client.post("/rpc/exchange/create_address")
    assert res.status_code == 200
    data = res.json()
    assert data["address"].startswith("doom1")
    assert "private_key_wif" in data
    assert "created_at" in data


def test_exchange_get_address(client):
    # Test with genesis miner address
    gen_block = chain.blocks[0]
    gen_addr = gen_block.header.miner_address

    res = client.get(f"/rpc/exchange/address/{gen_addr}")
    assert res.status_code == 200
    data = res.json()
    assert data["address"] == gen_addr
    assert "balance_doom" in data
    assert "balance_sparks" in data
    assert "utxo_count" in data
    assert isinstance(data["utxos"], list)


def test_exchange_get_block(client):
    res = client.get("/rpc/exchange/block/0")
    assert res.status_code == 200
    data = res.json()
    assert data["height"] == 0
    assert "hash" in data
    assert "confirmations" in data
    assert data["confirmations"] >= 1
    assert "transactions" in data
    assert len(data["transactions"]) >= 1


def test_exchange_get_tx(client):
    gen_tx = chain.blocks[0].transactions[0]
    res = client.get(f"/rpc/exchange/tx/{gen_tx.txid}")
    assert res.status_code == 200
    data = res.json()
    assert data["txid"] == gen_tx.txid
    assert data["status"] == "confirmed"
    assert data["confirmed"] is True
    assert data["block_height"] == 0
    assert data["confirmations"] >= 1


def test_exchange_auth_enforcement(client):
    # Temporarily enable API key
    server_mod.EXCHANGE_API_KEY = "super-secret-test-key"
    try:
        # Request without key should fail 401
        res = client.get("/rpc/exchange/status")
        assert res.status_code == 401

        # Request with wrong key should fail 401
        res = client.get("/rpc/exchange/status", headers={"X-API-KEY": "wrong-key"})
        assert res.status_code == 401

        # Request with correct key should succeed
        res = client.get("/rpc/exchange/status", headers={"X-API-KEY": "super-secret-test-key"})
        assert res.status_code == 200
    finally:
        server_mod.EXCHANGE_API_KEY = ""


def test_exchange_withdraw_insufficient_funds(client):
    from core.crypto import generate_keypair, private_key_to_wif, public_key_to_address
    priv, pub = generate_keypair()
    empty_addr = public_key_to_address(pub)
    wif = private_key_to_wif(priv)

    payload = {
        "from_address": empty_addr,
        "private_key_wif": wif,
        "to_address": "doom1dummyrecipient1234567890",
        "amount_doom": 10.0,
        "fee_doom": 0.001
    }
    res = client.post("/rpc/exchange/withdraw", json=payload)
    assert res.status_code == 400
    assert "Insufficient balance" in res.json()["detail"]
