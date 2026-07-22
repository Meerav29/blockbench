"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Typography from "@tiptap/extension-typography";
import { DragHandle } from "@tiptap/extension-drag-handle-react";
import { SlashCommand } from "./extensions/SlashCommand";
import { BlockRow, PageRow } from "@/lib/types";

interface Props {
  page: PageRow;
  initialBlocks: BlockRow[];
}

function blocksToTiptapContent(blocks: BlockRow[]) {
  if (blocks.length === 0) {
    return { type: "doc", content: [{ type: "paragraph" }] };
  }

  const topLevel = blocks.filter((b) => !b.parentBlockId);
  const children = blocks.filter((b) => b.parentBlockId);

  const nodes = topLevel.map((block) => {
    const blockChildren = children.filter((c) => c.parentBlockId === block.id);
    return blockToNode(block, blockChildren);
  });

  if (nodes.length === 0) return { type: "doc", content: [{ type: "paragraph" }] };

  return { type: "doc", content: nodes };
}

function blockToNode(block: BlockRow, children: BlockRow[] = []): Record<string, unknown> {
  const content = block.content as Record<string, unknown>;
  const text = content.text as string | undefined;
  const textContent = text ? [{ type: "text", text }] : [];

  switch (block.type) {
    case "paragraph":
      return { type: "paragraph", content: textContent };
    case "heading_1":
      return { type: "heading", attrs: { level: 1 }, content: textContent };
    case "heading_2":
      return { type: "heading", attrs: { level: 2 }, content: textContent };
    case "heading_3":
      return { type: "heading", attrs: { level: 3 }, content: textContent };
    case "bulleted_list_item":
      return { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: textContent }] }] };
    case "numbered_list_item":
      return { type: "orderedList", content: [{ type: "listItem", content: [{ type: "paragraph", content: textContent }] }] };
    case "to_do": {
      const attrs = content.attrs as Record<string, unknown> | undefined;
      return { type: "taskList", content: [{ type: "taskItem", attrs: { checked: attrs?.checked ?? false }, content: [{ type: "paragraph", content: textContent }] }] };
    }
    case "divider":
      return { type: "horizontalRule" };
    case "toggle":
      return {
        type: "paragraph",
        content: [
          { type: "text", text: `▶ ${text ?? "Toggle"}` },
          ...children.flatMap((c) => {
            const childContent = c.content as Record<string, unknown>;
            const childText = childContent.text as string | undefined;
            return childText ? [{ type: "text", text: `\n  ${childText}` }] : [];
          }),
        ],
      };
    default:
      return { type: "paragraph", content: textContent };
  }
}

function tiptapDocToBlocks(doc: Record<string, unknown>, pageId: string): Omit<BlockRow, "createdAt" | "updatedAt">[] {
  const content = doc.content as Record<string, unknown>[] | undefined;
  if (!content) return [];

  const blocks: Omit<BlockRow, "createdAt" | "updatedAt">[] = [];
  let position = 0;

  for (const node of content) {
    const id = crypto.randomUUID();
    const type = node.type as string;
    const nodeAttrs = node.attrs as Record<string, unknown> | undefined;
    const nodeContent = node.content as Record<string, unknown>[] | undefined;

    const getText = (n: Record<string, unknown>): string => {
      const c = n.content as Record<string, unknown>[] | undefined;
      if (!c) return "";
      return c
        .map((child) => (child.type === "text" ? (child.text as string) : getText(child)))
        .join("");
    };

    let blockType = "paragraph";
    let blockContent: Record<string, unknown> = {};

    switch (type) {
      case "paragraph":
        blockType = "paragraph";
        blockContent = { type: "paragraph", text: getText(node) };
        break;
      case "heading":
        blockType = `heading_${nodeAttrs?.level ?? 1}`;
        blockContent = { type: "heading", attrs: { level: nodeAttrs?.level ?? 1 }, text: getText(node) };
        break;
      case "bulletList": {
        const items = nodeContent ?? [];
        for (const item of items) {
          blocks.push({ id: crypto.randomUUID(), pageId, parentBlockId: null, type: "bulleted_list_item", content: { type: "listItem", text: getText(item) }, position: position++ });
        }
        continue;
      }
      case "orderedList": {
        const items = nodeContent ?? [];
        for (const item of items) {
          blocks.push({ id: crypto.randomUUID(), pageId, parentBlockId: null, type: "numbered_list_item", content: { type: "listItem", text: getText(item) }, position: position++ });
        }
        continue;
      }
      case "taskList": {
        const items = nodeContent ?? [];
        for (const item of items) {
          const itemAttrs = item.attrs as Record<string, unknown> | undefined;
          blocks.push({ id: crypto.randomUUID(), pageId, parentBlockId: null, type: "to_do", content: { type: "taskItem", attrs: { checked: itemAttrs?.checked ?? false }, text: getText(item) }, position: position++ });
        }
        continue;
      }
      case "horizontalRule":
        blockType = "divider";
        blockContent = { type: "horizontalRule" };
        break;
      default:
        blockType = "paragraph";
        blockContent = { type: "paragraph", text: getText(node) };
    }

    blocks.push({ id, pageId, parentBlockId: null, type: blockType, content: blockContent, position: position++ });
  }

  return blocks;
}

export function Editor({ page, initialBlocks }: Props) {
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [title, setTitle] = useState(page.title);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageId = page.id;

  const announceContextRefresh = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent("context-weaver:refresh", {
        detail: { pageId },
      })
    );
  }, [pageId]);

  const saveBlocks = useCallback(
    async (doc: Record<string, unknown>) => {
      setSaveState("saving");
      const blocks = tiptapDocToBlocks(doc, pageId);
      try {
        const res = await fetch(`/api/pages/${pageId}/blocks`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blocks }),
        });
        if (!res.ok) throw new Error("Save failed");
        setSaveState("saved");
        announceContextRefresh();
        setTimeout(() => setSaveState("idle"), 2000);
      } catch {
        setSaveState("error");
        setTimeout(() => setSaveState("idle"), 2000);
      }
    },
    [announceContextRefresh, pageId]
  );

  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: false }),
      Typography,
      SlashCommand,
    ],
    content: blocksToTiptapContent(initialBlocks),
    onUpdate({ editor }) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        saveBlocks(editor.getJSON() as Record<string, unknown>);
      }, 500);
    },
    editorProps: {
      attributes: {
        class: "outline-none min-h-[60vh] prose prose-gray max-w-none",
      },
    },
  });

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  async function saveTitle(newTitle: string) {
    const res = await fetch(`/api/pages/${pageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle }),
    });
    if (res.ok) announceContextRefresh();
  }

  return (
    <div className="max-w-3xl mx-auto px-8 py-12">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <span className="text-3xl">{page.icon ?? "📄"}</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => saveTitle(title)}
            className="text-3xl font-bold text-gray-900 outline-none bg-transparent w-full"
            placeholder="Untitled"
          />
        </div>
        <div className="text-xs text-gray-400 shrink-0 ml-4">
          {saveState === "saving" && "Saving..."}
          {saveState === "saved" && "Saved"}
          {saveState === "error" && "Save failed"}
        </div>
      </div>

      {editor && (
        <DragHandle editor={editor}>
          <div className="text-gray-300 hover:text-gray-500 cursor-grab px-1">⠿</div>
        </DragHandle>
      )}

      <EditorContent editor={editor} />
    </div>
  );
}
