# Blockbench Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold a Notion-like prototype with a recursive sidebar, Tiptap block editor (slash menu, drag handles, autosave), and seed data — all backed by Prisma + PostgreSQL (Supabase).

**Architecture:** Single Next.js App Router app. One Tiptap editor instance per page stores block content in a relational `Block` table via a debounced PATCH API. All pages are fetched flat and assembled into a tree client-side; no auth, single hardcoded workspace.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Prisma ORM, PostgreSQL (Supabase), Tiptap v2, tippy.js

## Global Constraints

- No authentication — single hardcoded `WORKSPACE_ID` used everywhere
- No React Query / SWR — plain `fetch` + `useState`
- No real-time collaboration
- Autosave debounce: 500ms
- All Tiptap extensions from `@tiptap/*` free tier (no Pro extensions)
- `@tiptap/extension-drag-handle-react` for drag-to-reorder (free)
- Block types: `paragraph`, `heading_1`, `heading_2`, `heading_3`, `bulleted_list_item`, `numbered_list_item`, `to_do`, `toggle`, `divider`
- Toggle children saved as blocks with `parentBlockId` pointing to toggle block id

---

## File Map

| File | Purpose |
|---|---|
| `prisma/schema.prisma` | Workspace, Page, Block models |
| `prisma/seed.ts` | Seed 1 workspace + 3 pages + blocks |
| `lib/prisma.ts` | Singleton Prisma client |
| `lib/constants.ts` | `WORKSPACE_ID` constant |
| `lib/types.ts` | Shared TypeScript types (PageWithChildren, BlockRow) |
| `app/layout.tsx` | Root layout with sidebar slot |
| `app/page.tsx` | Redirect to first page |
| `app/[pageId]/page.tsx` | Page route — renders sidebar + editor |
| `app/api/pages/route.ts` | GET all pages, POST create page |
| `app/api/pages/[pageId]/route.ts` | GET page+blocks, PATCH title/icon |
| `app/api/pages/[pageId]/blocks/route.ts` | PATCH bulk upsert blocks |
| `components/sidebar/Sidebar.tsx` | Fetches pages, renders tree |
| `components/sidebar/PageTreeItem.tsx` | Recursive tree node component |
| `components/editor/Editor.tsx` | Tiptap instance, autosave, save indicator |
| `components/editor/SlashMenu.tsx` | Slash command popover UI |
| `components/editor/extensions/SlashCommand.ts` | Custom Tiptap extension for "/" trigger |

---

## Task 1: Next.js Scaffold + Dependencies

**Files:**
- Create: `package.json` (via create-next-app)
- Create: `.env` (manually)
- Create: `lib/constants.ts`
- Create: `lib/types.ts`

**Interfaces:**
- Produces: `WORKSPACE_ID: string` from `lib/constants.ts`
- Produces: `PageRow`, `BlockRow`, `PageWithChildren` types from `lib/types.ts`

- [ ] **Step 1: Scaffold Next.js app**

Run from the `blockbench` directory (which already has README.md):
```bash
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --eslint --import-alias "@/*"
```
When prompted, accept all defaults. This overwrites nothing important (README will be preserved or re-created).

- [ ] **Step 2: Install editor and DB dependencies**

```bash
npm install @prisma/client prisma \
  @tiptap/react @tiptap/starter-kit \
  @tiptap/extension-task-list @tiptap/extension-task-item \
  @tiptap/extension-drag-handle-react \
  @tiptap/extension-typography @tiptap/pm \
  tippy.js @tippyjs/react
```

```bash
npm install -D @types/node
```

- [ ] **Step 3: Create `.env` file**

Create `.env` in the project root:
```env
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
```
Replace with your actual Supabase connection strings. `DATABASE_URL` uses the pooled connection (port 6543), `DIRECT_URL` uses the direct connection (port 5432).

Add `.env` to `.gitignore` if not already there.

- [ ] **Step 4: Create `lib/constants.ts`**

```typescript
export const WORKSPACE_ID = "clworkspace0000000000000000";
```

- [ ] **Step 5: Create `lib/types.ts`**

```typescript
export interface PageRow {
  id: string;
  title: string;
  icon: string | null;
  position: number;
  workspaceId: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PageWithChildren extends PageRow {
  children: PageWithChildren[];
}

export interface BlockRow {
  id: string;
  pageId: string;
  parentBlockId: string | null;
  type: string;
  content: Record<string, unknown>;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export type BlockType =
  | "paragraph"
  | "heading_1"
  | "heading_2"
  | "heading_3"
  | "bulleted_list_item"
  | "numbered_list_item"
  | "to_do"
  | "toggle"
  | "divider";
```

- [ ] **Step 6: Verify**

