import hashlib
import struct
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import hashes, serialization


def doom_hash(header_prefix_bytes: bytes, nonce: int) -> bytes:
    """
    DoomHash Proof-of-Work algorithm (Reference Implementation).
    
    1. Pre-hashes header_prefix with SHA-256.
    2. Initializes 8 x 64-bit state registers with the seed, nonce, and constants.
    3. Runs 8 rounds of non-linear matrix permutations with golden ratio mixing.
    4. Compresses state through final SHA-256 digest to produce 32-byte hash.
    """
    seed = hashlib.sha256(header_prefix_bytes).digest()
    w = list(struct.unpack('<4Q', seed))
    
    # Expand state with nonce permutations
    w.append(nonce & 0xFFFFFFFFFFFFFFFF)
    w.append((nonce ^ 0x5555555555555555) & 0xFFFFFFFFFFFFFFFF)
    w.append((nonce ^ 0xAAAAAAAAAAAAAAAA) & 0xFFFFFFFFFFFFFFFF)
    w.append(0x9E3779B97F4A7C15)  # 2^64 / phi

    # 8-round non-linear mixing
    for r in range(8):
        for i in range(8):
            next_idx = (i + 1) % 8
            prev_idx = (i + 7) % 8
            val = (w[i] ^ w[next_idx]) & 0xFFFFFFFFFFFFFFFF
            # 64-bit left rotation by 17 bits
            rot = ((val << 17) | (val >> 47)) & 0xFFFFFFFFFFFFFFFF
            w[i] = (rot * 0x9E3779B97F4A7C15 + w[prev_idx] + r) & 0xFFFFFFFFFFFFFFFF

    packed = struct.pack('<8Q', *w)
    return hashlib.sha256(packed).digest()


def target_to_bits(target: int) -> int:
    """Convert 256-bit target integer to compact 32-bit representation (Bits)."""
    target_bytes = target.to_bytes(32, byteorder='big').lstrip(b'\x00')
    if not target_bytes:
        return 0
    size = len(target_bytes)
    if target_bytes[0] > 0x7F:
        target_bytes = b'\x00' + target_bytes
        size += 1
    compact = (size << 24) | int.from_bytes(target_bytes[:3], byteorder='big')
    return compact


def bits_to_target(bits: int) -> int:
    """Convert compact 32-bit representation to full 256-bit target integer."""
    size = bits >> 24
    word = bits & 0x007FFFFF
    if size <= 3:
        target = word >> (8 * (3 - size))
    else:
        target = word << (8 * (size - 3))
    return target


# Initial network difficulty: high enough to require real mining, low enough for responsive home GPUs
INITIAL_BITS = 0x1e0ffff0
INITIAL_TARGET = bits_to_target(INITIAL_BITS)
MAX_TARGET = bits_to_target(0x1f00ffff)


def generate_keypair():
    """Generate a new secp256k1 private and public key pair."""
    private_key = ec.generate_private_key(ec.SECP256K1())
    public_key = private_key.public_key()
    return private_key, public_key


def private_key_to_wif(private_key) -> str:
    """Export private key to hex format."""
    num = private_key.private_numbers().private_value
    return f"{num:064x}"


def private_key_from_wif(wif: str):
    """Import private key from hex format."""
    val = int(wif, 16)
    return ec.derive_private_key(val, ec.SECP256K1())


def public_key_to_address(public_key) -> str:
    """
    Derive a human-readable DOOM address (doom1...) from a public key.
    Address = 'doom1' + hex(RIPEMD160(SHA256(compressed_pubkey))) + 4-byte checksum
    """
    raw_pub = public_key.public_bytes(
        encoding=serialization.Encoding.X962,
        format=serialization.PublicFormat.CompressedPoint
    )
    sha = hashlib.sha256(raw_pub).digest()
    try:
        ripemd = hashlib.new('ripemd160', sha).digest()
    except ValueError:
        # Fallback if ripemd160 is restricted by system OpenSSL
        ripemd = hashlib.sha256(sha).digest()[:20]
    
    checksum = hashlib.sha256(hashlib.sha256(ripemd).digest()).digest()[:4]
    return "doom1" + (ripemd + checksum).hex()


def sign_message(private_key, message: bytes) -> bytes:
    """Sign arbitrary message bytes with private key."""
    return private_key.sign(message, ec.ECDSA(hashes.SHA256()))


def verify_signature(public_key, signature: bytes, message: bytes) -> bool:
    """Verify ECDSA signature with public key."""
    try:
        public_key.verify(signature, message, ec.ECDSA(hashes.SHA256()))
        return True
    except Exception:
        return False
