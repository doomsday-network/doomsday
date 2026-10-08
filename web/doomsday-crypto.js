/**
 * DOOMSDAY NETWORK - CLIENT-SIDE CRYPTOGRAPHIC ENGINE
 * ==============================================================================
 * 100% Non-Custodial Client-Side Key Management & Transaction Signer.
 * Private keys are generated and held strictly in browser memory.
 * No private keys or seed data are ever transmitted to any server or network.
 * ==============================================================================
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./elliptic.min.js'));
  } else {
    root.DoomsdayCrypto = factory(root.elliptic);
  }
}(typeof self !== 'undefined' ? self : this, function (ellipticLib) {
  'use strict';

  if (!ellipticLib) {
    throw new Error('elliptic library must be loaded prior to DoomsdayCrypto');
  }

  const ec = new ellipticLib.ec('secp256k1');
  const COIN = 100000000; // 1 DOOM = 100,000,000 Sparks

  // Standalone bit-for-bit RIPEMD-160
  function ripemd160(message) {
    function safeAdd(x, y) {
      const lsw = (x & 0xffff) + (y & 0xffff);
      const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
      return (msw << 16) | (lsw & 0xffff);
    }
    function rol(num, cnt) {
      return (num << cnt) | (num >>> (32 - cnt));
    }
    function f1(x, y, z) { return x ^ y ^ z; }
    function f2(x, y, z) { return (x & y) | (~x & z); }
    function f3(x, y, z) { return (x | ~y) ^ z; }
    function f4(x, y, z) { return (x & z) | (y & ~z); }
    function f5(x, y, z) { return x ^ (y | ~z); }

    const zl = [
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
      7, 4, 13, 1, 10, 6, 15, 3, 12, 0, 9, 5, 2, 14, 11, 8,
      3, 10, 14, 4, 9, 15, 8, 1, 2, 7, 0, 6, 13, 11, 5, 12,
      1, 9, 11, 10, 0, 8, 12, 4, 13, 3, 7, 15, 14, 5, 6, 2,
      4, 0, 5, 9, 7, 12, 2, 10, 14, 1, 3, 8, 11, 6, 15, 13
    ];
    const zr = [
      5, 14, 7, 0, 9, 2, 11, 4, 13, 6, 15, 8, 1, 10, 3, 12,
      6, 11, 3, 7, 0, 13, 5, 10, 14, 15, 8, 12, 4, 9, 1, 2,
      15, 5, 1, 3, 7, 14, 6, 9, 11, 8, 12, 2, 10, 0, 4, 13,
      8, 6, 4, 1, 3, 11, 15, 0, 5, 12, 2, 13, 9, 7, 10, 14,
      12, 15, 10, 4, 1, 5, 8, 7, 6, 2, 13, 14, 0, 3, 9, 11
    ];
    const sl = [
      11, 14, 15, 12, 5, 8, 7, 9, 11, 13, 14, 15, 6, 7, 9, 8,
      7, 6, 8, 13, 11, 9, 7, 15, 7, 12, 15, 9, 11, 7, 13, 12,
      11, 13, 6, 7, 14, 9, 13, 15, 14, 8, 13, 6, 5, 12, 7, 5,
      11, 12, 14, 15, 14, 15, 9, 8, 9, 14, 5, 6, 8, 6, 5, 12,
      9, 15, 5, 11, 6, 8, 13, 12, 5, 12, 13, 14, 11, 8, 5, 6
    ];
    const sr = [
      8, 9, 9, 11, 13, 15, 15, 5, 7, 7, 8, 11, 14, 14, 12, 6,
      9, 13, 15, 7, 12, 8, 9, 11, 7, 7, 12, 7, 6, 15, 13, 11,
      9, 7, 15, 11, 8, 6, 6, 14, 12, 13, 5, 14, 13, 13, 7, 5,
      15, 5, 8, 11, 14, 14, 6, 14, 6, 9, 12, 9, 12, 5, 15, 8,
      8, 5, 12, 9, 12, 5, 14, 6, 8, 13, 6, 5, 15, 13, 11, 11
    ];

    let bytes;
    if (typeof message === 'string') {
      bytes = new TextEncoder().encode(message);
    } else if (message instanceof Uint8Array || Array.isArray(message)) {
      bytes = new Uint8Array(message);
    } else {
      bytes = new Uint8Array(message.buffer || message);
    }

    const nBits = bytes.length * 8;
    const padded = [];
    for (let i = 0; i < bytes.length; i++) padded.push(bytes[i]);
    padded.push(0x80);
    while ((padded.length % 64) !== 56) padded.push(0);

    const words = [];
    for (let i = 0; i < padded.length; i += 4) {
      words.push(padded[i] | (padded[i + 1] << 8) | (padded[i + 2] << 16) | (padded[i + 3] << 24));
    }
    words.push(nBits & 0xffffffff);
    words.push((nBits / 0x100000000) | 0);

    let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;

    for (let i = 0; i < words.length; i += 16) {
      const x = words.slice(i, i + 16);
      let al = h0, bl = h1, cl = h2, dl = h3, el = h4;
      let ar = h0, br = h1, cr = h2, dr = h3, er = h4;

      for (let j = 0; j < 80; j++) {
        let t;
        if (j < 16) {
          t = safeAdd(al, f1(bl, cl, dl));
          t = safeAdd(t, x[zl[j]]);
          t = safeAdd(rol(t, sl[j]), el);
          al = el; el = dl; dl = rol(cl, 10); cl = bl; bl = t;

          t = safeAdd(ar, f5(br, cr, dr));
          t = safeAdd(t, safeAdd(x[zr[j]], 0x50a28be6));
          t = safeAdd(rol(t, sr[j]), er);
          ar = er; er = dr; dr = rol(cr, 10); cr = br; br = t;
        } else if (j < 32) {
          t = safeAdd(al, safeAdd(f2(bl, cl, dl), 0x5a827999));
          t = safeAdd(t, x[zl[j]]);
          t = safeAdd(rol(t, sl[j]), el);
          al = el; el = dl; dl = rol(cl, 10); cl = bl; bl = t;

          t = safeAdd(ar, safeAdd(f4(br, cr, dr), 0x5c4dd124));
          t = safeAdd(t, x[zr[j]]);
          t = safeAdd(rol(t, sr[j]), er);
          ar = er; er = dr; dr = rol(cr, 10); cr = br; br = t;
        } else if (j < 48) {
          t = safeAdd(al, safeAdd(f3(bl, cl, dl), 0x6ed9eba1));
          t = safeAdd(t, x[zl[j]]);
          t = safeAdd(rol(t, sl[j]), el);
          al = el; el = dl; dl = rol(cl, 10); cl = bl; bl = t;

          t = safeAdd(ar, safeAdd(f3(br, cr, dr), 0x6d703ef3));
          t = safeAdd(t, x[zr[j]]);
          t = safeAdd(rol(t, sr[j]), er);
          ar = er; er = dr; dr = rol(cr, 10); cr = br; br = t;
        } else if (j < 64) {
          t = safeAdd(al, safeAdd(f4(bl, cl, dl), 0x8f1bbcdc));
          t = safeAdd(t, x[zl[j]]);
          t = safeAdd(rol(t, sl[j]), el);
          al = el; el = dl; dl = rol(cl, 10); cl = bl; bl = t;

          t = safeAdd(ar, safeAdd(f2(br, cr, dr), 0x7a6d76e9));
          t = safeAdd(t, x[zr[j]]);
          t = safeAdd(rol(t, sr[j]), er);
          ar = er; er = dr; dr = rol(cr, 10); cr = br; br = t;
        } else {
          t = safeAdd(al, safeAdd(f5(bl, cl, dl), 0xa953fd4e));
          t = safeAdd(t, x[zl[j]]);
          t = safeAdd(rol(t, sl[j]), el);
          al = el; el = dl; dl = rol(cl, 10); cl = bl; bl = t;

          t = safeAdd(ar, f1(br, cr, dr));
          t = safeAdd(t, x[zr[j]]);
          t = safeAdd(rol(t, sr[j]), er);
          ar = er; er = dr; dr = rol(cr, 10); cr = br; br = t;
        }
      }

      const t0 = safeAdd(h1, safeAdd(cl, dr));
      h1 = safeAdd(h2, safeAdd(dl, er));
      h2 = safeAdd(h3, safeAdd(el, ar));
      h3 = safeAdd(h4, safeAdd(al, br));
      h4 = safeAdd(h0, safeAdd(bl, cr));
      h0 = t0;
    }

    const out = [];
    [h0, h1, h2, h3, h4].forEach(val => {
      out.push(val & 0xff);
      out.push((val >> 8) & 0xff);
      out.push((val >> 16) & 0xff);
      out.push((val >> 24) & 0xff);
    });
    return new Uint8Array(out);
  }

  // SHA256 helper (Works synchronously in Node or fallback, async in browser via SubtleCrypto)
  function sha256Sync(data) {
    if (typeof Buffer !== 'undefined') {
      const crypto = require('crypto');
      return new Uint8Array(crypto.createHash('sha256').update(Buffer.from(data)).digest());
    }
    // Minimal pure-JS SHA-256 fallback if WebCrypto is unavailable synchronously
    return fallbackSha256(data);
  }

  function fallbackSha256(data) {
    // Pure JS SHA256
    const K = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];
    let bytes;
    if (typeof data === 'string') bytes = new TextEncoder().encode(data);
    else bytes = new Uint8Array(data);

    let H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const nBits = bytes.length * 8;
    const padded = Array.from(bytes);
    padded.push(0x80);
    while ((padded.length % 64) !== 56) padded.push(0);

    for (let i = 0; i < 4; i++) padded.push((nBits >>> (56 - i * 8)) & 0xff);
    for (let i = 0; i < 4; i++) padded.push((nBits >>> (24 - i * 8)) & 0xff);

    for (let i = 0; i < padded.length; i += 64) {
      const W = new Array(64);
      for (let t = 0; t < 16; t++) {
        W[t] = (padded[i + t * 4] << 24) | (padded[i + t * 4 + 1] << 16) | (padded[i + t * 4 + 2] << 8) | padded[i + t * 4 + 3];
      }
      for (let t = 16; t < 64; t++) {
        const s0 = (rotr(W[t - 15], 7) ^ rotr(W[t - 15], 18) ^ (W[t - 15] >>> 3));
        const s1 = (rotr(W[t - 2], 17) ^ rotr(W[t - 2], 19) ^ (W[t - 2] >>> 10));
        W[t] = (((W[t - 16] + s0) | 0) + ((W[t - 7] + s1) | 0)) | 0;
      }
      let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (let t = 0; t < 64; t++) {
        const S1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25));
        const ch = (e & f) ^ (~e & g);
        const temp1 = (((((h + S1) | 0) + ch) | 0) + ((K[t] + W[t]) | 0)) | 0;
        const S0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22));
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + temp1) | 0;
        d = c; c = b; b = a; a = (temp1 + temp2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    const res = [];
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 4; j++) res.push((H[i] >>> (24 - j * 8)) & 0xff);
    }
    return new Uint8Array(res);
  }

  function rotr(n, b) { return (n >>> b) | (n << (32 - b)); }

  function toHex(uint8arr) {
    let s = '';
    for (let i = 0; i < uint8arr.length; i++) {
      s += uint8arr[i].toString(16).padStart(2, '0');
    }
    return s;
  }

  function fromHex(hex) {
    const clean = hex.replace(/[^0-9a-fA-F]/g, '');
    const arr = new Uint8Array(clean.length / 2);
    for (let i = 0; i < clean.length; i += 2) {
      arr[i / 2] = parseInt(clean.substr(i, 2), 16);
    }
    return arr;
  }

  // Canonical JSON serialization matching Python's `json.dumps(obj, sort_keys=True)`
  function canonicalJson(obj) {
    if (obj === null || typeof obj !== 'object') {
      return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
      return '[' + obj.map(canonicalJson).join(', ') + ']';
    }
    const keys = Object.keys(obj).sort();
    return '{' + keys.map(k => JSON.stringify(k) + ': ' + canonicalJson(obj[k])).join(', ') + '}';
  }

  /**
   * Derive DOOM address from compressed public key bytes
   * Address = 'doom1' + hex(RIPEMD160(SHA256(compressed_pubkey))) + 4-byte checksum
   */
  function publicKeyToAddress(pubKeyCompressedHex) {
    const pubBytes = fromHex(pubKeyCompressedHex);
    const sha = sha256Sync(pubBytes);
    const ripemd = ripemd160(sha);
    const checksum = sha256Sync(sha256Sync(ripemd)).slice(0, 4);

    const full = new Uint8Array(ripemd.length + checksum.length);
    full.set(ripemd, 0);
    full.set(checksum, ripemd.length);
    return 'doom1' + toHex(full);
  }

  // Public Interface
  const DoomsdayCrypto = {
    COIN: COIN,

    /**
     * Generate fresh secp256k1 keypair completely inside browser memory
     */
    generateWallet: function () {
      let privBytes;
      if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
        privBytes = new Uint8Array(32);
        window.crypto.getRandomValues(privBytes);
      } else {
        const crypto = require('crypto');
        privBytes = crypto.randomBytes(32);
      }
      const privHex = toHex(privBytes);
      return this.getWalletFromKey(privHex);
    },

    /**
     * Derive address and validate private key from 64-char hex string
     */
    getWalletFromKey: function (privHex) {
      const cleanHex = privHex.trim().toLowerCase();
      if (!/^[0-9a-f]{64}$/.test(cleanHex)) {
        throw new Error('Invalid private key: must be a 64-character hex string');
      }
      const key = ec.keyFromPrivate(cleanHex, 'hex');
      const pubCompressed = key.getPublic(true, 'hex');
      const address = publicKeyToAddress(pubCompressed);
      return {
        address: address,
        private_key: cleanHex,
        public_key: pubCompressed
      };
    },

    /**
     * Locally sign a raw transaction without sending private key to any server
     */
    signTransaction: function (txParams) {
      const { fromAddress, privateKeyHex, toAddress, amountDoom, feeDoom = 0.001, utxos } = txParams;
      const wallet = this.getWalletFromKey(privateKeyHex);
      if (wallet.address !== fromAddress) {
        throw new Error('Private key does not correspond to the sender address');
      }

      const amountSparks = Math.round(amountDoom * COIN);
      const feeSparks = Math.round(Math.max(0.0001, feeDoom) * COIN);
      const totalRequired = amountSparks + feeSparks;

      // Select UTXOs
      const inputs = [];
      let accum = 0;
      for (const utxo of utxos) {
        inputs.push({
          txid: utxo.txid,
          vout: utxo.vout,
          signature: '',
          pubkey_hex: ''
        });
        accum += utxo.amount;
        if (accum >= totalRequired) break;
      }

      if (accum < totalRequired) {
        throw new Error(`Insufficient balance: available ${(accum / COIN).toFixed(4)} DOOM, needed ${(totalRequired / COIN).toFixed(4)} DOOM (including ${(feeSparks / COIN).toFixed(4)} fee)`);
      }

      const outputs = [
        { recipient: toAddress, amount: amountSparks }
      ];
      const change = accum - totalRequired;
      if (change > 0) {
        outputs.push({ recipient: fromAddress, amount: change });
      }

      const timestamp = Math.floor(Date.now() / 1000);
      const key = ec.keyFromPrivate(wallet.private_key, 'hex');
      const pubHex = wallet.public_key;

      // Sign each input
      for (let i = 0; i < inputs.length; i++) {
        const summary = {
          inputs: inputs.map(inp => ({ txid: inp.txid, vout: inp.vout })),
          outputs: outputs.map(out => ({ amount: out.amount, recipient: out.recipient })),
          signing_input_index: i,
          timestamp: timestamp
        };
        const canonical = canonicalJson(summary);
        const rawDigest = sha256Sync(new TextEncoder().encode(canonical));
        // Matches Python: private_key.sign(rawDigest, ec.ECDSA(hashes.SHA256()))
        const doubleDigest = sha256Sync(rawDigest);
        const sig = key.sign(doubleDigest, { canonical: true });
        const derHex = toHex(new Uint8Array(sig.toDER()));

        inputs[i].signature = derHex;
        inputs[i].pubkey_hex = pubHex;
      }

      // Calculate final TXID
      const txSummary = {
        extra_data: '',
        inputs: inputs.map(inp => ({ txid: inp.txid, vout: inp.vout })),
        is_coinbase: false,
        outputs: outputs.map(out => ({ amount: out.amount, recipient: out.recipient })),
        timestamp: timestamp
      };
      const finalCanonical = canonicalJson(txSummary);
      const txid = toHex(sha256Sync(new TextEncoder().encode(finalCanonical)));

      return {
        txid: txid,
        inputs: inputs,
        outputs: outputs,
        timestamp: timestamp,
        is_coinbase: false,
        extra_data: ''
      };
    }
  };

  return DoomsdayCrypto;
}));
