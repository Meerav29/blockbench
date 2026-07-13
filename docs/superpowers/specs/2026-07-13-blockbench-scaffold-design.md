# Blockbench Scaffold Design

**Date:** 2026-07-13  
**Status:** Approved

---

## Overview

A local prototype of a Notion-like block-based workspace app. Built as a sandbox for testing PM feature ideas — not a production system. Single hardcoded workspace, no auth, auto-saving block editor.

**Stack:** Next.js (App Router) + TypeScript + Tailwind + Prisma + PostgreSQL (Supabase)

---

## 1. Data Model

### Workspace
```
id          String    @id @default(cuid())
name        String
createdAt   DateTime  @default(now())
```
Singleton. A fixed UUID is hardcoded in `lib/constants.ts` as `WORKSPACE_ID`. Seeded once, never created via UI.

### Page
```
id          String    @id @default(cuid())
title       String    @default("Untitled")
icon        String?
position    Int       @default(0)
workspaceId String
parentId    String?   (nullable self-reference for nesting)
createdAt   DateTime  @default(now())
updatedAt   DateTime  @updatedAt
```
Supports infinite nesting via `parentId`. All pages for the workspace are fetched in one query and assembled into a tree client-side.

### Block
```
id            String    @id @default(cuid())
pageId        String
parentBlockId String?   (nullable self-reference for nested blocks)
type          String    (enum values below)
content       Json      (Tiptap node JSON verbatim)
position      Int
createdAt     DateTime  @default(now())
updatedAt     DateTime  @updatedAt
```

**Supported block types:**
- `paragraph`
- `heading_1`, `heading_2`, `heading_3`
- `bulleted_list_item`
- `numbered_list_item`
- `to_do`
- `toggle`
- `divider`

The `type` column mirrors the Tiptap node type for queryability. The `content` JSON is stored verbatim from Tiptap — no custom parsing.

---

## 2. App Structure & Routing

```
app/
  layout.tsx                   — root layout, renders sidebar wrapper
  page.tsx                     — redirects to first page in workspace
  [pageId]/
    page.tsx                   — sidebar + editor for that page

components/
  sidebar/
    Sidebar.tsx                — fetches all pages, renders tree
    PageTreeItem.tsx           — recursive component: indent + toggle + link
  editor/
    Editor.tsx                 — Tiptap instance, autosave, save indicator
    SlashMenu.tsx              — "/" command popover with block type list
    extensions/
      SlashCommand.ts          — custom Tiptap extension for "/" trigger

lib/
  prisma.ts                    — singleton Prisma client
  constants.ts                 — WORKSPACE_ID hardcoded here

app/api/
  pages/
    route.ts                   — GET (list all pages), POST (create page)
    [pageId]/
      route.ts                 — GET (page + blocks), PATCH (title/icon)
      blocks/
        route.ts               — PATCH (bulk upsert blocks)
```

**Data fetching:** Plain `fetch` + `useState`. No React Query or SWR. Sidebar fetches all pages on mount. Editor fetches page + blocks on route change.

**No auth, no session.** `WORKSPACE_ID` constant is used everywhere.

---

## 3. Editor Behavior

### Tiptap Extensions
| Extension | Source | Purpose |
|---|---|---|
| `StarterKit` | `@tiptap/starter-kit` | paragraph, headings, lists, hard breaks |
| `TaskList` + `TaskItem` | `@tiptap/extension-task-list/item` | to-do blocks |
| `DragHandle` | `@tiptap/extension-drag-handle-react` | drag-to-reorder blocks |
| `Typography` | `@tiptap/extension-typography` | markdown shortcuts |
| `SlashCommand` | custom | "/" trigger → block type menu |

### Slash Menu
- Triggers when user types `/` at start of a line
- Opens a `tippy.js` popover listing all block types with icons
- Keyboard navigable (arrow keys + Enter), dismisses on Escape or click-away
- Selecting a type calls `editor.chain().focus().setNode(type).run()`

### Markdown Shortcuts (free from StarterKit + Typography)
- `##` + space → heading
- `-` + space → bullet list
- `1.` + space → numbered list
- `[]` + space → to-do
- `---` → divider

### Autosave
- `onUpdate` in `Editor.tsx` resets a 500ms debounce timer on every keystroke
- On fire: flattens editor doc → `PATCH /api/pages/[pageId]/blocks` with full block array
- API does: delete blocks not in new array, upsert all others (by `id`)
- Header shows subtle "Saving..." / "Saved" state indicator

### Toggle Blocks
- Custom Tiptap node with `collapsed` attr (boolean)
- Expand/collapse is ephemeral UI state — no DB round-trip
- Children are nested `Block` nodes inside the toggle node

---

## 4. API Routes

### `GET /api/pages`
Returns all pages for `WORKSPACE_ID`, flat array. Client assembles tree.

### `POST /api/pages`
Body: `{ title, parentId?, icon? }`. Creates page, returns new page object.

### `GET /api/pages/[pageId]`
Returns page metadata + all blocks ordered by `position`.

### `PATCH /api/pages/[pageId]`
Body: `{ title?, icon? }`. Updates page metadata.

### `PATCH /api/pages/[pageId]/blocks`
Body: `{ blocks: Block[] }` — full array of current blocks.
Logic:
1. Delete all blocks for this page not in the incoming array (by id)
2. Upsert all incoming blocks (createOrUpdate by id)

Note: toggle children are included in the flat block array with `parentBlockId` set to the toggle block's id. The client flattens the Tiptap doc tree before sending.

---

## 5. Seed Script (`prisma/seed.ts`)

Creates:
- 1 Workspace with fixed UUID matching `WORKSPACE_ID` constant
- Page: "Getting Started" (root, position 0)
  - Blocks: h1 title, paragraph intro, to-do (unchecked), to-do (checked), divider, bulleted list x2
- Page: "Meeting Notes" (child of Getting Started, position 0)
  - Blocks: h2 heading, paragraph, numbered list x3, toggle with nested paragraph
- Page: "Feature Ideas" (root, position 1)
  - Blocks: h1, paragraph, bulleted list x3, divider, paragraph

Run with: `npx prisma db seed`

---

## 6. Dependencies

```
# Core
next react react-dom typescript tailwindcss

# Database
@prisma/client prisma

# Editor
@tiptap/react
@tiptap/starter-kit
@tiptap/extension-task-list
@tiptap/extension-task-item
@tiptap/extension-drag-handle-react
@tiptap/extension-typography
@tiptap/pm

# Slash menu popover
tippy.js
```

---

## 7. Dev Setup & Verification Checkpoints

### Setup sequence
1. `npx create-next-app@latest blockbench --typescript --tailwind --app --no-src-dir`
2. Install dependencies above
3. Create Supabase project → copy `DATABASE_URL` + `DIRECT_URL` to `.env`
4. `npx prisma migrate dev --name init`
5. `npx prisma db seed`
6. `npm run dev`

### Verification checkpoints
| Checkpoint | How to verify |
|---|---|
| After migrations | `npx prisma studio` — confirm all 3 tables exist |
| After sidebar | `localhost:3000` shows page tree with 3 pages |
| After editor | Click page → blocks render, `/` opens slash menu, drag handle moves blocks |
| After autosave | Edit text → "Saving..." → "Saved" appears; refresh page → changes persist |

---

## 8. Explicitly Out of Scope

- Authentication / multi-user
- Real-time collaboration (no OT/CRDTs)
- Image upload
- Comments
- Page sharing / permissions
- Mobile layout
