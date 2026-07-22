import { NextResponse } from "next/server";
import {
  getContextWeaverPayload,
  refreshContextSuggestionsForPage,
} from "@/lib/contextWeaver";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ pageId: string }> }
) {
  const { pageId } = await params;
  const payload = await getContextWeaverPayload(pageId);
  return NextResponse.json(payload);
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ pageId: string }> }
) {
  const { pageId } = await params;
  await refreshContextSuggestionsForPage(pageId);
  const payload = await getContextWeaverPayload(pageId);
  return NextResponse.json(payload);
}
