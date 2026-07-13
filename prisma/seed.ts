import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
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
