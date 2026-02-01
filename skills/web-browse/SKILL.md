---
name: web-browse
description: "Fetch and parse web pages using curl + python for HTML-to-text extraction."
metadata: {"moltbot":{"emoji":"🌐","requires":{"bins":["curl","python3"]}}}
---

# Web Browse

Fetch web pages and extract readable text content.

## Quick fetch (raw HTML)

```bash
curl -sL "https://example.com" | head -200
```

## Extract text with Python

```bash
curl -sL "https://example.com" | python3 -c "
import sys, html, re
raw = sys.stdin.read()
text = re.sub(r'<script[^>]*>.*?</script>', '', raw, flags=re.DOTALL)
text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL)
text = re.sub(r'<[^>]+>', ' ', text)
text = html.unescape(text)
text = re.sub(r'\s+', ' ', text).strip()
print(text[:8000])
"
```

## Get page title and meta

```bash
curl -sL "https://example.com" | python3 -c "
import sys, re
h = sys.stdin.read()
title = re.search(r'<title>(.*?)</title>', h, re.I|re.S)
desc = re.search(r'<meta[^>]*name=[\"']description[\"'][^>]*content=[\"'](.*?)[\"']', h, re.I)
print(f'Title: {title.group(1).strip() if title else \"N/A\"}')
print(f'Description: {desc.group(1).strip() if desc else \"N/A\"}')
"
```

## Download a file

```bash
curl -sL -o /tmp/file.pdf "https://example.com/report.pdf"
```

## Notes

- Respect robots.txt. Do not scrape excessively.
- Use `-L` to follow redirects.
- For JavaScript-heavy sites, consider the browser skill.
