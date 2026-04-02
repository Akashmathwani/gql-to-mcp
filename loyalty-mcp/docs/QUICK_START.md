# Quick Start Guide - Loyalty MCP Server

## 🚀 Get Up and Running in 5 Minutes

### Step 1: Install Dependencies

From the **root of the monorepo**:

```bash
npm install
```

This will install dependencies for all workspaces including loyalty-mcp.

### Step 2: Build the Core Package

```bash
cd packages/gql-mcp
npm run build
cd ../..
```

### Step 3: Configure Environment

Navigate to loyalty-mcp and set up your environment:

```bash
cd loyalty-mcp
cp .env .env.backup  # Backup if exists
```

Edit `.env` with your actual values:

```env
GRAPHQL_ENDPOINT=https://your-loyalty-graphql-api.com/graphql
X_API_KEY=your_api_key_here
NEW_RELIC_OTLP_ENDPOINT=https://otlp.nr-data.net:4317
NEW_RELIC_LICENSE_KEY=your_new_relic_key_here
```

### Step 4: Build Loyalty MCP

```bash
npm run build
```

### Step 5: Start the Server

**Development mode with hot reload:**
```bash
npm run dev:watch
```

**Or simple dev mode:**
```bash
npm run dev
```

**Or production mode:**
```bash
npm start
```

### Step 6: Verify It's Running

```bash
# Check health endpoint
curl http://localhost:6275/health

# Should return:
# {"status":"ok","timestamp":"..."}
```

## 🧪 Test Your First Tool

### Using cURL

```bash
curl http://localhost:6275/mcp -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/list"
  }'
```

You should see a list of available tools:
- `get_points_balance`
- `get_points_transactions`
- `get_tier_status`
- `list_rewards`
- `redeem_reward`

### Using MCP Inspector

1. Open browser: http://localhost:6275
2. Click on any tool to test it
3. Fill in the required parameters
4. Click "Execute"

## 📝 Example Tool Calls

### Get Points Balance

```json
{
  "method": "tools/call",
  "params": {
    "name": "get_points_balance",
    "arguments": {
      "customerId": "CUST123"
    }
  }
}
```

### List Rewards

```json
{
  "method": "tools/call",
  "params": {
    "name": "list_rewards",
    "arguments": {
      "category": "vouchers",
      "limit": 10
    }
  }
}
```

## 🔧 Customizing for Your GraphQL Schema

The tools include example GraphQL queries. You'll need to update them to match your actual schema:

1. Open any tool file (e.g., `src/tools/loyalty/points/get-balance.ts`)
2. Update the GraphQL query constant
3. Update the response type interface
4. Adjust the data mapping logic
5. Rebuild: `npm run build`

### Example Modification

**Before (example query):**
```graphql
query GetPointsBalance($customerId: ID!) {
  loyalty {
    customer(id: $customerId) {
      points { balance }
    }
  }
}
```

**After (your actual schema):**
```graphql
query GetPointsBalance($customerId: ID!) {
  loyaltyCustomer(id: $customerId) {
    pointsBalance
    availablePoints
  }
}
```

## 🎯 Next Steps

1. **Update GraphQL Queries** - Match your actual schema
2. **Test with Real Data** - Use actual customer IDs
3. **Add Authentication** - Enable JWT auth in config
4. **Add More Tools** - Create custom tools for your use case
5. **Deploy** - Follow your deployment process

## 🆘 Troubleshooting

### Server won't start
```bash
# Check if port is already in use
lsof -i :6275

# Kill process if needed
kill -9 <PID>
```

### GraphQL errors
- Verify your `GRAPHQL_ENDPOINT` is correct
- Check API key is valid
- Test endpoint with curl: `curl -H "x-api-key: YOUR_KEY" YOUR_ENDPOINT`

### Build errors
```bash
# Clean and rebuild
npm run build:clean

# Or rebuild core package first
cd ../packages/gql-mcp && npm run build:clean && cd ../../loyalty-mcp
```

### No logs appearing
- Logs go to **stderr**, not stdout
- Try: `npm run dev 2>&1 | tee debug.log`
- Set `logging.format: pretty` in `mcp-config.yaml` for readable logs

## 📚 Learn More

- [Full README](./README.md) - Detailed documentation
- [gql-mcp Framework](../packages/gql-mcp/README.md) - Core framework docs
- [agentic-commerce](../agentic-commerce/README.md) - Reference implementation

## 💡 Pro Tips

1. **Use pretty logging during development:**
   - Edit `mcp-config.yaml`: `logging.format: pretty`

2. **Disable telemetry for local dev:**
   - Edit `mcp-config.yaml`: `telemetry.enabled: false`

3. **Test without auth first:**
   - Keep `auth` section commented out until your queries work

4. **Use MCP Inspector for debugging:**
   - Open http://localhost:6275 in browser
   - See tool schemas and test executions

Happy coding! 🎉
