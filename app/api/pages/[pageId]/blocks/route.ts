import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { refreshContextSuggestionsForPage } from "@/lib/contextWeaver";
import { Prisma } from "@prisma/client";
import { BlockRow } from "@/lib/types";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ pageId: string }> }
) {
  const { pageId } = await params;
  const body = await request.json();
  const { blocks }: { blocks: BlockRow[] } = body;

  const incomingIds = blocks.map((b) => b.id);

  await prisma.$transaction([
    // Delete blocks no longer present
    prisma.block.deleteMany({
      where: {
        pageId,
        id: { notIn: incomingIds },
      },
    }),
    // Upsert all incoming blocks
    ...blocks.map((block) =>
      prisma.block.upsert({
        where: { id: block.id },
        update: {
          type: block.type,
          content: block.content as Prisma.InputJsonValue,
          position: block.position,
          parentBlockId: block.parentBlockId,
        },
        create: {
          id: block.id,
          pageId,
          parentBlockId: block.parentBlockId,
          type: block.type,
          content: block.content as Prisma.InputJsonValue,
          position: block.position,
        },
      })
    ),
  ]);

  await refreshContextSuggestionsForPage(pageId);

  return NextResponse.json({ success: true });
}
