---
name: visual-regression
description: "Screenshot comparison testing with Playwright, Percy, and Chromatic for catching unintended UI changes."
metadata: {"moltbot":{"emoji":"👁️","requires":{"anyBins":["npx","playwright"]}}}
---

# Visual Regression Testing

Catch unintended UI changes by comparing screenshots across builds.

## Playwright Visual Comparisons

### Generate baseline screenshots

```bash
# Run visual tests and create baseline
npx playwright test --update-snapshots

# Run specific visual test file
npx playwright test visual.spec.ts --update-snapshots
```

### Run comparisons

```bash
# Compare against baseline
npx playwright test visual.spec.ts

# With specific threshold (0 = exact, 0.2 = 20% tolerance)
# Set in test file: expect(page).toHaveScreenshot({ maxDiffPixelRatio: 0.01 })
```

### Example test

```javascript
// visual.spec.ts
import { test, expect } from '@playwright/test';

test('homepage visual', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await expect(page).toHaveScreenshot('homepage.png', {
    fullPage: true,
    maxDiffPixelRatio: 0.01,
  });
});

test('component visual', async ({ page }) => {
  await page.goto('http://localhost:3000/components');
  const card = page.locator('.card').first();
  await expect(card).toHaveScreenshot('card-component.png');
});

test('responsive visual', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('http://localhost:3000');
  await expect(page).toHaveScreenshot('homepage-mobile.png', { fullPage: true });
});
```

## Percy (Cloud Visual Testing)

```bash
# Install
npm install --save-dev @percy/cli @percy/playwright

# Run with Percy snapshots
npx percy exec -- npx playwright test

# Percy environment
export PERCY_TOKEN=your_token_here
```

### Percy in test

```javascript
import { percySnapshot } from '@percy/playwright';

test('homepage', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await percySnapshot(page, 'Homepage');
});
```

## Chromatic (Storybook Visual Testing)

```bash
# Install
npm install --save-dev chromatic

# Run visual tests against Storybook
npx chromatic --project-token=$CHROMATIC_TOKEN

# Accept all changes (after review)
npx chromatic --project-token=$CHROMATIC_TOKEN --auto-accept-changes
```

## Manual Screenshot Comparison

```bash
# Take screenshots with Playwright CLI
npx playwright screenshot http://localhost:3000 before.png
# Make changes, then:
npx playwright screenshot http://localhost:3000 after.png

# Compare with ImageMagick
compare before.png after.png diff.png
identify -verbose diff.png | grep -i "mean"
```

## Notes

- Snapshots are OS and browser-specific. Generate baselines in CI, not locally.
- Use `maxDiffPixelRatio` not exact match — antialiasing causes 1-pixel diffs across environments.
- Percy/Chromatic handle cross-browser and responsive comparisons automatically but require cloud accounts.
- Visual tests are slow. Run them as a separate CI job, not with unit tests.
- Review visual diffs carefully — auto-approving defeats the purpose.
