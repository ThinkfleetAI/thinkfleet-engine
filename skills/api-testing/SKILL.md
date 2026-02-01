---
name: api-testing
description: "Test APIs with Newman/Postman collections, contract testing with Pact, mock servers, and GraphQL testing."
metadata: {"moltbot":{"emoji":"🧪","requires":{"bins":["curl","jq"]}}}
---

# API Testing

Comprehensive API testing: functional, contract, mock, and GraphQL.

## Functional API Testing with curl

### REST endpoints

```bash
# GET with response validation
response=$(curl -s -w "\n%{http_code}" https://api.example.com/users/1)
body=$(echo "$response" | head -n -1)
status=$(echo "$response" | tail -1)
echo "Status: $status"
echo "$body" | jq .

# POST with payload
curl -s -X POST https://api.example.com/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_TOKEN" \
  -d '{"name": "Test User", "email": "test@example.com"}' | jq .

# PUT update
curl -s -X PUT https://api.example.com/users/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_TOKEN" \
  -d '{"name": "Updated User"}' | jq .

# DELETE
curl -s -X DELETE https://api.example.com/users/1 \
  -H "Authorization: Bearer $API_TOKEN" -w "\nHTTP %{http_code}\n"

# PATCH
curl -s -X PATCH https://api.example.com/users/1 \
  -H "Content-Type: application/json" \
  -d '{"status": "active"}' | jq .
```

### Validate response schema

```bash
# Check required fields exist
curl -s https://api.example.com/users/1 | jq 'has("id", "name", "email")'

# Check array response length
curl -s https://api.example.com/users | jq 'length'

# Check field types
curl -s https://api.example.com/users/1 | jq '{id_is_number: (.id | type == "number"), name_is_string: (.name | type == "string")}'
```

## Newman (Postman CLI)

```bash
# Run a Postman collection
newman run collection.json

# With environment variables
newman run collection.json -e environment.json

# Generate HTML report
newman run collection.json --reporters cli,htmlextra --reporter-htmlextra-export report.html

# Run specific folder in collection
newman run collection.json --folder "User CRUD"

# With iteration data (CSV/JSON)
newman run collection.json -d test-data.csv -n 10

# Bail on first failure
newman run collection.json --bail
```

## Contract Testing (Pact)

### Consumer side (JavaScript example)

```bash
# Install
npm install --save-dev @pact-foundation/pact

# Run consumer tests that generate pact files
npx jest --testPathPattern=pact

# Pact files output to pacts/ directory
ls pacts/
```

### Provider verification

```bash
# Verify provider against pact
npx jest --testPathPattern=pact-verification

# Or using Pact CLI
pact-provider-verifier --provider-base-url http://localhost:3000 \
  --pact-url pacts/consumer-provider.json
```

## Mock Servers

### Prism (OpenAPI mock)

```bash
# Mock from OpenAPI spec
npx @stoplight/prism-cli mock openapi.yaml

# Mock with dynamic responses
npx @stoplight/prism-cli mock openapi.yaml --dynamic

# Validate requests against spec
npx @stoplight/prism-cli proxy openapi.yaml http://localhost:3000
```

### Simple mock with Node

```bash
# Quick JSON server for REST mocking
npx json-server --watch db.json --port 3001

# db.json format:
# {"users": [{"id": 1, "name": "Test"}], "posts": [{"id": 1, "title": "Hello"}]}
```

## GraphQL Testing

```bash
# Query
curl -s -X POST https://api.example.com/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ users { id name email } }"}' | jq .

# Mutation
curl -s -X POST https://api.example.com/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query": "mutation { createUser(name: \"Test\", email: \"t@t.com\") { id } }"}' | jq .

# Introspection (check if disabled in prod)
curl -s -X POST https://api.example.com/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ __schema { types { name } } }"}' | jq '.data.__schema.types | length'

# With variables
curl -s -X POST https://api.example.com/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query GetUser($id: ID!) { user(id: $id) { name } }", "variables": {"id": "1"}}' | jq .
```

## Notes

- Test error responses too — send bad data and verify proper 400/422 responses.
- Contract tests prevent integration breakage between services. Run them in CI.
- Mock servers unblock frontend development when backend isn't ready.
- GraphQL introspection should be disabled in production — test for it.
- Always test with authentication. Unauthenticated endpoints are a security risk.
