# Autonomous Agent Framework Integrations

Doomsday Proof-of-Escrow natively equips autonomous AI coding agents with cryptographic on-chain verification before consuming compute on open-source bounties.

## Supported Frameworks

| Framework | Tool Module | Use Case |
| :--- | :--- | :--- |
| **GitHub Actions** | [`actions/verify-escrow`](../actions/verify-escrow/) | CI/CD automated bounty auditing & Proof-of-Escrow status badges |
| **Model Context Protocol (MCP)** | [`integrations/mcp`](mcp/) | Claude Desktop, Antigravity, Cursor, Windsurf, generic MCP clients |
| **TypeScript/Node 22 stdio MCP (no npm dependencies)** | [`integrations/node_stdio_mcp`](node_stdio_mcp/) | Cross-platform MCP transport with issuer-claimed escrow provenance, strict GitHub path validation, read-only default, explicit one-time faucet opt-in |
| **LangChain & LangGraph** | [`integrations/langchain`](langchain/) | Autonomous Python workflows & ReAct agents |
| **LlamaIndex** | [`integrations/llamaindex`](llamaindex/) | Query engines, RAG pipelines, and agentic workflows |
| **CrewAI** | [`integrations/crewai`](crewai/) | Multi-agent collaboration (Researcher + Planner + Coder) |
| **ElizaOS (ai16z)** | [`integrations/elizaos`](elizaos/) | Autonomous Web3 AI agents, Discord/Telegram bots, multi-agent runtimes |
| **AutoGPT** | [`integrations/autogpt`](autogpt/) | Autonomous goal-oriented agent workflows & execution blocks |
| **Microsoft AutoGen** | [`integrations/autogen`](autogen/) | Conversable multi-agent systems & automated group chats |
| **OpenAI Agents SDK** | [`integrations/openai_agents`](openai_agents/) | Python agents, function tools, and handoffs |
| **OpenAI Function-Calling & Smolagents** | [`integrations/openai-agents`](openai-agents/) | OpenAI Function-Calling, Responses API, Smolagents & MCP Server |
| **Pydantic AI** | [`integrations/pydantic_ai`](pydantic_ai/) | Typed Python agent tools with standard-library HTTP client |
| **Google Antigravity** | [`integrations/antigravity`](antigravity/) | Standard-library agent tools & SKILL.md for Google Antigravity & Gemini agents |
| **Google ADK** | [`integrations/google_adk`](google_adk/) | `FunctionTool` wrappers for Google Agent Development Kit |
| **Agno** | [`integrations/agno`](agno/) | Typed Python function tools for escrow and miner telemetry checks |
| **Microsoft Semantic Kernel** | [`integrations/semantic_kernel`](semantic_kernel/) | Kernel plugin with three read-only escrow functions |
| **Haystack** | [`integrations/haystack`](haystack/) | Typed Haystack `Tool` objects for escrow and miner checks |
| **Hugging Face smolagents** | [`integrations/smolagents`](smolagents/) | `CodeAgent` and `ToolCallingAgent` `Tool` subclasses |
| **Claude-Flow & Cursor MCP** | [`integrations/claude-flow-mcp`](claude-flow-mcp/) | Zero-dependency stdio MCP server & SKILL.md for Claude Code / Cursor |
| **Agent SKILL.md** | [`integrations/skills`](skills/) | LLM-ready markdown specification and tool contracts |

## Quick Verification Example

Every integration tool validates cryptographic UTXO collateral on **Doomsday L1** and **Base Mainnet** (`0x623c84A5E04bF715018203334b0eFE41696eBC3E`):

```python
# Zero-dependency check
from integrations.llamaindex.doomsday_tool import DoomsdayLlamaIndexClient

client = DoomsdayLlamaIndexClient()
escrow_json = client.verify_bounty_escrow("doomsday-network", "doomsday", 11)
print(escrow_json)
```