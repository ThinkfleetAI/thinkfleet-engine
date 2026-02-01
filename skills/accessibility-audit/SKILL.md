---
name: accessibility-audit
description: "WCAG 2.2 compliance auditing: automated scanning with axe-core, keyboard navigation testing, screen reader checks, and color contrast validation."
metadata: {"moltbot":{"emoji":"♿","requires":{"anyBins":["npx","node"]}}}
---

# Accessibility Audit

Test web applications for WCAG 2.2 compliance and inclusive design.

## Automated Scanning

### axe-core CLI

```bash
# Scan a URL
npx @axe-core/cli https://example.com

# Scan with specific rules
npx @axe-core/cli https://example.com --rules color-contrast,label

# JSON output
npx @axe-core/cli https://example.com --format json > a11y-report.json

# Disable specific rules
npx @axe-core/cli https://example.com --disable scrollable-region-focusable
```

### Lighthouse accessibility audit

```bash
# Accessibility category only
lighthouse https://example.com --only-categories=accessibility --output json | jq '{score: .categories.accessibility.score, issues: [.audits | to_entries[] | select(.value.score == 0) | {id: .key, title: .value.title, description: .value.description}]}'

# Desktop
lighthouse https://example.com --only-categories=accessibility --preset=desktop --output json | jq '.categories.accessibility.score'
```

### Playwright with axe-core

```bash
# Install
npm install --save-dev @axe-core/playwright

# Test file
cat > a11y.spec.ts << 'EOF'
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('homepage has no a11y violations', async ({ page }) => {
  await page.goto('http://localhost:3000');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('form page has no a11y violations', async ({ page }) => {
  await page.goto('http://localhost:3000/form');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});
EOF

npx playwright test a11y.spec.ts
```

## Color Contrast

```bash
# Check contrast ratio (needs two hex colors)
# WCAG AA: 4.5:1 for normal text, 3:1 for large text
# WCAG AAA: 7:1 for normal text, 4.5:1 for large text

python3 -c "
def luminance(hex_color):
    r, g, b = [int(hex_color[i:i+2], 16)/255 for i in (1, 3, 5)]
    def adjust(c): return c/12.92 if c <= 0.03928 else ((c+0.055)/1.055)**2.4
    return 0.2126*adjust(r) + 0.7152*adjust(g) + 0.0722*adjust(b)

def contrast(c1, c2):
    l1, l2 = luminance(c1), luminance(c2)
    lighter, darker = max(l1,l2), min(l1,l2)
    return (lighter + 0.05) / (darker + 0.05)

fg, bg = '#333333', '#FFFFFF'
ratio = contrast(fg, bg)
print(f'Contrast ratio: {ratio:.2f}:1')
print(f'AA normal text (4.5:1): {\"PASS\" if ratio >= 4.5 else \"FAIL\"}')
print(f'AA large text (3:1): {\"PASS\" if ratio >= 3 else \"FAIL\"}')
print(f'AAA normal text (7:1): {\"PASS\" if ratio >= 7 else \"FAIL\"}')
"
```

## Keyboard Navigation Check

### Manual testing checklist
```
[ ] All interactive elements reachable via Tab
[ ] Tab order follows visual/logical order
[ ] Focus indicator visible on all focused elements
[ ] Escape closes modals/dropdowns
[ ] Enter/Space activates buttons and links
[ ] Arrow keys navigate within menus, tabs, radio groups
[ ] No keyboard traps (can Tab out of every component)
[ ] Skip-to-content link present
```

### Automated focus order check

```bash
# Playwright: verify tab order
cat > focus-order.spec.ts << 'EOF'
import { test, expect } from '@playwright/test';

test('tab order is correct', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.keyboard.press('Tab');
  const first = await page.evaluate(() => document.activeElement?.tagName);
  expect(first).toBe('A'); // Skip link or first nav item
});
EOF
```

## Common Issues

| Issue | Fix |
|-------|-----|
| Missing alt text on images | Add descriptive `alt=""` (decorative) or `alt="description"` |
| Missing form labels | Add `<label for="id">` or `aria-label` |
| Low color contrast | Increase contrast to 4.5:1 minimum |
| Missing heading hierarchy | Use h1 → h2 → h3 in order, don't skip levels |
| Non-descriptive link text | "Read more about pricing" not "Click here" |
| Missing ARIA landmarks | Use semantic HTML: `<nav>`, `<main>`, `<aside>`, `<footer>` |
| Auto-playing media | Add pause/stop controls |

## Notes

- Automated tools catch ~30% of accessibility issues. Manual testing is required.
- Test with actual screen readers: VoiceOver (macOS), NVDA (Windows), TalkBack (Android).
- Semantic HTML (`<button>`, `<nav>`, `<main>`) is more accessible than `<div>` with ARIA roles.
- ARIA is a last resort — use native HTML elements first.
- Test at 200% zoom — content should reflow without horizontal scrolling.
