import pytest
from bridge.bridge_daemon import BridgeDaemon

def test_bridge_address_extraction():
    daemon = BridgeDaemon(dry_run=True)
    
    # Valid EVM memo
    tx_with_memo = {
        "txid": "testtx123",
        "memo": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
        "inputs": [],
        "outputs": [{"recipient_address": "doom1vault000000000000000000000000000000", "amount": 1000000000}]
    }
    extracted = daemon.extract_evm_recipient(tx_with_memo)
    assert extracted == "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"

    # Input message
    tx_with_input_msg = {
        "txid": "testtx456",
        "inputs": [{"message": "0x53d284357ec70cE289De0F60e163bAA117c33671"}],
        "outputs": []
    }
    extracted2 = daemon.extract_evm_recipient(tx_with_input_msg)
    assert extracted2 == "0x53d284357ec70cE289De0F60e163bAA117c33671"

    # Invalid / no memo
    tx_empty = {"txid": "empty", "inputs": [], "outputs": []}
    assert daemon.extract_evm_recipient(tx_empty) is None

@pytest.mark.asyncio
async def test_bridge_dry_run_mint():
    daemon = BridgeDaemon(dry_run=True)
    success = await daemon.mint_wdoom("0x742d35Cc6634C0532925a3b844Bc454e4438f44e", 50.0, "doomsday_tx_hash_999")
    assert success is True

@pytest.mark.asyncio
async def test_bridge_dry_run_release():
    daemon = BridgeDaemon(dry_run=True)
    await daemon.release_native_doom("doom1qtestrecipient00000000000000000000000", 50.0, "0xevm_tx_hash_888")
    assert "0xevm_tx_hash_888" in daemon.processed_evm_txs
