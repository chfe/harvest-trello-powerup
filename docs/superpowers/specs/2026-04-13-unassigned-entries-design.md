# Unassigned Harvest Entries — Design

Date: 2026-04-13

## Problem

Time entries sometimes get logged in Harvest on the go (phone calls, quick
tasks) against the board's project without being linked to a Trello card.
These "unassigned" entries are invisible in Trello today — you have no way to
see that they exist, attach them to a card, or promote them into a new card.

## Goal

Surface unassigned entries in the Board Summary and let the user either
**attach** them to an existing card or **create a new card** from them, with
multi-select for bundling multiple entries into a single action.

## Definition of "unassigned"

A time entry in the configured Harvest project where `external_reference` is
null OR `external_reference.id` is empty/missing. Scope: all-time, soft-capped
at newest 50 in the UI with a "Load more" affordance.

## UX

### Board Summary entry point

Add a section to `board-summary.html` below the existing project totals:

```
Unassigned entries: 3 (1.25h)     [Review →]
```

Hidden entirely when count is 0. Clicking opens the modal.

### Modal

Header: **Unassigned Harvest entries**

One row per entry:

```
[✓]  Apr 10 · 0.75h · "Client call re: onboarding"    [Attach ▾] [New card]
```

- Checkbox for multi-select
- Date, hours (2 decimals, matching existing badge style), notes snippet
  (full notes on hover/expand); falls back to task name when notes are empty
- **Attach ▾** — autocomplete over open cards on the current board
- **New card** — creates a card in the leftmost open list (see below)

Sticky footer appears when one or more rows are checked:

```
[Attach N to card…]   [Create card from N]
```

After any successful action, handled entries are removed from the list in
place and the modal stays open so several can be processed in a row. Per-row
PATCH failures are shown inline on the failing row; successful siblings are
still removed.

## Flows

### Attach to existing card

1. User picks a card from the autocomplete (source: `t.cards('id', 'name',
   'shortLink', 'url', 'closed')`, filtered to `!closed`).
2. For each selected entry, PATCH `/time_entries/{id}` with:
   ```json
   { "external_reference": { "id": "<shortLink>", "permalink": "<cardUrl>" } }
   ```
3. Invalidate the card-badge cache for that card so totals refresh.

### Create card from entries

1. Determine title:
   - **Single entry** → entry's notes, trimmed, max 80 chars. If empty, fall
     back to `"{task name} — {date}"`.
   - **Multiple entries, all notes identical** → that notes string.
   - **Multiple entries, differing notes** → prompt with a text field
     pre-filled with the first entry's notes (or task name if empty). User
     confirms or edits before the card is created.
2. Find the leftmost open list on the current board via
   `window.Trello.get('/boards/{id}/lists', { filter: 'open' })` and pick the
   first.
3. Create the card via `window.Trello.post('/cards', { idList, name })`.
4. PATCH each selected entry's `external_reference` to the new card's
   `shortLink` / `url`.
5. Invalidate the new card's badge cache.

### Error handling

- Card creation fails → toast, nothing is patched, modal stays open.
- Individual entry PATCH fails → error shown on that row, other entries still
  processed.

## Code changes

### `js/harvest-api.js`

Add:

- `getUnassignedEntries(token, accountId, projectId)` — calls
  `requestAllPages('/time_entries', …, { project_id })` and filters client
  side: `e => !e.external_reference || !e.external_reference.id`.
- `setEntryExternalReference(token, accountId, entryId, shortLink,
  permalink)` — thin wrapper over `updateEntry` that sends
  `{ external_reference: { id, permalink } }`.

### `board-summary.html`

- New section markup + modal markup.
- Logic to match the existing inline style of the file (the project keeps JS
  in page `<script>` blocks for the summary view).
- Reuse existing modal / button CSS from `css/`.

### `js/connector.js`

- Expose a small helper to clear a specific card's badge cache key (`'b_' +
  shortLink`) so the attach and create flows can trigger a badge refresh.

## Out of scope

- Configurable target list for new cards (always leftmost open list).
- Filtering by date, user, or task inside the modal.
- Editing entries from this modal — the existing `entry-form.html` already
  handles edits and can be reached separately if needed later.
- A Trello board button or a dedicated "Harvest inbox" Trello list.
