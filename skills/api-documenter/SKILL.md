---
name: api-documenter
description: "Generate API documentation: OpenAPI 3.1 specs, interactive docs with Swagger/Redoc, SDK generation, and JSDoc/TSDoc extraction."
metadata: {"moltbot":{"emoji":"📖","requires":{"anyBins":["npx","node"]}}}
---

# API Documentation

Generate and maintain API documentation from code and OpenAPI specs.

## OpenAPI Spec Validation

```bash
# Validate an OpenAPI spec
npx @apidevtools/swagger-cli validate openapi.yaml

# Bundle split spec files into one
npx @apidevtools/swagger-cli bundle openapi.yaml -o openapi-bundled.yaml
```

## Interactive Docs

### Swagger UI

```bash
# Serve Swagger UI locally
npx @redocly/cli preview openapi.yaml

# Or with Docker
docker run -p 8080:8080 -e SWAGGER_JSON=/spec/openapi.yaml -v $(pwd):/spec swaggerapi/swagger-ui
```

### Redoc

```bash
# Generate static HTML docs
npx @redocly/cli build-docs openapi.yaml -o docs.html

# Preview with hot reload
npx @redocly/cli preview-docs openapi.yaml
```

## Generate OpenAPI from Code

### Express/Node.js with swagger-jsdoc

```bash
# Install
npm install swagger-jsdoc swagger-ui-express

# Generate spec from JSDoc annotations
node -e "
const swaggerJsdoc = require('swagger-jsdoc');
const spec = swaggerJsdoc({
  definition: { openapi: '3.1.0', info: { title: 'My API', version: '1.0.0' } },
  apis: ['./src/routes/*.ts'],
});
console.log(JSON.stringify(spec, null, 2));
" > openapi.json
```

### FastAPI (Python — auto-generates)

```bash
# FastAPI generates OpenAPI automatically at /docs
# Export the spec:
curl -s http://localhost:8000/openapi.json | jq . > openapi.json
```

## TypeDoc (TypeScript Documentation)

```bash
# Generate docs from TypeScript
npx typedoc --entryPoints src/index.ts --out docs/api

# JSON output
npx typedoc --json docs/api.json --entryPoints src/index.ts

# With README
npx typedoc --entryPoints src/index.ts --out docs/api --readme README.md
```

## JSDoc Extraction

```bash
# Generate HTML docs from JSDoc comments
npx jsdoc src/ -r -d docs/

# With custom template
npx jsdoc src/ -r -d docs/ -t node_modules/clean-jsdoc-theme
```

## SDK Generation from OpenAPI

```bash
# Generate TypeScript client
npx openapi-typescript openapi.yaml -o src/api-types.ts

# Generate full SDK with openapi-generator
npx @openapitools/openapi-generator-cli generate \
  -i openapi.yaml \
  -g typescript-fetch \
  -o src/generated/api

# Python client
npx @openapitools/openapi-generator-cli generate \
  -i openapi.yaml \
  -g python \
  -o generated/python-client
```

## Linting OpenAPI Specs

```bash
# Redocly lint
npx @redocly/cli lint openapi.yaml

# Spectral (custom rules)
npx @stoplight/spectral-cli lint openapi.yaml
```

## Notes

- Write the OpenAPI spec first (design-first), then implement. It's faster than code-first for teams.
- Keep specs in version control alongside the code.
- Validate specs in CI — broken docs are worse than no docs.
- SDK generation saves client teams significant time. Regenerate on every API change.
- Use `$ref` to split large specs into manageable files.
