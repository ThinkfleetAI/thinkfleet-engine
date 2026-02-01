---
name: typescript-expert
description: "Advanced TypeScript: generics, conditional types, mapped types, type guards, utility types, and strict type safety patterns."
metadata: {"moltbot":{"emoji":"🔷","requires":{"anyBins":["npx","node"]}}}
---

# TypeScript Expert

Advanced type-level programming for robust, self-documenting code.

## Generics

```typescript
// Constrained generic
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

// Generic with default
type ApiResponse<T = unknown> = { data: T; status: number; error?: string };

// Generic class
class Repository<T extends { id: string }> {
  private items = new Map<string, T>();
  save(item: T) { this.items.set(item.id, item); }
  find(id: string): T | undefined { return this.items.get(id); }
}
```

## Conditional Types

```typescript
// Extract return type based on input
type ApiResult<T> = T extends 'user' ? User : T extends 'post' ? Post : never;

// Infer nested types
type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;
type Result = UnwrapPromise<Promise<string>>; // string

// Distributive conditional
type NonNullable<T> = T extends null | undefined ? never : T;
```

## Mapped Types

```typescript
// Make all properties optional
type Partial<T> = { [K in keyof T]?: T[K] };

// Make all properties readonly
type Readonly<T> = { readonly [K in keyof T]: T[K] };

// Remap keys
type Getters<T> = { [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K] };
// { getName: () => string; getAge: () => number }
```

## Type Guards

```typescript
// Custom type guard
function isUser(value: unknown): value is User {
  return typeof value === 'object' && value !== null && 'email' in value;
}

// Discriminated union
type Result<T> = { ok: true; data: T } | { ok: false; error: string };

function handle<T>(result: Result<T>) {
  if (result.ok) {
    console.log(result.data); // TypeScript knows data exists
  } else {
    console.log(result.error); // TypeScript knows error exists
  }
}

// Assertion function
function assertDefined<T>(value: T | undefined, msg: string): asserts value is T {
  if (value === undefined) throw new Error(msg);
}
```

## Utility Types

```typescript
// Pick specific properties
type UserPreview = Pick<User, 'id' | 'name'>;

// Omit properties
type CreateUserInput = Omit<User, 'id' | 'createdAt'>;

// Required
type StrictConfig = Required<Config>;

// Record
type UserMap = Record<string, User>;

// Extract from union
type StringOrNumber = Extract<string | number | boolean, string | number>;

// Parameters and ReturnType
type FnParams = Parameters<typeof myFunction>;
type FnReturn = ReturnType<typeof myFunction>;
```

## Template Literal Types

```typescript
type EventName = `on${Capitalize<'click' | 'hover' | 'focus'>}`;
// "onClick" | "onHover" | "onFocus"

type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
type Endpoint = `/${string}`;
type Route = `${HTTPMethod} ${Endpoint}`;
```

## Strict Patterns

```typescript
// Exhaustive switch
function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${x}`);
}

type Status = 'active' | 'inactive' | 'pending';
function handleStatus(status: Status) {
  switch (status) {
    case 'active': return 'green';
    case 'inactive': return 'red';
    case 'pending': return 'yellow';
    default: return assertNever(status); // Compile error if case missed
  }
}

// Branded types (prevent mixing IDs)
type UserId = string & { __brand: 'UserId' };
type PostId = string & { __brand: 'PostId' };
function getUser(id: UserId) { /* ... */ }
// getUser(postId) → compile error
```

## tsconfig Strict Settings

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true
  }
}
```

## Notes

- `unknown` over `any` — forces type checking before use.
- Prefer discriminated unions over optional properties for state modeling.
- `as const` makes literal types: `const x = [1, 2] as const` → `readonly [1, 2]`.
- Avoid type assertions (`as`). If you need one, you probably need a type guard instead.
- Use `satisfies` to validate without widening: `const config = {...} satisfies Config`.
