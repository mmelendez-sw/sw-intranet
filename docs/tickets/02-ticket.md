# Ticket 2: Lab Results Validation

**Ticket:** PATCH /api/patients/:patientId/lab-results/:resultId currently accepts invalid LOINC codes and out-of-range numeric values. Add validation.

**Priority:** High | **Estimate:** 2–3 hours

---

## Acceptance Criteria

- [ ] LOINC code format validated (e.g. 1234-5, 12345-6)
- [ ] Numeric values within valid range per lab type (configurable)
- [ ] Return 400 with field-level errors on validation failure
- [ ] Unknown lab types rejected

---

## Step-by-Step Walkthrough

### 1. Find the PATCH Handler

- `routes/patients.ts` or `routes/labResults.ts`
- Locate the update logic

### 2. Define Validation Schema

```typescript
// LOINC: typically 5-7 digits, optional hyphen + 1-2 digit suffix
const loincSchema = z.string().regex(/^\d{5,7}(-\d{1,2})?$/);

// Lab-specific ranges (example)
const labRanges: Record<string, { min: number; max: number; unit: string }> = {
  'glucose': { min: 0, max: 500, unit: 'mg/dL' },
  'creatinine': { min: 0, max: 20, unit: 'mg/dL' },
  // ...
};
```

### 3. Add Middleware or Inline Validation

- Use existing validation pattern (e.g. `validateBody(schema)`)
- Validate `loincCode` and `value` together – value range depends on lab type

### 4. Error Response Shape

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid lab result data",
    "details": [
      { "field": "loincCode", "message": "Invalid LOINC format" },
      { "field": "value", "message": "Value must be between 0 and 500 for glucose" }
    ]
  }
}
```

### 5. Things to mention

- "We could validate against a LOINC lookup table if we have one."
- "Lab ranges might need to come from config or DB for flexibility."
- "Consider audit logging when lab results are updated – HIPAA."
