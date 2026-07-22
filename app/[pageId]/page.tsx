import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { Editor } from "@/components/editor/Editor";
import { WORKSPACE_ID } from "@/lib/constants";
import { getContextWeaverPayload } from "@/lib/contextWeaver";
import { ContextWeaverPanel } from "@/components/context/ContextWeaverPanel";

export default async function PageRoute({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
  const { pageId } = await params;

  const page = await prisma.page.findUnique({
    where: { id: pageId },
  });

  if (!page) notFound();

  const blocks = await prisma.block.findMany({
    where: { pageId: pageId },
    orderBy: { position: "asc" },
  });

  const [allPages, contextData] = await Promise.all([
    prisma.page.findMany({
      where: { workspaceId: WORKSPACE_ID },
      orderBy: { position: "asc" },
    }),
    getContextWeaverPayload(pageId),
  ]);

  const pageRow = {
    ...page,
    createdAt: page.createdAt.toISOString(),
    updatedAt: page.updatedAt.toISOString(),
  };

  const blockRows = blocks.map((b) => ({
    ...b,
    content: (b.content ?? {}) as Record<string, unknown>,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  }));

  const allPageRows = allPages.map((p) => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }));

  return (
    <>
      <Sidebar pages={allPageRows} activePageId={pageId} />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <Editor page={pageRow} initialBlocks={blockRows} />
      </main>
      <ContextWeaverPanel
        pageId={pageId}
        currentKind={pageRow.kind}
        initialData={contextData}
      />
    </>
  );
}
