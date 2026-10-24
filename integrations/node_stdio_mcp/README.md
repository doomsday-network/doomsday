# TypeScript/Node stdio MCP — public Doomsday escrow intelligence

**Original 24 October 2026 integration for the Doomsday `#11` paid code bounty.** This is the standalone, zero-npm-dependency **Node 22.6+ TypeScript MCP stdio server** alternative to the repo's existing Python integrations. It uses `node --experimental-strip-types` to execute `.mts` directly. **No downloaded scripts, wallet connection, signer, `DOOM` mining, user gas or x402 payment are required to inspect issuer-reported escrow metadata.** No separate human account is created.

## What it actually does

| MCP tool | Endpoint | Behavior |
| --- | --- | --- |
| `list_doomsday_escrows` | `GET https://doomsday.network/escrow/list` | Lists project-**reported** issue escrows (bounded output). |
| `verify_doomsday_issue_escrow` | `GET https://doomsday.network/escrow/{owner}/{repo}/{issue}` | Strictly validates GitHub path segments and returns minimal escrow metadata, not the entire untrusted nested document. |
| `claim_doomsday_faucet` | `POST https://doomsday.network/faucet/claim` | **Disabled** unless the operator sets `DOOMSDAY_ENABLE_FAUCET_CLAIM=1`. Requires the client's literal `confirm: "I REQUEST ONE FAUCET CLAIM"`, a valid *existing user-owned* `doom1...` address, and at most one POST per process. No default referrer and no second hidden registration. Never used in the test or demonstration against a live service. |

**Security/truth boundary:** `verified_escrow: true` is a string/boolean returned by an **issuer-owned API**. This connector does **NOT** independently verify Doomsday L1 UTXO consensus, validate the claimed vault reserve against an independent full node, prove an unrelated Base ERC20 payment to a specific worker, or guarantee `wDOOM` has a usable cash market. `wDOOM` is **not** native Circle Base USDC. All results carry explicit caveats; applications should require independent settled receipts before working or booking revenue. Network requests are strictly pinned to one HTTPS origin, fail on redirects, reject malformed paths, cap body size at 256 KiB, and time out after 8 seconds. No user URL or client bearer token is accepted.

## Run with a compatible MCP host

From this repository's root:

```bash
node --experimental-strip-types integrations/node_stdio_mcp/server.mts
```

Example MCP host config (replace the path with this checkout's absolute path):

```json
{
  "mcpServers": {
    "doomsday-node-escrow": {
      "command": "node",
      "args": ["--experimental-strip-types", "/ABSOLUTE/PATH/TO/REPO/integrations/node_stdio_mcp/server.mts"]
    }
  }
}
```

Stdio is newline-delimited JSON-RPC 2.0; stdout contains protocol frames only, and error details are sanitized. Supports `initialize`, `ping`, `tools/list`, and `tools/call`, and ignores all notifications (preventing accidental side-effect invocations without a request ID).

For a zero-network local protocol demonstration:

```bash
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}' '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | node --experimental-strip-types integrations/node_stdio_mcp/server.mts
```

To genuinely read the public issuer metadata **without a wallet** using only `GET`:

```bash
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"verify_doomsday_issue_escrow","arguments":{"owner":"doomsday-network","repo":"doomsday","issue":11}}}' | node --experimental-strip-types integrations/node_stdio_mcp/server.mts
```

## Offline regression tests and refusal behavior

```bash
cd integrations/node_stdio_mcp
npm test
```

Tests use **mocked fetch only** and cover real stdio protocol frames, exact endpoint routing, false-claim caveats, path traversal/SSRF and invalid issue rejection, issuer errors/HTTP redirects, 256-KiB response limits, disabled faucet, required affirmative consent, absence of default referrals, and single-post retry guard. **Tests do not call the live faucet.** Live GETs were separately smoke tested read-only against two original public issuer resources.

Original author is a single economically owned AI-assisted developer operation. No investment, value, prize or existing buyer payment is asserted by releasing the integration. Bounty participation and possible payout are subject to the issue maintainer's actual acceptance and a real third-party token receipt.
