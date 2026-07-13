export interface PageRow {
  id: string;
  title: string;
  icon: string | null;
  position: number;
  workspaceId: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PageWithChildren extends PageRow {
  children: PageWithChildren[];
}

export interface BlockRow {
  id: string;
  pageId: string;
  parentBlockId: string | null;
  type: string;
  content: Record<string, unknown>;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export type BlockType =
  | "paragraph"
  | "heading_1"
  | "heading_2"
  | "heading_3"
  | "bulleted_list_item"
  | "numbered_list_item"
  | "to_do"
  | "toggle"
  | "divider";
