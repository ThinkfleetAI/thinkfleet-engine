---
name: web-scraping
description: Web scraping and data extraction from websites
metadata:
  moltbot_emoji: "🕷️"
  requires_bins:
    - curl
    - python3
  requires_env: []
---

# Web Scraping

Tools and techniques for fetching and extracting data from web pages.

## Fetch page with curl

```bash
# Fetch a web page and save to file
curl -sL -o page.html "https://example.com"

# Fetch with a custom user agent
curl -sL -A "Mozilla/5.0 (compatible; bot/1.0)" "https://example.com"

# Fetch with headers output
curl -sL -D headers.txt -o page.html "https://example.com"

# Fetch only the HTTP headers
curl -sI "https://example.com"
```

## Extract links with python

```bash
python3 -c "
from html.parser import HTMLParser

class LinkExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            for name, value in attrs:
                if name == 'href':
                    self.links.append(value)

with open('page.html') as f:
    parser = LinkExtractor()
    parser.feed(f.read())
    for link in parser.links:
        print(link)
"
```

## Extract text content

```bash
python3 -c "
from html.parser import HTMLParser

class TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.text = []
        self._skip = False
    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'):
            self._skip = True
    def handle_endtag(self, tag):
        if tag in ('script', 'style'):
            self._skip = False
    def handle_data(self, data):
        if not self._skip:
            stripped = data.strip()
            if stripped:
                self.text.append(stripped)

with open('page.html') as f:
    parser = TextExtractor()
    parser.feed(f.read())
    print('\n'.join(parser.text))
"
```

## Scrape structured data (tables)

```bash
python3 -c "
from html.parser import HTMLParser
import csv, sys

class TableExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tables, self.current_table, self.current_row = [], [], []
        self.current_cell, self.in_cell = '', False
    def handle_starttag(self, tag, attrs):
        if tag == 'table': self.current_table = []
        elif tag in ('td', 'th'): self.in_cell, self.current_cell = True, ''
        elif tag == 'tr': self.current_row = []
    def handle_endtag(self, tag):
        if tag in ('td', 'th'):
            self.in_cell = False
            self.current_row.append(self.current_cell.strip())
        elif tag == 'tr': self.current_table.append(self.current_row)
        elif tag == 'table': self.tables.append(self.current_table)
    def handle_data(self, data):
        if self.in_cell: self.current_cell += data

with open('page.html') as f:
    p = TableExtractor()
    p.feed(f.read())
    w = csv.writer(sys.stdout)
    for table in p.tables:
        for row in table:
            w.writerow(row)
        print('---')
"
```

## Download file

```bash
# Download a file preserving the remote filename
curl -sLOJ "https://example.com/file.zip"

# Download with a specific output name
curl -sL -o output.zip "https://example.com/file.zip"

# Resume an interrupted download
curl -sL -C - -o largefile.zip "https://example.com/largefile.zip"
```

## Follow pagination

```bash
python3 -c "
import subprocess

base_url = 'https://example.com/items?page='
all_content = []

for page in range(1, 11):
    url = f'{base_url}{page}'
    result = subprocess.run(['curl', '-sL', url], capture_output=True, text=True)
    html = result.stdout
    if not html.strip() or 'no results' in html.lower():
        break
    all_content.append(html)
    if f'page={page+1}' not in html and 'next' not in html.lower():
        break
    print(f'Fetched page {page}', flush=True)

with open('all_pages.html', 'w') as f:
    f.write('\n'.join(all_content))
print(f'Total pages fetched: {len(all_content)}')
"
```

## Parse JSON-LD/microdata

```bash
python3 -c "
import json, re

with open('page.html') as f:
    html = f.read()

# Extract JSON-LD blocks
pattern = r'<script[^>]*type=[\x22\x27]application/ld\+json[\x22\x27][^>]*>(.*?)</script>'
matches = re.findall(pattern, html, re.DOTALL | re.IGNORECASE)

for i, match in enumerate(matches):
    try:
        data = json.loads(match)
        print(f'--- JSON-LD block {i+1} ---')
        print(json.dumps(data, indent=2))
    except json.JSONDecodeError as e:
        print(f'Block {i+1}: parse error: {e}')

# Extract Open Graph and other meta tags
meta_pattern = r'<meta\s+(?:property|name)=[\x22]([^\x22]+)[\x22]\s+content=[\x22]([^\x22]*)[\x22]'
metas = re.findall(meta_pattern, html, re.IGNORECASE)
if metas:
    print('--- Meta tags ---')
    for name, content in metas:
        print(f'{name}: {content}')
"
```
