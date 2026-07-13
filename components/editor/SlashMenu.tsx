import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { Editor } from "@tiptap/react";

export interface SlashMenuItem {
  title: string;
  description: string;
  icon: string;
  command: (editor: Editor) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEditor = any;

export const SLASH_MENU_ITEMS: SlashMenuItem[] = [
  {
    title: "Paragraph",
    description: "Plain text",
    icon: "¶",
    command: (editor: AnyEditor) => editor.chain().focus().setParagraph().run(),
  },
  {
    title: "Heading 1",
    description: "Large heading",
    icon: "H1",
    command: (editor: AnyEditor) => editor.chain().focus().setHeading({ level: 1 }).run(),
  },
  {
    title: "Heading 2",
    description: "Medium heading",
    icon: "H2",
    command: (editor: AnyEditor) => editor.chain().focus().setHeading({ level: 2 }).run(),
  },
  {
    title: "Heading 3",
    description: "Small heading",
    icon: "H3",
    command: (editor: AnyEditor) => editor.chain().focus().setHeading({ level: 3 }).run(),
  },
  {
    title: "Bullet List",
    description: "Unordered list",
    icon: "•",
    command: (editor: AnyEditor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    title: "Numbered List",
    description: "Ordered list",
    icon: "1.",
    command: (editor: AnyEditor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    title: "To-do",
    description: "Checkbox task",
    icon: "☐",
    command: (editor: AnyEditor) => editor.chain().focus().toggleTaskList().run(),
  },
  {
    title: "Divider",
    description: "Horizontal rule",
    icon: "—",
    command: (editor: AnyEditor) => editor.chain().focus().setHorizontalRule().run(),
  },
];

interface Props {
  editor: Editor;
  items: SlashMenuItem[];
  command: (item: SlashMenuItem) => void;
}

export interface SlashMenuHandle {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

export const SlashMenu = forwardRef<SlashMenuHandle, Props>(
  ({ editor: _editor, items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useImperativeHandle(ref, () => ({
      onKeyDown({ key }: KeyboardEvent) {
        if (key === "ArrowUp") {
          setSelectedIndex((i) => (i - 1 + items.length) % items.length);
          return true;
        }
        if (key === "ArrowDown") {
          setSelectedIndex((i) => (i + 1) % items.length);
          return true;
        }
        if (key === "Enter") {
          command(items[selectedIndex]);
          return true;
        }
        return false;
      },
    }));

    useEffect(() => setSelectedIndex(0), [items]);

    return (
      <div className="z-50 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden w-64">
        {items.length === 0 ? (
          <div className="px-4 py-3 text-sm text-gray-400">No results</div>
        ) : (
          items.map((item, index) => (
            <button
              key={item.title}
              onClick={() => command(item)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 ${
                index === selectedIndex ? "bg-gray-100" : ""
              }`}
            >
              <span className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded text-sm font-mono shrink-0">
                {item.icon}
              </span>
              <div>
                <div className="text-sm font-medium text-gray-800">{item.title}</div>
                <div className="text-xs text-gray-400">{item.description}</div>
              </div>
            </button>
          ))
        )}
      </div>
    );
  }
);

SlashMenu.displayName = "SlashMenu";
