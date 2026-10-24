"""Tests for the Doomsday Google Antigravity integration (pure standard library)."""

import unittest
from unittest.mock import patch

from integrations.antigravity.doomsday_antigravity_tools import (
    DoomsdayAntigravityClient,
    antigravity_tools,
    claim_doomsday_faucet,
    get_doomsday_worker_status,
    list_doomsday_escrows,
    verify_doomsday_escrow,
)


class FakeAntigravityClient(DoomsdayAntigravityClient):
    def _get(self, path: str):
        if path == "/escrow/doomsday-network/doomsday/11":
            return {
                "issue_ref": "doomsday-network/doomsday#11",
                "verified_escrow": True,
                "status": "OPEN",
                "locked_doom": 3000.0,
                "evidence_level": "onchain_utxo_and_base_erc20_verified",
                "wdoom_base_contract": "0x623c84A5E04bF715018203334b0eFE41696eBC3E",
            }
        if path == "/escrow/list":
            return {
                "open_escrows": [{"issue_ref": "doomsday-network/doomsday#11"}],
                "total_open_bounties": 1,
                "total_locked_doom": 3000.0,
            }
        if path == "/pool/worker/doom1testworker":
            return {"address": "doom1testworker", "is_active": True, "round_shares": 8}
        return {"error": "HTTP 404: Not Found", "status": "ERROR"}

    def _post(self, path: str, payload):
        if path == "/faucet/claim" and payload.get("address") == "doom1testworker":
            return {"status": "SUCCESS", "tx": "0xabcdef123456", "reward": 15.0}
        return {"status": "ERROR", "error": "Invalid address"}


class AntigravityIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.client = FakeAntigravityClient()

    def test_verify_escrow_success(self):
        result = self.client.verify_escrow("doomsday-network", "doomsday", 11)
        self.assertTrue(result["verified"])
        self.assertEqual(result["status"], "OPEN")
        self.assertEqual(result["locked_doom"], 3000.0)
        self.assertEqual(result["issue_ref"], "doomsday-network/doomsday#11")

    def test_verify_escrow_invalid_input(self):
        self.assertEqual(self.client.verify_escrow("", "doomsday", 11)["status"], "INVALID_INPUT")
        self.assertEqual(self.client.verify_escrow("doomsday-network", "", 11)["status"], "INVALID_INPUT")
        self.assertEqual(self.client.verify_escrow("doomsday-network", "doomsday", -1)["status"], "INVALID_INPUT")
        self.assertEqual(self.client.verify_escrow("doomsday-network", "doomsday", "bad")["status"], "INVALID_INPUT")

    def test_list_open_escrows(self):
        result = self.client.list_open_escrows()
        self.assertEqual(result["status"], "OK")
        self.assertEqual(result["total_locked_doom"], 3000.0)
        self.assertEqual(len(result["open_escrows"]), 1)

    def test_claim_faucet(self):
        success = self.client.claim_faucet("doom1testworker")
        self.assertEqual(success["status"], "SUCCESS")
        self.assertEqual(success["reward"], 15.0)

        invalid = self.client.claim_faucet("invalid_address")
        self.assertEqual(invalid["status"], "INVALID_INPUT")

    def test_worker_status(self):
        result = self.client.worker_status("doom1testworker")
        self.assertTrue(result["is_active"])
        self.assertEqual(result["round_shares"], 8)

        invalid = self.client.worker_status("bad_addr")
        self.assertEqual(invalid["status"], "INVALID_INPUT")

    def test_module_level_helpers_with_default_client(self):
        with patch("integrations.antigravity.doomsday_antigravity_tools._default_client", self.client):
            escrow = verify_doomsday_escrow("doomsday-network", "doomsday", 11)
            self.assertTrue(escrow["verified"])
            self.assertEqual(escrow["locked_doom"], 3000.0)

            escrows = list_doomsday_escrows()
            self.assertEqual(escrows["total_locked_doom"], 3000.0)

            faucet = claim_doomsday_faucet("doom1testworker")
            self.assertEqual(faucet["status"], "SUCCESS")

            worker = get_doomsday_worker_status("doom1testworker")
            self.assertTrue(worker["is_active"])

    def test_antigravity_tools_list(self):
        tools = antigravity_tools()
        self.assertEqual(len(tools), 4)
        tool_names = [t.__name__ for t in tools]
        self.assertIn("verify_doomsday_escrow", tool_names)
        self.assertIn("list_doomsday_escrows", tool_names)
        self.assertIn("claim_doomsday_faucet", tool_names)
        self.assertIn("get_doomsday_worker_status", tool_names)


if __name__ == "__main__":
    unittest.main()
