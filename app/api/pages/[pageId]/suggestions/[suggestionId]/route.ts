import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getContextWeaverPayload } from "@/lib/contextWeaver";

export async function PATCH(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ pageId: string; suggestionId: string }>;
  }
) {
  const { pageId, suggestionId } = await params;
  const body = await request.json();
  const { action } = body as { action?: "approve" | "dismiss" };

  const suggestion = await prisma.relationSuggestion.findUnique({
    where: { id: suggestionId },
  });

  if (!suggestion || suggestion.sourcePageId !== pageId) {
    return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
  }

  if (action === "approve") {
    await prisma.$transaction([
      prisma.pageRelation.upsert({
        where: {
          sourcePageId_targetPageId: {
            sourcePageId: suggestion.sourcePageId,
            targetPageId: suggestion.targetPageId,
          },
        },
        update: {
          confidence: suggestion.confidence,
          rationale: suggestion.rationale,
          relationType: "CONTEXTUAL",
        },
        create: {
          sourcePageId: suggestion.sourcePageId,
          targetPageId: suggestion.targetPageId,
          confidence: suggestion.confidence,
          rationale: suggestion.rationale,
          relationType: "CONTEXTUAL",
        },
      }),
      prisma.relationSuggestion.update({
        where: { id: suggestionId },
        data: { status: "APPROVED" },
      }),
    ]);
  } else if (action === "dismiss") {
    await prisma.relationSuggestion.update({
      where: { id: suggestionId },
      data: { status: "DISMISSED" },
    });
  } else {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const payload = await getContextWeaverPayload(pageId);
  return NextResponse.json(payload);
}
