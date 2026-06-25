# Homepage Cards — Simple Feature Spec (for Intern)

**No AWS required.** Image hosting is already handled in the app. Your supervisor may move images to AWS later — that is **not** your task.

---

## Quick answers

**Are we using React?**  
Yes. React 18. Main file: `src/components/HomePage.tsx`.

**Can you use React for state?**  
Yes — and you already are. The page uses `useState` for the card list, the edit form, and save/upload flags. Keep using that. No Redux needed.

**Do you need to know TypeScript?**  
Files use `.tsx`, but you can copy existing patterns. Don't worry about advanced types.

---

## What we're building

Homepage cards should **not be hardcoded**. Editors (special permission) can add, edit, reorder, and delete cards. Everyone else just views them.

**Good news: most of this is already built.** Your job is mostly cleanup and making sure it works end-to-end.

---

## How images work (no AWS)

Editors have **two options** in the card form — both already exist in `HomePage.tsx`:

### Option A — Upload a file (SharePoint)

1. Editor picks an image file (or drags and drops).
2. On Save, the app calls `uploadImage()` in `contentService.ts`.
3. File goes to SharePoint: `Documents/IntranetImages/`.
4. The returned URL is saved on the card as `imageUrl`.

**You don't set up SharePoint or AWS.** Just make sure this flow works when an editor is logged in.

### Option B — Paste an image URL

1. Editor pastes a link in the "paste a URL" field (e.g. a SharePoint link, company CDN, etc.).
2. That URL is saved directly on the card — no upload step.

Use this when the image is already hosted somewhere.

### If no image is set

Show **one simple placeholder** image for all cards. Do **not** use the old `LOCAL_IMAGES` map (that ties specific bundled photos to card numbers — that's the hardcoded part we're removing).

---

## How a card looks in code

```js
{
  order: 1,
  title: "Important Dates",
  bullets: ["July - Q2 Reviews", "7/3: Independence Day"],
  imageUrl: "https://..."   // empty string = show placeholder
}
```

All cards: `[ card1, card2, card3 ]`

Saved to SharePoint under the key `homepage-cards` via `getContent` / `setContent` in `contentService.ts`.

---

## React state (already in HomePage.tsx)

| State | Purpose |
|-------|---------|
| `cards` | Cards shown on the page |
| `editCardDraft` | Form values while editing |
| `pendingImageFile` | File picked for upload |
| `imagePreviewUrl` | Preview in the form |
| `savingCard` / `uploadingImage` | Loading flags |

Search the file for `saveCard`, `addCard`, `uploadImage` — that's the core flow.

---

## User flow (editor)

1. Click **Edit** on a card or **Add Card**.
2. Fill in title and bullets (one bullet per line in the textarea).
3. Add an image: **upload a file** OR **paste a URL**.
4. Click **Save**.
5. Card list saves to SharePoint.

Non-editors never see edit buttons (`userInfo.isEditor` must be true).

---

## Your tasks

### 1. Remove hardcoded images

In `HomePage.tsx`, find `LOCAL_IMAGES` (maps card number → bundled photos). **Stop using it.**

In `renderCardImage`:
- If `card.imageUrl` has a value → show it.
- If empty → show one generic placeholder (one imported image is fine).

### 2. Test the existing card form

Make sure editors can:
- Add a card
- Edit title and bullets
- Upload an image (SharePoint)
- Paste an image URL instead
- Reorder cards (drag or arrows)
- Delete a card

Fix small bugs if something doesn't save or preview correctly. Don't rebuild the whole page.

### 3. Optional polish (only if time)

- Clearer error message if upload fails
- Update hint text that still says "default bundled image" → say "placeholder" instead
- Basic check: file must be an image, not huge (e.g. under 5MB)

---

## Files to touch

| File | What to do |
|------|------------|
| `src/components/HomePage.tsx` | Remove `LOCAL_IMAGES`; fix placeholder; test form |
| `src/services/contentService.ts` | Read only — `getContent`, `setContent`, `uploadImage` already exist |

**Do not create** new AWS/S3 files. **Do not** add API keys anywhere.

---

## Done when…

- [ ] Cards load from SharePoint (not only hardcoded defaults)
- [ ] Editor can add/edit/delete/reorder cards
- [ ] Images work via **file upload** or **pasted URL**
- [ ] No `LOCAL_IMAGES` per-card hardcoding
- [ ] Non-editors see cards but no edit controls

---

## How to run locally

```bash
npm install
npm start
```

On `serena-dev`, login is bypassed for testing (`BYPASS_AUTH = true` in `authConfig.ts`).  
Real image upload to SharePoint needs a real logged-in editor account — ask your supervisor to test that part if bypass mode can't upload.

---

## If you get stuck

1. Search `HomePage.tsx` for `saveCard` and follow the code path.
2. Copy existing patterns — don't rewrite from scratch.
3. Ask your supervisor (not AWS questions — they handle infrastructure later).

---

## Not your job

- AWS / S3 setup
- Login or permissions (already done)
- Hero banner or announcements
- Image cropping

---

## Later (supervisor only)

When ready, images may move from SharePoint to S3. That will be a separate change — you don't need to plan for it now.
