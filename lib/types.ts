export interface PageRow {
  id: string;
  title: string;
  icon: string | null;
  kind: PageKind;
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

export type PageKind =
  | "GENERAL"
  | "MEETING"
  | "ROADMAP"
  | "TASK"
  | "FEEDBACK";

export interface RelatedPageSummary {
  id: string;
  title: string;
  icon: string | null;
  kind: PageKind;
}

export interface SuggestionCard {
  id: string;
  confidence: number;
  rationale: string;
  relatedPage: RelatedPageSummary;
}

export interface ApprovedRelationCard {
  id: string;
  confidence: number;
  rationale: string;
  relationType: "CONTEXTUAL";
  direction: "incoming" | "outgoing";
  relatedPage: RelatedPageSummary;
}

export interface ContextWeaverPayload {
  suggestions: SuggestionCard[];
  relations: ApprovedRelationCard[];
}
