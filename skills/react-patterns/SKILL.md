---
name: react-patterns
description: "React best practices: hooks, composition, state management, performance optimization, Server Components, and testing patterns."
metadata: {"thinkfleetbot":{"emoji":"⚛️","requires":{"anyBins":["npx","node"]}}}
---

# React Patterns

Modern React patterns for production applications.

## Hooks

### Custom hooks — extract reusable logic

```typescript
// useFetch hook
function useFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch(url, { signal: controller.signal })
      .then(res => res.json())
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [url]);

  return { data, error, loading };
}
```

### useCallback/useMemo — prevent unnecessary re-renders

```typescript
// Memoize expensive computation
const sorted = useMemo(() => items.sort((a, b) => a.name.localeCompare(b.name)), [items]);

// Stable function reference for child components
const handleClick = useCallback((id: string) => {
  setSelected(id);
}, []);
```

## Composition Over Inheritance

```typescript
// Compound component pattern
function Select({ children, value, onChange }) {
  return (
    <SelectContext.Provider value={{ value, onChange }}>
      <div role="listbox">{children}</div>
    </SelectContext.Provider>
  );
}

Select.Option = function Option({ value, children }) {
  const ctx = useContext(SelectContext);
  return (
    <div role="option" onClick={() => ctx.onChange(value)}
      aria-selected={ctx.value === value}>
      {children}
    </div>
  );
};

// Usage
<Select value={selected} onChange={setSelected}>
  <Select.Option value="a">Option A</Select.Option>
  <Select.Option value="b">Option B</Select.Option>
</Select>
```

## State Management

### When to use what
- **useState** — local component state
- **useReducer** — complex state transitions in one component
- **Context** — shared state across a subtree (theme, auth, locale)
- **Zustand/Jotai** — global app state without boilerplate
- **React Query/SWR** — server state (API data with caching)

### Avoid prop drilling with composition

```typescript
// Instead of passing props through 5 levels, compose:
function Page() {
  const user = useUser();
  return <Layout header={<Header user={user} />} content={<Content />} />;
}
```

## Performance

### React.memo — skip re-renders for unchanged props

```typescript
const ExpensiveList = React.memo(function ExpensiveList({ items }) {
  return items.map(item => <Item key={item.id} {...item} />);
});
```

### Virtualization for long lists

```typescript
// Use @tanstack/react-virtual for lists >100 items
import { useVirtualizer } from '@tanstack/react-virtual';

function VirtualList({ items }) {
  const parentRef = useRef(null);
  const virtualizer = useVirtualizer({ count: items.length, getScrollElement: () => parentRef.current, estimateSize: () => 50 });
  // render only visible items
}
```

### Code splitting

```typescript
const HeavyComponent = lazy(() => import('./HeavyComponent'));

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <HeavyComponent />
    </Suspense>
  );
}
```

## Error Boundaries

```typescript
class ErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, info) { logError(error, info); }
  render() {
    if (this.state.hasError) return <ErrorFallback />;
    return this.props.children;
  }
}
```

## Testing

```bash
# Component test with Testing Library
npx vitest run --reporter=verbose src/components/

# Key testing patterns:
# - Test behavior, not implementation
# - Use screen.getByRole() over getByTestId()
# - Prefer userEvent over fireEvent
# - Assert what the user sees, not internal state
```

## Notes

- Don't optimize prematurely. Profile first with React DevTools Profiler.
- Server Components (Next.js App Router) don't need `useState` or `useEffect` — they run on the server.
- Keys should be stable IDs, never array indexes (unless the list never reorders).
- Avoid `useEffect` for derived state — compute it during render instead.
