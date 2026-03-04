# Conversation Points

> Phrases and considerations that demonstrate senior-level thinking during live work.

---

## When Starting a Ticket

- "Let me first find where similar functionality exists so I can follow existing patterns."
- "I'll check the route structure and service layer to understand the flow."
- "I want to make sure I'm consistent with how errors are handled elsewhere."

---

## When Making Decisions

- "I'm using Partial here for the PATCH since we only send changed fields."
- "I'll add validation at the boundary – we shouldn't trust client input."
- "We could add pagination here if this list grows – I'll add a TODO for now."
- "I'm keeping this synchronous with the existing approach; we could async it later if needed."

---

## When Discussing Trade-offs

- "I went with X over Y because it matches the rest of the codebase, even though Y might be slightly cleaner."
- "For this ticket I'm doing the minimal change; a fuller refactor would touch these other areas."
- "We might want to add caching here if this endpoint gets hit frequently."

---

## When Handling Edge Cases

- "What should we return when the user has no orders – empty array or 404?"
- "Should we validate that the user owns this resource before returning it?"
- "I'm assuming soft delete – do we need to filter those out?"

---

## Red Flags to Avoid

- Don't say "I'll just..." for security-sensitive changes
- Don't ignore existing patterns without a reason
- Don't over-promise refactors during a live session
- Don't go silent – narrate your thinking
