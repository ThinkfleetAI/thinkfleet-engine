---
name: api-security
description: "Audit APIs for OWASP top 10 vulnerabilities, test authentication flows, validate input handling, and check rate limiting."
metadata: {"thinkfleetbot":{"emoji":"🔐","requires":{"bins":["curl","jq"]}}}
---

# API Security

Test and audit API endpoints for common security vulnerabilities.

## Authentication Testing

### Test for broken authentication

```bash
# Test endpoint without auth (should return 401)
curl -s -o /dev/null -w "%{http_code}" https://api.example.com/protected

# Test with expired token
curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer expired.token.here" https://api.example.com/protected

# Test with empty auth header
curl -s -o /dev/null -w "%{http_code}" -H "Authorization: " https://api.example.com/protected

# Test JWT without signature verification (alg:none attack)
# Header: {"alg":"none","typ":"JWT"} Base64: eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0
curl -s -H "Authorization: Bearer eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxIn0." https://api.example.com/protected
```

## Authorization Testing (IDOR)

```bash
# Test accessing another user's resource (replace IDs)
curl -s -H "Authorization: Bearer $USER_A_TOKEN" https://api.example.com/users/USER_B_ID | jq .

# Test sequential ID enumeration
for id in $(seq 1 10); do
  echo "ID $id: $(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $TOKEN" https://api.example.com/resources/$id)"
done
```

## Input Validation

### SQL injection probes

```bash
# Test string parameter
curl -s "https://api.example.com/search?q=test'%20OR%201=1--" | jq .

# Test numeric parameter
curl -s "https://api.example.com/items/1%20OR%201=1" | jq .
```

### XSS via API

```bash
# Test reflected input in response
curl -s -X POST https://api.example.com/comments \
  -H "Content-Type: application/json" \
  -d '{"text":"<script>alert(1)</script>"}' | jq .
```

### Command injection

```bash
# Test parameter injection
curl -s "https://api.example.com/ping?host=localhost;whoami" | jq .
```

## Rate Limiting Check

```bash
# Send rapid requests and check for 429
for i in $(seq 1 50); do
  code=$(curl -s -o /dev/null -w "%{http_code}" https://api.example.com/endpoint)
  echo "Request $i: $code"
  [ "$code" = "429" ] && echo "Rate limited at request $i" && break
done
```

## Security Headers Check

```bash
# Check response headers
curl -s -I https://api.example.com/ | grep -iE "^(strict-transport|content-security|x-frame|x-content-type|x-xss|referrer-policy|permissions-policy)"
```

Expected secure headers:
- `Strict-Transport-Security` (HSTS)
- `Content-Security-Policy`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy`

## CORS Misconfiguration

```bash
# Test with arbitrary origin
curl -s -I -H "Origin: https://evil.com" https://api.example.com/ | grep -i "access-control"

# Check if credentials are allowed with wildcard
curl -s -I -H "Origin: https://evil.com" https://api.example.com/ | grep -iE "(access-control-allow-origin|access-control-allow-credentials)"
```

## SSL/TLS Check

```bash
# Check certificate and protocol
curl -vI https://api.example.com 2>&1 | grep -E "(SSL|TLS|subject|expire|issuer)"

# Test for weak protocols (should fail)
curl -v --tlsv1.0 --tls-max 1.0 https://api.example.com 2>&1 | tail -5
```

## Notes

- Only test APIs you own or have explicit authorization to test.
- Start with non-destructive tests (GET requests, header checks) before injection tests.
- Document all findings with request/response pairs.
- False positives are common — verify each finding manually.
- Check API documentation for intended security model before testing.
