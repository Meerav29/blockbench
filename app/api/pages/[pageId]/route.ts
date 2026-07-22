import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { refreshContextSuggestionsForPage } from "@/lib/contextWeaver";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ pageId: string }> }
) {
  const { pageId } = await params;
  const page = await prisma.page.findUnique({
    where: { id: pageId },
  });
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const blocks = await prisma.block.findMany({
    where: { pageId },
    orderBy: { position: "asc" },
  });
  return NextResponse.json({ page, blocks });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ pageId: string }> }
) {
  const { pageId } = await params;
  const body = await request.json();
  const { title, icon, kind } = body;

  const page = await prisma.page.update({
    where: { id: pageId },
    data: {
      ...(title !== undefined && { title }),
      ...(icon !== undefined && { icon }),
      ...(kind !== undefined && { kind }),
    },
  });

  if (title !== undefined || kind !== undefined) {
    await refreshContextSuggestionsForPage(pageId);
  }

  return NextResponse.json(page);
}
