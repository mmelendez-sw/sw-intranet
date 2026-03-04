# Example Ticket Walkthroughs

> Practice scenarios for backend work. Use these to simulate live ticket work.

---

## Scenario 1: Add a New API Endpoint

**Ticket:** "Add GET /api/users/:id/orders to return a user's orders for the last 30 days."

### Step-by-step approach

1. **Find existing routes** – Look for `routes/users.ts` or similar. See how routes are structured.
2. **Find order service/repo** – Where does order lookup happen? Check `OrderService` or `orderRepository`.
3. **Add date filter** – "Last 30 days" = `WHERE createdAt >= NOW() - INTERVAL '30 days'` (or equivalent).
4. **Return format** – Match existing API response shape (e.g. `{ data: Order[] }`).

### Code sketch (adapt to actual stack)

```typescript
// routes/users.ts
router.get('/:id/orders', asyncHandler(async (req, res) => {
  const orders = await orderService.findByUserId(req.params.id, { days: 30 });
  res.json({ data: orders });
}));

// services/orderService.ts
async findByUserId(userId: string, options?: { days?: number }): Promise<Order[]> {
  const since = options?.days 
    ? new Date(Date.now() - options.days * 24 * 60 * 60 * 1000) 
    : undefined;
  return this.orderRepo.findByUserId(userId, since);
}
```

### Things to mention

- "I'll validate that the user exists before querying orders."
- "We could add pagination if the list grows large."
- "I'm reusing the existing Order type for consistency."

---

## Scenario 2: Fix Validation Bug

**Ticket:** "PATCH /users/:id accepts invalid email format. Add validation."

### Approach

1. Find the PATCH handler for users.
2. Find existing validation (Zod, Joi, etc.) – reuse the same library.
3. Add email validation to the update schema.

### Code sketch

```typescript
const updateUserSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).max(100).optional()
}).strict(); // reject unknown fields

router.patch('/:id', validateBody(updateUserSchema), async (req, res) => {
  // ...
});
```

---

## Scenario 3: Add Error Handling

**Ticket:** "When a user is not found, return 404 with a proper JSON body."

### Approach

1. Find where user lookup happens (service or controller).
2. Check if a custom `NotFoundError` exists – use it.
3. Ensure the global error handler maps it to 404.

### Code sketch

```typescript
// In service
if (!user) throw new NotFoundError('User');

// Error handler should return:
// { "error": { "code": "NOT_FOUND", "message": "User not found" } }
```

---

## Scenario 4: Add a New Service Method

**Ticket:** "Add a method to deactivate a user and cancel their active subscriptions."

### Approach

1. Find `UserService` and `SubscriptionService` (or equivalent).
2. Add deactivate method that:
   - Updates user status
   - Cancels active subscriptions (transaction if possible)
3. Expose via PATCH or POST /users/:id/deactivate.

### Things to mention

- "I'll use a transaction for user + subscription updates."
- "We need to decide what 'cancel' means – soft delete vs status change."

---

## Quick Mental Checklist

- [ ] Read the ticket twice
- [ ] Find similar existing code
- [ ] Add validation for inputs
- [ ] Handle errors (404, 400, etc.)
- [ ] Match existing response shape
- [ ] Run tests if they exist
- [ ] Don't over-engineer – solve the ticket
