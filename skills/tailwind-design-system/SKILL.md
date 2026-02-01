---
name: tailwind-design-system
description: "Build design systems with Tailwind CSS: component patterns, responsive design, dark mode, custom themes, and animation."
metadata: {"thinkfleetbot":{"emoji":"🎨","requires":{"anyBins":["npx","node"]}}}
---

# Tailwind Design System

Build consistent, scalable UI with Tailwind CSS.

## Component Patterns

### Button variants

```html
<!-- Primary -->
<button class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors">
  Primary
</button>

<!-- Secondary -->
<button class="bg-gray-100 text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-200 border border-gray-300">
  Secondary
</button>

<!-- Destructive -->
<button class="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700">
  Delete
</button>

<!-- Ghost -->
<button class="text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-100">
  Ghost
</button>
```

### Card

```html
<div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
  <h3 class="text-lg font-semibold text-gray-900">Title</h3>
  <p class="mt-2 text-gray-600">Description text here.</p>
</div>
```

### Input

```html
<label class="block">
  <span class="text-sm font-medium text-gray-700">Email</span>
  <input type="email" class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder:text-gray-400" placeholder="you@example.com" />
</label>
```

## Responsive Design

```html
<!-- Mobile-first: stack → side by side → 3 columns -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  <div>Card 1</div>
  <div>Card 2</div>
  <div>Card 3</div>
</div>

<!-- Hide on mobile, show on desktop -->
<nav class="hidden md:flex gap-4">...</nav>

<!-- Mobile menu, hidden on desktop -->
<nav class="flex md:hidden">...</nav>
```

## Dark Mode

```html
<!-- Toggle with class strategy -->
<div class="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
  <h1 class="text-gray-900 dark:text-white">Heading</h1>
  <p class="text-gray-600 dark:text-gray-400">Body text</p>
  <button class="bg-blue-600 dark:bg-blue-500 text-white">Action</button>
</div>
```

```javascript
// Toggle dark mode
document.documentElement.classList.toggle('dark');

// Respect system preference
if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.documentElement.classList.add('dark');
}
```

## Custom Theme (tailwind.config)

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f9ff',
          500: '#0ea5e9',
          900: '#0c4a6e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      spacing: {
        '18': '4.5rem',
      },
    },
  },
};
```

## Animation

```html
<!-- Fade in -->
<div class="animate-fade-in">Content</div>

<!-- Slide up -->
<div class="animate-in slide-in-from-bottom-4 duration-300">Content</div>

<!-- Pulse loading -->
<div class="animate-pulse bg-gray-200 h-4 rounded w-3/4"></div>

<!-- Skeleton loader -->
<div class="space-y-3 animate-pulse">
  <div class="h-4 bg-gray-200 rounded w-3/4"></div>
  <div class="h-4 bg-gray-200 rounded w-1/2"></div>
  <div class="h-4 bg-gray-200 rounded w-5/6"></div>
</div>
```

## Notes

- Mobile-first: start with base styles, add `md:` and `lg:` for larger screens.
- Use `@apply` sparingly — it defeats the purpose of utility classes. Use it only in component libraries.
- Design tokens (colors, spacing, fonts) belong in `tailwind.config.js`, not hardcoded in classes.
- Use `group` and `peer` for parent/sibling-based styling instead of JavaScript.
- Tailwind v4 uses CSS-first configuration. Check your version.
