---
name: nextjs-patterns
description: "Next.js App Router patterns: Server Components, data fetching, routing, middleware, caching, and deployment."
metadata: {"moltbot":{"emoji":"▲","requires":{"anyBins":["npx","node"]}}}
---

# Next.js Patterns

Modern Next.js with App Router, Server Components, and production patterns.

## App Router Structure

```
app/
  layout.tsx        # Root layout (wraps all pages)
  page.tsx          # Home page (/)
  loading.tsx       # Loading UI (automatic Suspense)
  error.tsx         # Error boundary
  not-found.tsx     # 404 page
  api/
    route.ts        # API route (/api)
  dashboard/
    layout.tsx      # Nested layout
    page.tsx         # Dashboard page (/dashboard)
    [id]/
      page.tsx       # Dynamic route (/dashboard/123)
```

## Server Components (default)

```typescript
// app/users/page.tsx — runs on server, no client JS
async function UsersPage() {
  const users = await db.users.findMany(); // Direct DB access
  return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
}
```

## Client Components

```typescript
'use client'; // Only add when you need interactivity

import { useState } from 'react';

export function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}
```

## Data Fetching

### Server Component (preferred)

```typescript
// Fetch in the component — no useEffect needed
async function ProductPage({ params }: { params: { id: string } }) {
  const product = await fetch(`https://api.example.com/products/${params.id}`, {
    next: { revalidate: 3600 }, // Cache for 1 hour
  }).then(r => r.json());

  return <Product data={product} />;
}
```

### Server Actions (mutations)

```typescript
// app/actions.ts
'use server';

export async function createUser(formData: FormData) {
  const name = formData.get('name') as string;
  await db.users.create({ data: { name } });
  revalidatePath('/users');
}

// In component:
<form action={createUser}>
  <input name="name" />
  <button type="submit">Create</button>
</form>
```

## API Routes

```typescript
// app/api/users/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  const users = await db.users.findMany();
  return NextResponse.json(users);
}

export async function POST(request: Request) {
  const body = await request.json();
  const user = await db.users.create({ data: body });
  return NextResponse.json(user, { status: 201 });
}
```

## Middleware

```typescript
// middleware.ts (root level)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth-token');
  if (!token && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ['/dashboard/:path*'] };
```

## Commands

```bash
# Dev server
npx next dev

# Production build
npx next build

# Start production server
npx next start

# Lint
npx next lint

# Analyze bundle
ANALYZE=true npx next build
```

## Notes

- Default to Server Components. Only add `'use client'` when you need `useState`, `useEffect`, or browser APIs.
- Server Components can `await` directly — no loading states needed (use `loading.tsx` for automatic Suspense).
- `fetch` in Server Components is automatically deduped and cached.
- Use `revalidatePath()` or `revalidateTag()` to invalidate cache after mutations.
- Keep Client Components small and push them to leaf nodes of the component tree.
