import time
from core.crypto import generate_keypair, public_key_to_address, bits_to_target
from core.transaction import create_coinbase_tx, Transaction, TxInput, TxOutput, COIN
from core.block import create_genesis_block, Block, BlockHeader, calculate_merkle_root
from core.consensus import validate_block, get_block_reward, calculate_next_bits

def test_core_flow():
    print("Generating keypair...")
    priv, pub = generate_keypair()
    addr = public_key_to_address(pub)
    print("Generated Address:", addr)
    assert addr.startswith("doom1")

    print("Building Genesis block...")
    genesis = create_genesis_block(miner_address=addr)
    print("Genesis Block Hash:", genesis.hash)
    print("Genesis Nonce:", genesis.header.nonce)
    print("Genesis Merkle Root:", genesis.header.merkle_root)

    # Validate Genesis block
    ok, msg = validate_block(genesis, None, {})
    assert ok, f"Genesis validation failed: {msg}"
    print("Genesis block successfully validated!")

    # Build Block #1
    reward = get_block_reward(1)
    assert reward == 50 * COIN
    cb1 = create_coinbase_tx(addr, reward, 1)
    merkle1 = calculate_merkle_root([cb1])
    bits1 = genesis.header.bits
    target1 = bits_to_target(bits1)

    h1 = BlockHeader(
        version=1,
        prev_hash=genesis.hash,
        merkle_root=merkle1,
        timestamp=genesis.header.timestamp + 20,
        bits=bits1,
        nonce=0,
        miner_address=addr
    )

    # Solve block 1
    prefix = h1.get_prefix_bytes()
    from core.crypto import doom_hash
    nonce = 0
    while True:
        h_bytes = doom_hash(prefix, nonce)
        if int.from_bytes(h_bytes, byteorder='big') < target1:
            h1.nonce = nonce
            break
        nonce += 1

    b1 = Block(h1, [cb1], height=1)
    print("Block #1 Hash:", b1.hash, "with nonce:", b1.header.nonce)

    # Validate Block #1
    utxo_set = {f"{genesis.transactions[0].txid}:0": (addr, 50 * COIN)}
    ok, msg = validate_block(b1, genesis, utxo_set, expected_bits=bits1)
    assert ok, f"Block 1 validation failed: {msg}"
    print("Block #1 validated successfully!")

    # Test difficulty retargeting
    next_bits = calculate_next_bits(b1, genesis)
    print("Next Bits calculated:", hex(next_bits))

if __name__ == "__main__":
    test_core_flow()
