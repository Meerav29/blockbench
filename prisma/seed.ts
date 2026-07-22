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
          text: "Use the page type selector to model roadmap items, meetings, tasks, and feedback. The right rail suggests related pages based on page content.",
        },
        position: 1,
      },
    ],
  });

  const roadmap = await createPageWithBlocks({
    title: "Billing Redesign",
    icon: "🧭",
    kind: "ROADMAP",
    position: 1,
    blocks: [
      {
        type: "heading_1",
        content: { type: "heading", attrs: { level: 1 }, text: "Billing Redesign" },
        position: 0,
      },
      {
        type: "paragraph",
        content: {
          type: "paragraph",
          text: "This roadmap item covers the billing redesign, invoice clarity, checkout performance, and recovery after payment timeout errors.",
        },
        position: 1,
      },
      {
        type: "bulleted_list_item",
        content: { type: "listItem", text: "Reduce billing latency during checkout" },
        position: 2,
      },
      {
        type: "bulleted_list_item",
        content: { type: "listItem", text: "Clarify invoice status after payment retry" },
        position: 3,
      },
    ],
  });

  const task = await createPageWithBlocks({
    title: "Fix Billing Timeout Bug",
    icon: "✅",
    kind: "TASK",
    position: 0,
    parentId: roadmap.id,
    blocks: [
      {
        type: "heading_2",
        content: { type: "heading", attrs: { level: 2 }, text: "Fix Billing Timeout Bug" },
        position: 0,
      },
      {
        type: "paragraph",
        content: {
          type: "paragraph",
          text: "Debug the billing timeout bug causing duplicate invoices and poor payment retry performance for enterprise checkout flows.",
        },
        position: 1,
      },
      {
        type: "to_do",
        content: { type: "taskItem", attrs: { checked: false }, text: "Reproduce the checkout timeout issue" },
        position: 2,
      },
      {
        type: "to_do",
        content: { type: "taskItem", attrs: { checked: false }, text: "Ship invoice retry fix behind feature flag" },
        position: 3,
      },
    ],
  });

  const feedback = await createPageWithBlocks({
    title: "Billing Feedback Digest",
    icon: "💬",
    kind: "FEEDBACK",
    position: 2,
    blocks: [
      {
        type: "heading_1",
        content: { type: "heading", attrs: { level: 1 }, text: "Billing Feedback Digest" },
        position: 0,
      },
      {
        type: "paragraph",
        content: {
          type: "paragraph",
          text: "Users report billing confusion when checkout stalls, payment retries fail, and invoice totals look inconsistent after timeout recovery.",
        },
        position: 1,
      },
      {
        type: "bulleted_list_item",
        content: { type: "listItem", text: "Duplicate invoices after timeout" },
        position: 2,
      },
      {
        type: "bulleted_list_item",
        content: { type: "listItem", text: "Slow billing confirmation in enterprise checkout" },
        position: 3,
      },
    ],
  });

  const meeting = await createPageWithBlocks({
    title: "Billing Performance Sync",
    icon: "📝",
    kind: "MEETING",
    position: 3,
    blocks: [
      {
        type: "heading_1",
        content: { type: "heading", attrs: { level: 1 }, text: "Billing Performance Sync" },
        position: 0,
      },
      {
        type: "paragraph",
        content: {
          type: "paragraph",
          text: "Reviewed the Billing Redesign roadmap item, the billing timeout bug task, and user feedback about invoice confusion during checkout.",
        },
        position: 1,
      },
      {
        type: "numbered_list_item",
        content: { type: "listItem", text: "Align roadmap scope for payment retry and invoice clarity" },
        position: 2,
      },
      {
        type: "numbered_list_item",
        content: { type: "listItem", text: "Prioritize fix for billing timeout performance regression" },
        position: 3,
      },
      {
        type: "numbered_list_item",
        content: { type: "listItem", text: "Review feedback themes from enterprise checkout users" },
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
