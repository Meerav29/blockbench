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
