import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { WORKSPACE_ID } from "@/lib/constants";

export default async function HomePage() {
  const firstPage = await prisma.page.findFirst({
    where: { workspaceId: WORKSPACE_ID },
    orderBy: { position: "asc" },
  });

  if (firstPage) {
    redirect(`/${firstPage.id}`);
  }

  return (
    <div className="flex h-screen items-center justify-center text-gray-400">
      No pages yet. Run <code className="mx-1 font-mono">npx prisma db seed</code> to get started.
    </div>
  );
}
