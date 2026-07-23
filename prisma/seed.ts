import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { createPrismaAdapter } from "../lib/prismaAdapter";
import { refreshContextSuggestionsForPage } from "../lib/contextWeaver";
import { PageKind } from "../lib/types";

const adapter = createPrismaAdapter();
const prisma = new PrismaClient({ adapter });
const WORKSPACE_ID = "clworkspace0000000000000000";

type SeedBlock = {
  type: string;
  content: Record<string, unknown>;
  position: number;
  parentBlockId?: string | null;
};

async function createPageWithBlocks(input: {
  title: string;
  icon: string;
  kind: PageKind;
  position: number;
  parentId?: string | null;
  blocks: SeedBlock[];
}) {
  const page = await prisma.page.create({
    data: {
      title: input.title,
      icon: input.icon,
      kind: input.kind,
      position: input.position,
      workspaceId: WORKSPACE_ID,
      parentId: input.parentId ?? null,
    },
  });

  await prisma.block.createMany({
    data: input.blocks.map((block) => ({
      pageId: page.id,
      type: block.type,
      content: block.content,
      position: block.position,
      parentBlockId: block.parentBlockId ?? null,
    })),
  });

  return page;
}

async function main() {
  await prisma.relationSuggestion.deleteMany();
  await prisma.pageRelation.deleteMany();
  await prisma.block.deleteMany();
  await prisma.page.deleteMany();
  await prisma.workspace.deleteMany();

  await prisma.workspace.create({
    data: { id: WORKSPACE_ID, name: "PM Sandbox Workspace" },
  });

  const home = await createPageWithBlocks({
    title: "PM Home",
    icon: "🏠",
    kind: "GENERAL",
    position: 0,
    blocks: [
      {
        type: "heading_1",
        content: { type: "heading", attrs: { level: 1 }, text: "Context Weaver Prototype" },
        position: 0,
      },
      {
        type: "paragraph",
        content: {
          type: "paragraph",
          text: "Use the page type selector to model roadmap items, meetings, tasks, and feedback. This demo uses a simple page icon feature so the relation suggestions are easy to explain.",
        },
        position: 1,
      },
    ],
  });

  const roadmap = await createPageWithBlocks({
    title: "Page Icon Refresh",
    icon: "🎨",
    kind: "ROADMAP",
    position: 1,
    blocks: [
      {
        type: "heading_1",
        content: { type: "heading", attrs: { level: 1 }, text: "Page Icon Refresh" },
        position: 0,
      },
      {
        type: "paragraph",
        content: {
          type: "paragraph",
          text: "This roadmap item improves how page icons appear in the sidebar and introduces a lighter-weight emoji icon picker for page personalization.",
        },
        position: 1,
      },
      {
        type: "bulleted_list_item",
        content: { type: "listItem", text: "Refresh sidebar icon visuals for easier scanning" },
        position: 2,
      },
      {
        type: "bulleted_list_item",
        content: { type: "listItem", text: "Add emoji icon picker to page settings" },
        position: 3,
      },
    ],
  });

  const task = await createPageWithBlocks({
    title: "Ship Emoji Icon Picker",
    icon: "✅",
    kind: "TASK",
    position: 0,
    parentId: roadmap.id,
    blocks: [
      {
        type: "heading_2",
        content: { type: "heading", attrs: { level: 2 }, text: "Ship Emoji Icon Picker" },
        position: 0,
      },
      {
        type: "paragraph",
        content: {
          type: "paragraph",
          text: "Build the emoji icon picker so users can change a page icon directly from the page header and see the update immediately in the sidebar.",
        },
        position: 1,
      },
      {
        type: "to_do",
        content: { type: "taskItem", attrs: { checked: false }, text: "Add icon picker trigger in the page header" },
        position: 2,
      },
      {
        type: "to_do",
        content: { type: "taskItem", attrs: { checked: false }, text: "Persist selected emoji icon and refresh sidebar state" },
        position: 3,
      },
    ],
  });

  const feedback = await createPageWithBlocks({
    title: "Sidebar Icon Feedback",
    icon: "💬",
    kind: "FEEDBACK",
    position: 2,
    blocks: [
      {
        type: "heading_1",
        content: { type: "heading", attrs: { level: 1 }, text: "Sidebar Icon Feedback" },
        position: 0,
      },
      {
        type: "paragraph",
        content: {
          type: "paragraph",
          text: "Users say the current page icon treatment is too subtle in the sidebar and want a quicker way to pick an emoji icon without leaving the page.",
        },
        position: 1,
      },
      {
        type: "bulleted_list_item",
        content: { type: "listItem", text: "Sidebar icons are hard to scan in dense docs" },
        position: 2,
      },
      {
        type: "bulleted_list_item",
        content: { type: "listItem", text: "Users expect an emoji picker when changing a page icon" },
        position: 3,
      },
    ],
  });

  const meeting = await createPageWithBlocks({
    title: "Icon Picker Kickoff",
    icon: "📝",
    kind: "MEETING",
    position: 3,
    blocks: [
      {
        type: "heading_1",
        content: { type: "heading", attrs: { level: 1 }, text: "Icon Picker Kickoff" },
        position: 0,
      },
      {
        type: "paragraph",
        content: {
          type: "paragraph",
          text: "Reviewed the Page Icon Refresh roadmap item, the Ship Emoji Icon Picker task, and user feedback about sidebar icon clarity and page personalization.",
        },
        position: 1,
      },
      {
        type: "numbered_list_item",
        content: { type: "listItem", text: "Align scope for sidebar icon refresh and emoji picker launch" },
        position: 2,
      },
      {
        type: "numbered_list_item",
        content: { type: "listItem", text: "Prioritize the page header icon picker task" },
        position: 3,
      },
      {
        type: "numbered_list_item",
        content: { type: "listItem", text: "Review feedback themes around sidebar icon discoverability" },
        position: 4,
      },
    ],
  });

  await Promise.all([
    refreshContextSuggestionsForPage(home.id, prisma),
    refreshContextSuggestionsForPage(roadmap.id, prisma),
    refreshContextSuggestionsForPage(task.id, prisma),
    refreshContextSuggestionsForPage(feedback.id, prisma),
    refreshContextSuggestionsForPage(meeting.id, prisma),
  ]);

  console.log("✅ Seed complete: Context Weaver demo workspace created");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
