# Backend Reference Guide

> Internal reference for backend development patterns, TypeScript conventions, and API design.  
> Use this when onboarding to backend codebases or preparing for cross-team collaboration.

---

## Table of Contents

1. [TypeScript for Backend](#1-typescript-for-backend)
2. [API Design Patterns](#2-api-design-patterns)
3. [Service Layer Architecture](#3-service-layer-architecture)
4. [Error Handling & Validation](#4-error-handling--validation)
5. [Database & Data Access](#5-database--data-access)
6. [Testing Backend Code](#6-testing-backend-code)
7. [Codebase Navigation & Live Work](#7-codebase-navigation--live-work)
8. [Quick Reference Cheatsheet](#8-quick-reference-cheatsheet)

---

## 1. TypeScript for Backend

### Strict Mode & Compiler Options

Always use `strict: true` in tsconfig. Key flags for backend:

```json
{
  "compilerOptions": {
    "strict": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

### Type vs Interface

- **Interface**: Use for object shapes, especially when you might extend them
- **Type**: Use for unions, intersections, mapped types, primitives

```typescript
// Interface - good for API request/response shapes
interface CreateUserRequest {
  email: string;
  name: string;
  role: 'admin' | 'user';
}

// Type - good for unions and computed types
type UserId = string;
type Status = 'pending' | 'active' | 'inactive';
type ApiResponse<T> = { data: T } | { error: string };
```

### Generics in Backend Context

```typescript
// Generic repository pattern
interface Repository<T, ID = string> {
  findById(id: ID): Promise<T | null>;
  save(entity: T): Promise<T>;
  delete(id: ID): Promise<boolean>;
}

// Generic API response wrapper
interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

// Generic service method
async function fetchById<T extends { id: string }>(
  id: string,
  fetcher: (id: string) => Promise<T | null>
): Promise<T> {
  const result = await fetcher(id);
  if (!result) throw new NotFoundError(`Resource ${id} not found`);
  return result;
}
```

### Utility Types You Must Know

| Type | Use Case |
|------|----------|
| `Partial<T>` | All properties optional (PATCH requests) |
| `Required<T>` | All properties required |
| `Pick<T, K>` | Subset of properties |
| `Omit<T, K>` | Exclude properties (e.g., omit `password`) |
| `Record<K, V>` | Map/dictionary type |
| `ReturnType<F>` | Extract return type of function |
| `Parameters<F>` | Extract parameter types |

```typescript
// PATCH - only send changed fields
type UpdateUserRequest = Partial<CreateUserRequest>;

// Exclude sensitive data from API response
type PublicUser = Omit<User, 'password' | 'refreshToken'>;

// Dynamic key-value structures
type ErrorCodes = Record<string, { message: string; statusCode: number }>;
```

### Async/Await & Promises

```typescript
// Always handle errors at the right layer
async function getUserWithOrders(userId: string): Promise<UserWithOrders> {
  const [user, orders] = await Promise.all([
    userRepo.findById(userId),
    orderRepo.findByUserId(userId)
  ]);
  if (!user) throw new NotFoundError('User not found');
  return { ...user, orders };
}

// Avoid floating promises - always await or return
// BAD: someAsyncCall(); 
// GOOD: await someAsyncCall(); or return someAsyncCall();
```

### Nullish Coalescing & Optional Chaining

```typescript
// ?? for null/undefined defaults
const port = process.env.PORT ?? 3000;

// ?. for safe property access
const userName = user?.profile?.displayName ?? 'Anonymous';

// ??= for conditional assignment
config.timeout ??= 5000;
```

---

## 2. API Design Patterns

### REST Conventions

| Method | Path | Action |
|--------|------|--------|
| GET | `/users` | List (with pagination) |
| GET | `/users/:id` | Get single |
| POST | `/users` | Create |
| PUT | `/users/:id` | Full replace |
| PATCH | `/users/:id` | Partial update |
| DELETE | `/users/:id` | Delete |

### Express/Fastify Route Structure

```typescript
// Route handler pattern
router.get('/users/:id', async (req, res) => {
  const { id } = req.params;
  const user = await userService.findById(id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json(user);
});

// With validation middleware
router.post('/users', validateBody(createUserSchema), async (req, res) => {
  const user = await userService.create(req.body);
  res.status(201).json(user);
});
```

### Request Validation (Zod/Joi)

```typescript
import { z } from 'zod';

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  role: z.enum(['admin', 'user'])
});

type CreateUserInput = z.infer<typeof createUserSchema>;

// In middleware
const result = createUserSchema.safeParse(req.body);
if (!result.success) {
  return res.status(400).json({ errors: result.error.flatten() });
}
req.body = result.data; // Now typed!
```

### Pagination Pattern

```typescript
interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

async function getPaginated<T>(
  query: { page?: number; limit?: number },
  fetcher: (skip: number, take: number) => Promise<{ data: T[]; total: number }>
): Promise<PaginatedResponse<T>> {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  const skip = (page - 1) * limit;

  const { data, total } = await fetcher(skip, limit);
  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  };
}
```

---

## 3. Service Layer Architecture

### Singleton Pattern (like PowerbiService)

```typescript
export class SomeService {
  private static instance: SomeService;

  private constructor() {
    // Init logic, config validation
  }

  public static getInstance(): SomeService {
    if (!SomeService.instance) {
      SomeService.instance = new SomeService();
    }
    return SomeService.instance;
  }

  async doSomething(): Promise<Result> {
    // Service logic
  }
}
```

### Dependency Injection (Cleaner for Testing)

```typescript
// Define dependencies as constructor params
class UserService {
  constructor(
    private userRepo: UserRepository,
    private emailService: EmailService
  ) {}

  async createUser(data: CreateUserInput): Promise<User> {
    const user = await this.userRepo.create(data);
    await this.emailService.sendWelcome(user.email);
    return user;
  }
}

// Easy to mock in tests
const mockRepo = { create: jest.fn() };
const service = new UserService(mockRepo, mockEmailService);
```

### Service Method Patterns

```typescript
// One responsibility per method
// Return domain objects, not raw DB rows
// Throw domain-specific errors

class OrderService {
  async getOrderById(id: string): Promise<Order> {
    const order = await this.orderRepo.findById(id);
    if (!order) throw new NotFoundError(`Order ${id} not found`);
    return order;
  }

  async createOrder(input: CreateOrderInput): Promise<Order> {
    const validated = this.validateOrderInput(input);
    return this.orderRepo.create(validated);
  }
}
```

---

## 4. Error Handling & Validation

### Custom Error Classes

```typescript
class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

class ValidationError extends AppError {
  constructor(message: string, public details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}
```

### Centralized Error Handler

```typescript
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message }
    });
  }
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
});
```

### Try/Catch in Async Handlers

```typescript
// Wrap async route handlers
const asyncHandler = (fn: RequestHandler) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

router.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await userService.findById(req.params.id);
  res.json(user); // NotFoundError thrown in service will bubble to error handler
}));
```

---

## 5. Database & Data Access

### Repository Pattern

```typescript
interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(data: CreateUserInput): Promise<User>;
  update(id: string, data: Partial<User>): Promise<User>;
}

