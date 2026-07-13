import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { Editor } from "@/components/editor/Editor";
import { WORKSPACE_ID } from "@/lib/constants";

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

  const allPages = await prisma.page.findMany({
    where: { workspaceId: WORKSPACE_ID },
    orderBy: { position: "asc" },
  });

  return (
    <>
      <Sidebar pages={allPages} activePageId={pageId} />
      <main className="flex-1 overflow-y-auto">
        <Editor page={page} initialBlocks={blocks} />
      </main>
    </>
  );
}