```bash
npm run dev
```
Expected: Next.js dev server starts on `localhost:3000`, default page loads. No errors in terminal.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js app with Tiptap and Prisma dependencies"
```

---

## Task 2: Prisma Schema + Migration

**Files:**
- Create: `prisma/schema.prisma`
- Create: `lib/prisma.ts`

**Interfaces:**
- Produces: `prisma.workspace`, `prisma.page`, `prisma.block` Prisma clients
- Produces: singleton `prisma` export from `lib/prisma.ts`

- [ ] **Step 1: Initialize Prisma**

```bash
npx prisma init --datasource-provider postgresql
```
This creates `prisma/schema.prisma` and updates `.env` with a `DATABASE_URL` placeholder (you already have the real value).

- [ ] **Step 2: Write `prisma/schema.prisma`**

Replace the generated schema with:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

model Workspace {
  id        String   @id @default(cuid())
  name      String
  createdAt DateTime @default(now())
  pages     Page[]
}

model Page {
  id          String   @id @default(cuid())
  title       String   @default("Untitled")
  icon        String?
  position    Int      @default(0)
  workspaceId String
  parentId    String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  parent    Page?     @relation("PageChildren", fields: [parentId], references: [id], onDelete: SetNull)
  children  Page[]    @relation("PageChildren")
  blocks    Block[]
}

model Block {
  id            String   @id @default(cuid())
  pageId        String
  parentBlockId String?
  type          String
  content       Json
  position      Int
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  page        Page   @relation(fields: [pageId], references: [id], onDelete: Cascade)
  parentBlock Block?  @relation("BlockChildren", fields: [parentBlockId], references: [id], onDelete: SetNull)
  children    Block[] @relation("BlockChildren")
}
```

- [ ] **Step 3: Run migration**

```bash
npx prisma migrate dev --name init
```
Expected output: `Your database is now in sync with your schema.` and a new `prisma/migrations/` folder.

