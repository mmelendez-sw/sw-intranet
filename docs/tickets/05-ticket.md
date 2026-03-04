# Ticket 5: Audit Logging for PHI Access

**Ticket:** Add audit logging when any endpoint accesses patient PHI. Log: userId, endpoint, patientId (if applicable), timestamp. Store in audit_logs table.

**Priority:** High (HIPAA) | **Estimate:** 3–4 hours

---

## Acceptance Criteria

- [ ] Every PHI-accessing endpoint logs to audit_logs
- [ ] Fields: userId, method, path, patientId?, timestamp
- [ ] Middleware approach – minimal changes to existing routes
- [ ] Logging is fire-and-forget (doesn't block response)

---

## Step-by-Step Walkthrough

### 1. Identify PHI Endpoints

- GET/POST /api/patients/*
- GET /api/clinical-summaries (if tied to patient)
- Any endpoint with patientId in path or body

### 2. Design Middleware

```typescript
// Extract patientId from req.params or req.body
// Get userId from auth (req.user.id)
// Insert into audit_logs
// Call next() – don't await insert for speed
```

### 3. Middleware Options

- **Route-level:** Add to each PHI route – explicit but verbose
- **Path-based:** Middleware that matches `/api/patients/*` etc. – DRY
- **Decorator/wrapper:** Wrap handlers that need auditing

### 4. Fire-and-Forget

```typescript
auditLog.log({ userId, method, path, patientId }).catch(err => 
  console.error('Audit log failed', err)
);
next();
```

### 5. Things to mention

- "We shouldn't log request/response bodies – they may contain PHI."
- "Audit logs should be append-only, access-restricted."
- "Consider retention policy – 6 years typical for HIPAA."
