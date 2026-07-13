import { Extension } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion from "@tiptap/suggestion";
import { ReactRenderer, ReactRendererOptions } from "@tiptap/react";
import tippy, { Instance as TippyInstance } from "tippy.js";
import { SlashMenu, SlashMenuHandle, SLASH_MENU_ITEMS, SlashMenuItem } from "../SlashMenu";
import "tippy.js/dist/tippy.css";

export const SlashCommand = Extension.create({
  name: "slashCommand",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        pluginKey: new PluginKey("slashCommand"),
        startOfLine: false,

        items({ query }: { query: string }) {
          return SLASH_MENU_ITEMS.filter((item) =>
            item.title.toLowerCase().includes(query.toLowerCase())
          );
        },

        render() {
          let component: ReactRenderer<SlashMenuHandle>;
          let popup: TippyInstance[];

          return {
            onStart(props: { editor: unknown; clientRect?: (() => DOMRect | null) | null; items: SlashMenuItem[]; command: (item: SlashMenuItem) => void }) {
              component = new ReactRenderer(SlashMenu, {
                props,
                editor: props.editor as ReactRendererOptions["editor"],
              });

              popup = tippy("body", {
                getReferenceClientRect: props.clientRect as () => DOMRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: "manual",
                placement: "bottom-start",
              });
            },

            onUpdate(props: { clientRect?: (() => DOMRect | null) | null; items: SlashMenuItem[]; command: (item: SlashMenuItem) => void }) {
              component.updateProps(props);
              popup[0].setProps({
                getReferenceClientRect: props.clientRect as () => DOMRect,
              });
            },

            onKeyDown(props: { event: KeyboardEvent }) {
              if (props.event.key === "Escape") {
                popup[0].hide();
                return true;
              }
              return component.ref?.onKeyDown(props.event) ?? false;
            },

            onExit() {
              popup[0].destroy();
              component.destroy();
            },
          };
        },

        command({ editor, range, props }: { editor: unknown; range: { from: number; to: number }; props: SlashMenuItem }) {
          const tiptapEditor = editor as import("@tiptap/react").Editor;
          tiptapEditor.chain().focus().deleteRange(range).run();
          props.command(tiptapEditor);
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