- [ ] **Step 4: Create `lib/prisma.ts`**

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["query"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

- [ ] **Step 5: Verify**

```bash
npx prisma studio
```
Expected: Browser opens Prisma Studio at `localhost:5555`. Three tables visible: `Workspace`, `Page`, `Block` — all empty.

- [ ] **Step 6: Commit**

```bash
git add prisma/ lib/prisma.ts
git commit -m "feat: add Prisma schema with Workspace, Page, Block models"
```

---

## Task 3: API Routes

**Files:**
- Create: `app/api/pages/route.ts`
- Create: `app/api/pages/[pageId]/route.ts`
- Create: `app/api/pages/[pageId]/blocks/route.ts`

**Interfaces:**
- Consumes: `prisma` from `lib/prisma.ts`, `WORKSPACE_ID` from `lib/constants.ts`
- Produces:
  - `GET /api/pages` → `PageRow[]`
  - `POST /api/pages` → `PageRow`
  - `GET /api/pages/[pageId]` → `{ page: PageRow, blocks: BlockRow[] }`
  - `PATCH /api/pages/[pageId]` → `PageRow`
  - `PATCH /api/pages/[pageId]/blocks` → `{ success: true }`

- [ ] **Step 1: Create `app/api/pages/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { WORKSPACE_ID } from "@/lib/constants";

export async function GET() {
  const pages = await prisma.page.findMany({
    where: { workspaceId: WORKSPACE_ID },
    orderBy: { position: "asc" },
  });
  return NextResponse.json(pages);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { title = "Untitled", parentId = null, icon = null } = body;

  const siblings = await prisma.page.findMany({
    where: { workspaceId: WORKSPACE_ID, parentId },
    orderBy: { position: "asc" },
  });
  const position = siblings.length;

  const page = await prisma.page.create({
    data: { title, icon, position, workspaceId: WORKSPACE_ID, parentId },
  });
  return NextResponse.json(page, { status: 201 });
}
```

- [ ] **Step 2: Create `app/api/pages/[pageId]/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: { pageId: string } }
) {
  const page = await prisma.page.findUnique({
    where: { id: params.pageId },
  });
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const blocks = await prisma.block.findMany({
    where: { pageId: params.pageId },
    orderBy: { position: "asc" },
  });
  return NextResponse.json({ page, blocks });
}

export async function PATCH(
  request: Request,
  { params }: { params: { pageId: string } }
) {
  const body = await request.json();
  const { title, icon } = body;

  const page = await prisma.page.update({
    where: { id: params.pageId },
    data: {
      ...(title !== undefined && { title }),
      ...(icon !== undefined && { icon }),
    },
  });
  return NextResponse.json(page);
}
```

- [ ] **Step 3: Create `app/api/pages/[pageId]/blocks/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BlockRow } from "@/lib/types";

export async function PATCH(
  request: Request,
  { params }: { params: { pageId: string } }
) {
  const body = await request.json();
  const { blocks }: { blocks: BlockRow[] } = body;

  const incomingIds = blocks.map((b) => b.id);

  await prisma.$transaction([
    // Delete blocks no longer present
    prisma.block.deleteMany({
      where: {
        pageId: params.pageId,
        id: { notIn: incomingIds },
      },
    }),
    // Upsert all incoming blocks
    ...blocks.map((block) =>
      prisma.block.upsert({
        where: { id: block.id },
        update: {
          type: block.type,
          content: block.content,
          position: block.position,
          parentBlockId: block.parentBlockId,
        },
        create: {
          id: block.id,
          pageId: params.pageId,
          parentBlockId: block.parentBlockId,
          type: block.type,
          content: block.content,
          position: block.position,
        },
      })
    ),
  ]);

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Verify**

Start dev server and test with curl (or Postman):
```bash
# Should return empty array (no pages yet)
curl http://localhost:3000/api/pages
# Expected: []
```

- [ ] **Step 5: Commit**

```bash
git add app/api/
git commit -m "feat: add pages and blocks API routes"
```

---

## Task 4: Seed Script

**Files:**
- Create: `prisma/seed.ts`
- Modify: `package.json` (add prisma.seed config)

**Interfaces:**
- Consumes: `WORKSPACE_ID` from `lib/constants.ts`
- Produces: 1 workspace, 3 pages, ~15 blocks in DB

- [ ] **Step 1: Add seed config to `package.json`**

Add this to `package.json` at the top level:
```json
"prisma": {
  "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
}
```

Install ts-node:
```bash
npm install -D ts-node
```

- [ ] **Step 2: Create `prisma/seed.ts`**

```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const WORKSPACE_ID = "clworkspace0000000000000000";

async function main() {
  // Clean existing data
  await prisma.block.deleteMany();
  await prisma.page.deleteMany();
  await prisma.workspace.deleteMany();

  // Create workspace
  await prisma.workspace.create({
    data: { id: WORKSPACE_ID, name: "My Workspace" },
  });

  // Page 1: Getting Started (root)
  const gettingStarted = await prisma.page.create({
    data: {
      title: "Getting Started",
      icon: "🚀",
      position: 0,
      workspaceId: WORKSPACE_ID,
      parentId: null,
    },
  });

  await prisma.block.createMany({
    data: [
      {
        pageId: gettingStarted.id,
        type: "heading_1",
        content: { type: "heading", attrs: { level: 1 }, text: "Welcome to Blockbench" },
        position: 0,
        parentBlockId: null,
      },
      {
        pageId: gettingStarted.id,
        type: "paragraph",
        content: { type: "paragraph", text: "This is your prototype workspace. Edit any block, use / to insert new block types, and drag the handle to reorder." },
        position: 1,
        parentBlockId: null,
      },
      {
        pageId: gettingStarted.id,
        type: "to_do",
        content: { type: "taskItem", attrs: { checked: false }, text: "Try the slash command menu" },
        position: 2,
        parentBlockId: null,
      },
      {
        pageId: gettingStarted.id,
        type: "to_do",
        content: { type: "taskItem", attrs: { checked: true }, text: "Open this workspace" },
        position: 3,
        parentBlockId: null,
      },
      {
        pageId: gettingStarted.id,
        type: "divider",
        content: { type: "horizontalRule" },
        position: 4,
        parentBlockId: null,
      },
      {
        pageId: gettingStarted.id,
        type: "bulleted_list_item",
        content: { type: "listItem", text: "Pages are nested in the sidebar" },
        position: 5,
        parentBlockId: null,
      },
      {
        pageId: gettingStarted.id,
        type: "bulleted_list_item",
        content: { type: "listItem", text: "Changes auto-save after 500ms" },
        position: 6,
        parentBlockId: null,
      },
    ],
  });

  // Page 2: Meeting Notes (child of Getting Started)
  const meetingNotes = await prisma.page.create({
    data: {
      title: "Meeting Notes",
      icon: "📝",
      position: 0,
      workspaceId: WORKSPACE_ID,
      parentId: gettingStarted.id,
    },
  });

  await prisma.block.createMany({
    data: [
      {
        pageId: meetingNotes.id,
        type: "heading_2",
        content: { type: "heading", attrs: { level: 2 }, text: "Q3 Planning — July 2026" },
        position: 0,
        parentBlockId: null,
      },
      {
        pageId: meetingNotes.id,
        type: "paragraph",
        content: { type: "paragraph", text: "Attendees: Product, Engineering, Design" },
        position: 1,
        parentBlockId: null,
      },
      {
        pageId: meetingNotes.id,
        type: "numbered_list_item",
        content: { type: "listItem", text: "Review Q2 metrics" },
        position: 2,
        parentBlockId: null,
      },
      {
        pageId: meetingNotes.id,
        type: "numbered_list_item",
        content: { type: "listItem", text: "Prioritise feature backlog" },
        position: 3,
        parentBlockId: null,
      },
      {
        pageId: meetingNotes.id,
        type: "numbered_list_item",
        content: { type: "listItem", text: "Assign sprint owners" },
        position: 4,
        parentBlockId: null,
      },
      {
        pageId: meetingNotes.id,
        type: "toggle",
        content: { type: "toggle", attrs: { collapsed: false }, text: "Action items" },
        position: 5,
        parentBlockId: null,
      },
    ],
  });

  // Toggle child block
  const toggleBlock = await prisma.block.findFirst({
    where: { pageId: meetingNotes.id, type: "toggle" },
  });
  if (toggleBlock) {
    await prisma.block.create({
      data: {
        pageId: meetingNotes.id,
        parentBlockId: toggleBlock.id,
        type: "paragraph",
        content: { type: "paragraph", text: "Follow up with design team by Friday" },
        position: 0,
      },
    });
  }

  // Page 3: Feature Ideas (root)
  const featureIdeas = await prisma.page.create({
    data: {
      title: "Feature Ideas",
      icon: "💡",
      position: 1,
      workspaceId: WORKSPACE_ID,
      parentId: null,
    },
  });

  await prisma.block.createMany({
    data: [
      {
        pageId: featureIdeas.id,
        type: "heading_1",
        content: { type: "heading", attrs: { level: 1 }, text: "Feature Ideas" },
        position: 0,
        parentBlockId: null,
      },
      {
        pageId: featureIdeas.id,
        type: "paragraph",
        content: { type: "paragraph", text: "Gaps to prototype based on Notion user feedback:" },
        position: 1,
        parentBlockId: null,
      },
      {
        pageId: featureIdeas.id,
        type: "bulleted_list_item",
        content: { type: "listItem", text: "Sprint burndown chart view" },
        position: 2,
        parentBlockId: null,
      },
      {
        pageId: featureIdeas.id,
        type: "bulleted_list_item",
        content: { type: "listItem", text: "Custom hex color for tags" },
        position: 3,
        parentBlockId: null,
      },
      {
        pageId: featureIdeas.id,
        type: "bulleted_list_item",
        content: { type: "listItem", text: "Native time tracking on rows" },
        position: 4,
        parentBlockId: null,
      },
      {
        pageId: featureIdeas.id,
        type: "divider",
        content: { type: "horizontalRule" },
        position: 5,
        parentBlockId: null,
      },
      {
        pageId: featureIdeas.id,
        type: "paragraph",
        content: { type: "paragraph", text: "Pick one and build it on top of this scaffold." },
        position: 6,
        parentBlockId: null,
      },
    ],
  });

  console.log("✅ Seed complete: 1 workspace, 3 pages, blocks created");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 3: Run seed**

```bash
npx prisma db seed
```
Expected output: `✅ Seed complete: 1 workspace, 3 pages, blocks created`

- [ ] **Step 4: Verify in Prisma Studio**

```bash
npx prisma studio
```
Expected: `Workspace` table has 1 row. `Page` table has 3 rows. `Block` table has ~15 rows.

- [ ] **Step 5: Commit**

```bash
git add prisma/seed.ts package.json
git commit -m "feat: add seed script with sample workspace, pages, and blocks"
```

---

## Task 5: Root Layout + Routing

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`
- Create: `app/[pageId]/page.tsx`

**Interfaces:**
- Consumes: `GET /api/pages` → `PageRow[]`
- Produces: Layout shell with sidebar slot, redirect to first page, per-page route

- [ ] **Step 1: Update `app/layout.tsx`**

```typescript
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Blockbench",
  description: "Notion prototype sandbox",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="flex h-screen overflow-hidden bg-white">
          {children}
        </div>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Update `app/page.tsx`**

```typescript
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { WORKSPACE_ID } from "@/lib/constants";

export default async function HomePage() {
  const firstPage = await prisma.page.findFirst({
    where: { workspaceId: WORKSPACE_ID },
    orderBy: { position: "asc" },
  });

  if (firstPage) {
    redirect(`/${firstPage.id}`);
  }

  return (
    <div className="flex h-screen items-center justify-center text-gray-400">
      No pages yet. Run <code className="mx-1 font-mono">npx prisma db seed</code> to get started.
    </div>
  );
}
```

- [ ] **Step 3: Create `app/[pageId]/page.tsx`**

```typescript
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { Editor } from "@/components/editor/Editor";
import { WORKSPACE_ID } from "@/lib/constants";

export default async function PageRoute({
  params,
}: {
  params: { pageId: string };
}) {
  const page = await prisma.page.findUnique({
    where: { id: params.pageId },
  });

  if (!page) notFound();

  const blocks = await prisma.block.findMany({
    where: { pageId: params.pageId },
    orderBy: { position: "asc" },
  });

  const allPages = await prisma.page.findMany({
    where: { workspaceId: WORKSPACE_ID },
    orderBy: { position: "asc" },
  });

  return (
    <>
      <Sidebar pages={allPages} activePageId={params.pageId} />
      <main className="flex-1 overflow-y-auto">
        <Editor page={page} initialBlocks={blocks} />
      </main>
    </>
  );
}
```

- [ ] **Step 4: Verify**

With the dev server running (`npm run dev`), visit `localhost:3000`. Expected: redirects to `localhost:3000/<first-page-id>`. Page renders without errors (Sidebar and Editor components don't exist yet so you'll see a module-not-found error — that's expected at this stage).

- [ ] **Step 5: Commit**

```bash
git add app/layout.tsx app/page.tsx app/[pageId]/
git commit -m "feat: add root layout, home redirect, and per-page route"
```

---

## Task 6: Sidebar Components

**Files:**
- Create: `components/sidebar/Sidebar.tsx`
- Create: `components/sidebar/PageTreeItem.tsx`

**Interfaces:**
- Consumes: `PageRow`, `PageWithChildren` from `lib/types.ts`
- Consumes: `POST /api/pages` to create new pages
- Produces: `<Sidebar pages={PageRow[]} activePageId={string} />`

- [ ] **Step 1: Create `components/sidebar/PageTreeItem.tsx`**

```typescript
"use client";

import Link from "next/link";
import { useState } from "react";
import { PageWithChildren } from "@/lib/types";

interface Props {
  page: PageWithChildren;
  activePageId: string;
  depth?: number;
}

export function PageTreeItem({ page, activePageId, depth = 0 }: Props) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = page.children.length > 0;
  const isActive = page.id === activePageId;

  return (
    <div>
      <div
        className={`group flex items-center gap-1 rounded px-2 py-1 text-sm cursor-pointer hover:bg-gray-100 ${
          isActive ? "bg-gray-200 font-medium" : ""
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-4 h-4 flex items-center justify-center text-gray-400 shrink-0"
        >
          {hasChildren ? (expanded ? "▾" : "▸") : ""}
        </button>
        <span className="shrink-0">{page.icon ?? "📄"}</span>
        <Link href={`/${page.id}`} className="flex-1 truncate">
          {page.title || "Untitled"}
        </Link>
      </div>
      {expanded && hasChildren && (
        <div>
          {page.children.map((child) => (
            <PageTreeItem
              key={child.id}
              page={child}
              activePageId={activePageId}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `components/sidebar/Sidebar.tsx`**

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageRow, PageWithChildren } from "@/lib/types";
import { PageTreeItem } from "./PageTreeItem";

function buildTree(pages: PageRow[]): PageWithChildren[] {
  const map = new Map<string, PageWithChildren>();
  const roots: PageWithChildren[] = [];

  for (const page of pages) {
    map.set(page.id, { ...page, children: [] });
  }

  for (const page of pages) {
    const node = map.get(page.id)!;
    if (page.parentId && map.has(page.parentId)) {
      map.get(page.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

interface Props {
  pages: PageRow[];
  activePageId: string;
}

export function Sidebar({ pages, activePageId }: Props) {
  const router = useRouter();
  const tree = buildTree(pages);

  async function createPage() {
    const res = await fetch("/api/pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Untitled" }),
    });
    const page = await res.json();
    router.push(`/${page.id}`);
  }

  return (
    <aside className="w-60 shrink-0 border-r border-gray-200 flex flex-col h-screen">
      <div className="px-4 py-3 border-b border-gray-100">
        <span className="text-sm font-semibold text-gray-700">Blockbench</span>
      </div>
      <nav className="flex-1 overflow-y-auto py-2">
        {tree.map((page) => (
          <PageTreeItem
            key={page.id}
            page={page}
            activePageId={activePageId}
          />
        ))}
      </nav>
      <div className="px-4 py-3 border-t border-gray-100">
        <button
          onClick={createPage}
          className="w-full text-left text-sm text-gray-400 hover:text-gray-600 flex items-center gap-2"
        >
          <span>+</span> New page
        </button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: Verify**

Visit `localhost:3000`. Expected: Left sidebar renders with 3 pages. "Getting Started" has a `▾` toggle showing "Meeting Notes" as a child. Clicking a page navigates to its route. "New page" button creates a page and navigates to it.

- [ ] **Step 4: Commit**

```bash
git add components/sidebar/
git commit -m "feat: add recursive sidebar with page tree and new page button"
```

---

## Task 7: Slash Command Extension

**Files:**
- Create: `components/editor/extensions/SlashCommand.ts`
- Create: `components/editor/SlashMenu.tsx`

**Interfaces:**
- Produces: `SlashCommand` Tiptap Extension (default export from `SlashCommand.ts`)
- Produces: `SlashMenu` React component used inside the extension's render function

- [ ] **Step 1: Create `components/editor/SlashMenu.tsx`**

```typescript
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Editor } from "@tiptap/react";

export interface SlashMenuItem {
  title: string;
  description: string;
  icon: string;
  command: (editor: Editor) => void;
}

export const SLASH_MENU_ITEMS: SlashMenuItem[] = [
  {
    title: "Paragraph",
    description: "Plain text",
    icon: "¶",
    command: (editor) => editor.chain().focus().setParagraph().run(),
  },
  {
    title: "Heading 1",
    description: "Large heading",
    icon: "H1",
    command: (editor) => editor.chain().focus().setHeading({ level: 1 }).run(),
  },
  {
    title: "Heading 2",
    description: "Medium heading",
    icon: "H2",
    command: (editor) => editor.chain().focus().setHeading({ level: 2 }).run(),
  },
  {
    title: "Heading 3",
    description: "Small heading",
    icon: "H3",
    command: (editor) => editor.chain().focus().setHeading({ level: 3 }).run(),
  },
  {
    title: "Bullet List",
    description: "Unordered list",
    icon: "•",
    command: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    title: "Numbered List",
    description: "Ordered list",
    icon: "1.",
    command: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    title: "To-do",
    description: "Checkbox task",
    icon: "☐",
    command: (editor) => editor.chain().focus().toggleTaskList().run(),
  },
  {
    title: "Divider",
    description: "Horizontal rule",
    icon: "—",
    command: (editor) => editor.chain().focus().setHorizontalRule().run(),
  },
];

interface Props {
  editor: Editor;
  items: SlashMenuItem[];
  command: (item: SlashMenuItem) => void;
}

export interface SlashMenuHandle {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

export const SlashMenu = forwardRef<SlashMenuHandle, Props>(
  ({ editor, items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useImperativeHandle(ref, () => ({
      onKeyDown({ key }: KeyboardEvent) {
        if (key === "ArrowUp") {
          setSelectedIndex((i) => (i - 1 + items.length) % items.length);
          return true;
        }
        if (key === "ArrowDown") {
          setSelectedIndex((i) => (i + 1) % items.length);
          return true;
        }
        if (key === "Enter") {
          command(items[selectedIndex]);
          return true;
        }
        return false;
      },
    }));

    useEffect(() => setSelectedIndex(0), [items]);

    return (
      <div className="z-50 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden w-64">
        {items.length === 0 ? (
          <div className="px-4 py-3 text-sm text-gray-400">No results</div>
        ) : (
          items.map((item, index) => (
            <button
              key={item.title}
              onClick={() => command(item)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 ${
                index === selectedIndex ? "bg-gray-100" : ""
              }`}
            >
              <span className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded text-sm font-mono shrink-0">
                {item.icon}
              </span>
              <div>
                <div className="text-sm font-medium text-gray-800">{item.title}</div>
                <div className="text-xs text-gray-400">{item.description}</div>
              </div>
            </button>
          ))
        )}
      </div>
    );
  }
);

SlashMenu.displayName = "SlashMenu";
```

- [ ] **Step 2: Create `components/editor/extensions/SlashCommand.ts`**

```typescript
import { Extension } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import tippy, { Instance as TippyInstance } from "tippy.js";
import { SlashMenu, SlashMenuHandle, SLASH_MENU_ITEMS, SlashMenuItem } from "../SlashMenu";
import "tippy.js/dist/tippy.css";

export const SlashCommand = Extension.create({
  name: "slashCommand",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        pluginKey: new PluginKey("slashCommand"),
        startOfLine: false,

        items({ query }: { query: string }) {
          return SLASH_MENU_ITEMS.filter((item) =>
            item.title.toLowerCase().includes(query.toLowerCase())
          );
        },

        render() {
          let component: ReactRenderer<SlashMenuHandle>;
          let popup: TippyInstance[];

          return {
            onStart(props: { editor: unknown; clientRect?: (() => DOMRect | null) | null; items: SlashMenuItem[]; command: (item: SlashMenuItem) => void }) {
              component = new ReactRenderer(SlashMenu, {
                props,
                editor: props.editor as Parameters<typeof ReactRenderer>[1]["editor"],
              });

              popup = tippy("body", {
                getReferenceClientRect: props.clientRect as () => DOMRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: "manual",
                placement: "bottom-start",
              });
            },

            onUpdate(props: { clientRect?: (() => DOMRect | null) | null; items: SlashMenuItem[]; command: (item: SlashMenuItem) => void }) {
              component.updateProps(props);
              popup[0].setProps({
                getReferenceClientRect: props.clientRect as () => DOMRect,
              });
            },

            onKeyDown(props: { event: KeyboardEvent }) {
              if (props.event.key === "Escape") {
                popup[0].hide();
                return true;
              }
              return component.ref?.onKeyDown(props.event) ?? false;
            },

            onExit() {
              popup[0].destroy();
              component.destroy();
            },
          };
        },

        command({ editor, range, props }: { editor: unknown; range: { from: number; to: number }; props: SlashMenuItem }) {
          const tiptapEditor = editor as import("@tiptap/react").Editor;
          tiptapEditor.chain().focus().deleteRange(range).run();
          props.command(tiptapEditor);
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
```

- [ ] **Step 3: Commit**

```bash
git add components/editor/extensions/ components/editor/SlashMenu.tsx
git commit -m "feat: add slash command Tiptap extension with block type menu"
```

---

## Task 8: Editor Component

**Files:**
- Create: `components/editor/Editor.tsx`

**Interfaces:**
- Consumes: `SlashCommand` extension, `BlockRow`, `PageRow` from `lib/types.ts`
- Consumes: `PATCH /api/pages/[pageId]/blocks`
- Consumes: `PATCH /api/pages/[pageId]` (for title updates)
- Produces: `<Editor page={PageRow} initialBlocks={BlockRow[]} />`

- [ ] **Step 1: Create `components/editor/Editor.tsx`**

```typescript
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Typography from "@tiptap/extension-typography";
import { DragHandleReact } from "@tiptap/extension-drag-handle-react";
import { SlashCommand } from "./extensions/SlashCommand";
import { BlockRow, PageRow } from "@/lib/types";

interface Props {
  page: PageRow;
  initialBlocks: BlockRow[];
}

function blocksToTiptapContent(blocks: BlockRow[]) {
  if (blocks.length === 0) {
    return { type: "doc", content: [{ type: "paragraph" }] };
  }

  const topLevel = blocks.filter((b) => !b.parentBlockId);
  const children = blocks.filter((b) => b.parentBlockId);

  const nodes = topLevel.map((block) => {
    const blockChildren = children.filter((c) => c.parentBlockId === block.id);
    return blockToNode(block, blockChildren);
  });

  return { type: "doc", content: nodes };
}

function blockToNode(block: BlockRow, children: BlockRow[] = []): Record<string, unknown> {
  const content = block.content as Record<string, unknown>;
  const text = content.text as string | undefined;
  const textContent = text ? [{ type: "text", text }] : [];

  switch (block.type) {
    case "paragraph":
      return { type: "paragraph", content: textContent };
    case "heading_1":
      return { type: "heading", attrs: { level: 1 }, content: textContent };
    case "heading_2":
      return { type: "heading", attrs: { level: 2 }, content: textContent };
    case "heading_3":
      return { type: "heading", attrs: { level: 3 }, content: textContent };
    case "bulleted_list_item":
      return { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: textContent }] }] };
    case "numbered_list_item":
      return { type: "orderedList", content: [{ type: "listItem", content: [{ type: "paragraph", content: textContent }] }] };
    case "to_do": {
      const attrs = content.attrs as Record<string, unknown> | undefined;
      return { type: "taskList", content: [{ type: "taskItem", attrs: { checked: attrs?.checked ?? false }, content: [{ type: "paragraph", content: textContent }] }] };
    }
    case "divider":
      return { type: "horizontalRule" };
    case "toggle":
      return {
        type: "paragraph",
        content: [
          { type: "text", text: `▶ ${text ?? "Toggle"}` },
          ...children.flatMap((c) => {
            const childContent = c.content as Record<string, unknown>;
            const childText = childContent.text as string | undefined;
            return childText ? [{ type: "text", text: `\n  ${childText}` }] : [];
          }),
        ],
      };
    default:
      return { type: "paragraph", content: textContent };
  }
}

function tiptapDocToBlocks(doc: Record<string, unknown>, pageId: string): Omit<BlockRow, "createdAt" | "updatedAt">[] {
  const content = doc.content as Record<string, unknown>[] | undefined;
  if (!content) return [];

  const blocks: Omit<BlockRow, "createdAt" | "updatedAt">[] = [];
  let position = 0;

  for (const node of content) {
    const id = crypto.randomUUID();
    const type = node.type as string;
    const nodeAttrs = node.attrs as Record<string, unknown> | undefined;
    const nodeContent = node.content as Record<string, unknown>[] | undefined;

    const getText = (n: Record<string, unknown>): string => {
      const c = n.content as Record<string, unknown>[] | undefined;
      if (!c) return "";
      return c
        .map((child) => (child.type === "text" ? (child.text as string) : getText(child)))
        .join("");
    };

    let blockType = "paragraph";
    let blockContent: Record<string, unknown> = {};

    switch (type) {
      case "paragraph":
        blockType = "paragraph";
        blockContent = { type: "paragraph", text: getText(node) };
        break;
      case "heading":
        blockType = `heading_${nodeAttrs?.level ?? 1}`;
        blockContent = { type: "heading", attrs: { level: nodeAttrs?.level ?? 1 }, text: getText(node) };
        break;
      case "bulletList": {
        const items = nodeContent ?? [];
        for (const item of items) {
          blocks.push({ id: crypto.randomUUID(), pageId, parentBlockId: null, type: "bulleted_list_item", content: { type: "listItem", text: getText(item) }, position: position++ });
        }
        continue;
      }
      case "orderedList": {
        const items = nodeContent ?? [];
        for (const item of items) {
          blocks.push({ id: crypto.randomUUID(), pageId, parentBlockId: null, type: "numbered_list_item", content: { type: "listItem", text: getText(item) }, position: position++ });
        }
        continue;
      }
      case "taskList": {
        const items = nodeContent ?? [];
        for (const item of items) {
          const itemAttrs = item.attrs as Record<string, unknown> | undefined;
          blocks.push({ id: crypto.randomUUID(), pageId, parentBlockId: null, type: "to_do", content: { type: "taskItem", attrs: { checked: itemAttrs?.checked ?? false }, text: getText(item) }, position: position++ });
        }
        continue;
      }
      case "horizontalRule":
        blockType = "divider";
        blockContent = { type: "horizontalRule" };
        break;
      default:
        blockType = "paragraph";
        blockContent = { type: "paragraph", text: getText(node) };
    }

    blocks.push({ id, pageId, parentBlockId: null, type: blockType, content: blockContent, position: position++ });
  }

  return blocks;
}

export function Editor({ page, initialBlocks }: Props) {
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [title, setTitle] = useState(page.title);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageId = page.id;

  const saveBlocks = useCallback(
    async (doc: Record<string, unknown>) => {
      setSaveState("saving");
      const blocks = tiptapDocToBlocks(doc, pageId);
      await fetch(`/api/pages/${pageId}/blocks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks }),
      });
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    },
    [pageId]
  );

  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: false }),
      Typography,
      SlashCommand,
    ],
    content: blocksToTiptapContent(initialBlocks),
    onUpdate({ editor }) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        saveBlocks(editor.getJSON() as Record<string, unknown>);
      }, 500);
    },
    editorProps: {
      attributes: {
        class: "outline-none min-h-[60vh] prose prose-gray max-w-none",
      },
    },
  });

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  async function saveTitle(newTitle: string) {
    await fetch(`/api/pages/${pageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle }),
    });
  }

  return (
    <div className="max-w-3xl mx-auto px-8 py-12">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <span className="text-3xl">{page.icon ?? "📄"}</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => saveTitle(title)}
            className="text-3xl font-bold text-gray-900 outline-none bg-transparent w-full"
            placeholder="Untitled"
          />
        </div>
        <div className="text-xs text-gray-400 shrink-0 ml-4">
          {saveState === "saving" && "Saving..."}
          {saveState === "saved" && "Saved"}
        </div>
      </div>

      {editor && (
        <DragHandleReact editor={editor} tippyOptions={{ duration: 100 }}>
          <div className="text-gray-300 hover:text-gray-500 cursor-grab px-1">⠿</div>
        </DragHandleReact>
      )}

      <EditorContent editor={editor} />
    </div>
  );
}
```

- [ ] **Step 2: Install `@tailwindcss/typography`**

```bash
npm install -D @tailwindcss/typography
```

Add to `tailwind.config.ts`:
```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [require("@tailwindcss/typography")],
};
export default config;
```

- [ ] **Step 3: Verify**

Visit `localhost:3000`. Expected:
- Sidebar shows 3 pages
- Clicking a page shows title + blocks rendered in the editor
- Typing in the editor triggers "Saving..." then "Saved" after 500ms
- Typing `/` shows the slash command menu with all block types
- Selecting a block type from the menu inserts it
- Drag handle (⠿) appears to the left of blocks
- Refreshing the page after edits shows changes persisted

- [ ] **Step 4: Commit**

```bash
git add components/editor/Editor.tsx tailwind.config.ts
git commit -m "feat: add Tiptap editor with slash commands, drag handles, and autosave"
```

---

## Verification Summary

| What | Command | Expected |
|---|---|---|
| DB tables exist | `npx prisma studio` | 3 tables, seed data visible |
| Sidebar renders | Visit `localhost:3000` | 3 pages in tree, nesting works |
| Editor loads | Click "Getting Started" | Blocks render, title shows |
| Slash menu | Type `/` in editor | Popover with 8 block types |
| Markdown shortcuts | Type `## ` | Converts to heading |
| Drag to reorder | Drag ⠿ handle | Block moves position |
| Autosave | Edit text, wait 500ms | "Saving..." → "Saved" → refresh persists |
