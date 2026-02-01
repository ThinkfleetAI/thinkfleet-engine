---
name: mcp-builder
description: "Build Model Context Protocol (MCP) servers: define tools, resources, and prompts that AI agents can discover and use."
metadata: {"thinkfleetbot":{"emoji":"🔌","requires":{"anyBins":["node","npx"]}}}
---

# MCP Server Builder

Build MCP (Model Context Protocol) servers that expose tools, resources, and prompts to AI agents.

## Quickstart — Create an MCP Server

```bash
# Scaffold with official SDK
npx @modelcontextprotocol/create-server my-mcp-server
cd my-mcp-server
npm install
```

## Server Structure (TypeScript)

```typescript
// src/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "my-server", version: "1.0.0" });

// Define a tool
server.tool("get_weather", { city: z.string() }, async ({ city }) => ({
  content: [{ type: "text", text: `Weather in ${city}: 72°F, sunny` }],
}));

// Define a resource
server.resource("config", "config://app", async () => ({
  contents: [{ uri: "config://app", text: JSON.stringify({ env: "production" }) }],
}));

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
```

## Build and Test

```bash
# Build
npm run build

# Test with MCP inspector
npx @modelcontextprotocol/inspector node dist/index.js

# Test tool call directly
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_weather","arguments":{"city":"NYC"}}}' | node dist/index.js
```

## Register in Claude Code Config

```json5
// ~/.claude/settings.json or project .claude/settings.json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["/path/to/my-mcp-server/dist/index.js"],
      "env": {
        "API_KEY": "your-key"
      }
    }
  }
}
```

## Python MCP Server

```bash
# Install SDK
pip install mcp

# Create server
cat > server.py << 'EOF'
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("my-server")

@mcp.tool()
def get_data(query: str) -> str:
    """Fetch data based on query."""
    return f"Results for: {query}"

@mcp.resource("config://app")
def get_config() -> str:
    """Application configuration."""
    return '{"env": "production"}'

if __name__ == "__main__":
    mcp.run()
EOF

# Run
python server.py
```

## Tool Design Best Practices

- **Clear names**: `search_users` not `do_search`. Verb + noun.
- **Typed inputs**: Use Zod (TS) or type hints (Python) for all parameters.
- **Good descriptions**: The AI reads these to decide when to use the tool.
- **Error handling**: Return error messages, don't throw. The AI needs to understand what went wrong.
- **Idempotent reads**: GET-like tools should be safe to call multiple times.
- **Confirm writes**: Destructive tools should describe what they'll do before doing it.

## Notes

- MCP servers communicate over stdio (stdin/stdout). Don't print debug info to stdout.
- Use stderr for logging: `console.error("debug info")`.
- Test with the inspector before connecting to an agent.
- Keep tools focused — one tool per operation, not a mega-tool with mode switches.
- Resources are for context the agent reads. Tools are for actions the agent takes.