// Keeps DB logic separate from business logic
class UserService {
  constructor(private repo: UserRepository) {}
}
```

### Connection Handling

```typescript
// Pool connections, don't create new ones per request
// Use connection strings from env
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000
});
```

### Transactions

```typescript
async function transferMoney(fromId: string, toId: string, amount: number) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [amount, fromId]);
    await client.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [amount, toId]);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
```

---

## 6. Testing Backend Code

### Unit Test Structure

```typescript
describe('UserService', () => {
  let userService: UserService;
  let mockRepo: jest.Mocked<UserRepository>;

  beforeEach(() => {
    mockRepo = {
      findById: jest.fn(),
      create: jest.fn()
    } as any;
    userService = new UserService(mockRepo);
  });

  it('throws NotFoundError when user does not exist', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(userService.getUserById('123')).rejects.toThrow(NotFoundError);
  });
});
```

### Integration Test Pattern

```typescript
// Test actual HTTP endpoints
describe('GET /users/:id', () => {
  it('returns 404 for non-existent user', async () => {
    const res = await request(app).get('/users/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
```

---

## 7. Codebase Navigation & Live Work

### First 5 Minutes in a New Codebase

1. **Read `package.json`** – Dependencies, scripts, entry points
2. **Find `src/` or `app/`** – Main application structure
3. **Locate route definitions** – Usually `routes/`, `api/`, or in `app.ts`
4. **Find services** – Business logic layer
5. **Check for `.env.example`** – Required config

### When Given a Live Ticket

1. **Read the ticket fully** – Acceptance criteria, edge cases
2. **Find similar existing code** – "Where does X already happen?" Copy patterns
3. **Identify touch points** – Route → Controller → Service → Repo
4. **Make minimal changes** – Don't refactor unless asked
5. **Test your change** – Run existing tests, manual smoke test

### Explaining Your Approach

- **"I'll start by finding where similar functionality exists"** – Shows you read the codebase
- **"I'm following the existing pattern in X"** – Consistency matters
- **"I'll add validation here because..."** – Security/robustness awareness
- **"One consideration: we might want to..."** – Shows senior thinking (caching, scaling, etc.)

### Red Flags to Avoid

- Changing formatting/style unrelated to the ticket
- Adding dependencies without checking if one exists
- Ignoring existing error handling patterns
- Hardcoding values that should be config
- Skipping validation on user input

---

## 8. Quick Reference Cheatsheet

### Common npm Scripts

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm test             # Run tests
npm run lint         # Linting
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created |
| 204 | No Content (successful DELETE) |
| 400 | Bad Request (validation) |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict (duplicate) |
| 500 | Internal Server Error |

### Environment Variables Pattern

```typescript
const config = {
  port: parseInt(process.env.PORT ?? '3000', 10),
  dbUrl: process.env.DATABASE_URL ?? throw new Error('DATABASE_URL required'),
  nodeEnv: process.env.NODE_ENV ?? 'development'
};
```

### One-Liner Refreshers

```typescript
// Safe optional with default
const x = obj?.prop ?? 'default';

// Type guard
function isUser(obj: unknown): obj is User {
  return typeof obj === 'object' && obj !== null && 'id' in obj && 'email' in obj;
}

// Exhaustive switch
function handleStatus(s: Status) {
  switch (s) {
    case 'pending': return '...';
    case 'active': return '...';
    case 'inactive': return '...';
    default: const _: never = s; return _;
  }
}
```

---

*Last updated: Internal reference. Share with backend team.*
