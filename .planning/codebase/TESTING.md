# Testing Patterns

**Analysis Date:** 2026-04-08

## Test Framework

**Runner:**

- Jest v29.7.0
- Config: `jest.config.js`

**Assertion Library:**

- Jest built-in expect

**Run Commands:**

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

## Test File Organization

**Location:**

- Colocated with source code in `__tests__` directories

**Naming:**

- `{name}.test.ts` for test files
- Test suites follow the structure: `describe('Suite Name', () => { ... })`

**Structure:**

```
src/
├── lib/
│   └── auth/
│       ├── session-manager.ts
│       └── __tests__/
│           └── session-management.test.ts
└── app/
    └── auth/
        └── __tests__/
            ├── session-management.test.ts
            └── audit-logging.test.ts
```

## Test Structure

**Suite Organization:**

```typescript
import { FunctionToTest } from "@/path/to/function"
import { mockSupabaseClient } from "./helpers/mocks"

describe("Function Suite Name", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("should test specific behavior", async () => {
    // Arrange
    const mock = {
      ...mockSupabaseClient,
      // mock specific methods
    }

    // Act
    const result = await functionToTest(mock)

    // Assert
    expect(result).toEqual(expectedValue)
    expect(mock.method).toHaveBeenCalledWith(expectedArgs)
  })
})
```

**Patterns:**

- Setup pattern: `beforeEach` to clear mocks
- Teardown pattern: implicit through jest clearing
- Assertion pattern: `expect(value).toEqual(expected)` or `expect(mock.fn).toHaveBeenCalled()`

## Mocking

**Framework:** Jest built-in mocking

**Patterns:**

```typescript
// Mock Supabase client helper (from tests/helpers/mocks.ts)
const mockSupabaseClient = {
  auth: {
    getSession: jest.fn(),
    signOut: jest.fn(),
    signInWithPassword: jest.fn(),
    // ... other auth methods
  },
  from: jest.fn().mockReturnValue({
    insert: jest.fn().mockResolvedValue({ error: null }),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    // ... other query methods
  }),
}

// Usage in tests:
const mockClient = {
  ...mockSupabaseClient,
  auth: {
    ...mockSupabaseClient.auth,
    getSession: jest.fn().mockResolvedValue({
      data: {
        session: {
          /* session data */
        },
      },
      error: null,
    }),
  },
}
```

**What to Mock:**

- External services (Supabase, API clients)
- Date/time functions for consistent testing
- Modules with side effects

**What NOT to Mock:**

- Pure utility functions
- Simple data transformations
- React component rendering (when testing behavior, not implementation)

## Fixtures and Factories

**Test Data:**

```typescript
// Helper functions in test files
const createMockSession = (overrides = {}) => ({
  user: {
    id: "test-user-id",
    email: "test@example.com",
    last_sign_in_at: new Date().toISOString(),
    ...overrides,
  },
})

const createMockUser = (overrides = {}) => ({
  id: "test-user-id",
  email: "test@example.com",
  ...overrides,
})
```

**Location:**

- Test-specific helpers in `./helpers/` directories alongside tests
- Mock Supabase client in `app/auth/__tests__/helpers/mocks.ts`

## Coverage

**Requirements:** 80% threshold for branches, functions, lines, statements (enforced via jest.config.js)

**View Coverage:**

```bash
npm run test:coverage
# Opens coverage report in coverage/lcov-report/index.html
```

## Test Types

**Unit Tests:**

- Focus: Individual functions and classes
- Approach: Isolated testing with mocks for dependencies
- Location: `__tests__` directories alongside source
- Examples: session-manager.test.ts, audit-logging.test.ts

**Integration Tests:**

- Focus: API routes and authentication flows
- Approach: Testing route handlers with mocked Supabase
- Location: `app/api/__tests__/` and `app/auth/__tests__/`
- Examples: get-client-ip.test.ts, security-end-to-end.test.ts

**E2E Tests:**

- Framework: Not used (no E2E testing setup detected)

## Common Patterns

**Async Testing:**

```typescript
it("should handle async operation", async () => {
  const mock = {
    /* async mock setup */
  }
  const result = await asyncFunction(mock)
  expect(result).toEqual(expected)
})
```

**Error Testing:**

```typescript
it("should handle error conditions", async () => {
  const mock = {
    /* mock that throws error */
    method: jest.fn().mockRejectedValue(new Error("Test error")),
  }

  await expect(asyncFunction(mock)).rejects.toThrow("Test error")
})
```

**Mock Implementation:**

```typescript
it("should call external service", () => {
  const mockService = { method: jest.fn() }
  const wrapper = new WrapperClass(mockService)

  wrapper.methodToTest()

  expect(mockService.method).toHaveBeenCalledWith(expectedArg)
})
```

## Test Organization Conventions

**File Placement:**

- Tests placed in `__tests__` directory at same level as source file
- Helpers and mocks in `./helpers/` subdirectory within `__tests__`

**Naming:**

- Test files: `{source-file-name}.test.ts`
- Test suites: describe blocks matching function/class names
- Individual tests: it/test blocks describing specific behavior

**Helpers:**

- Reusable mock factories in helpers/mocks.ts
- Test data builders in test files
- Shared setup in jest.setup.js (environment variables, console mocking)

## CI Integration

Tests run as part of verification pipeline:

- lint → type-check → test → build
- Coverage requirements enforced (80% threshold)
- No test failures allowed in CI

## Limitations and Gaps

**Missing:**

- End-to-end testing framework (Cypress, Playwright)
- Visual regression testing
- Performance benchmarking in tests
- Test data factories library (like FactoryGirl/FactoryBot)

**Areas for Improvement:**

- More comprehensive integration tests for API routes
- Testing of client-side components with React Testing Library
- Negative testing pathways for error conditions
- Property-based testing for complex logic
