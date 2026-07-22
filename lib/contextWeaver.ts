import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ApprovedRelationCard,
  ContextWeaverPayload,
  PageKind,
  RelatedPageSummary,
  SuggestionCard,
} from "@/lib/types";

const STOP_WORDS = new Set([
  "and",
  "about",
  "after",
  "also",
  "been",
  "being",
  "from",
  "have",
  "into",
  "just",
  "like",
  "more",
  "notes",
  "page",
  "that",
  "the",
  "them",
  "then",
  "they",
  "this",
  "with",
  "your",
]);

const SCAN_TARGETS: Record<PageKind, PageKind[]> = {
  GENERAL: [],
  MEETING: ["ROADMAP", "TASK", "FEEDBACK"],
  ROADMAP: ["MEETING", "FEEDBACK", "TASK"],
  TASK: ["ROADMAP", "MEETING", "FEEDBACK"],
  FEEDBACK: ["ROADMAP", "TASK", "MEETING"],
};

const KIND_BONUS: Record<PageKind, Partial<Record<PageKind, number>>> = {
  GENERAL: {},
  MEETING: {
    ROADMAP: 0.18,
    TASK: 0.15,
    FEEDBACK: 0.12,
  },
  ROADMAP: {
    MEETING: 0.14,
    TASK: 0.14,
    FEEDBACK: 0.16,
  },
  TASK: {
    ROADMAP: 0.17,
    MEETING: 0.1,
    FEEDBACK: 0.1,
  },
  FEEDBACK: {
    ROADMAP: 0.18,
    TASK: 0.16,
    MEETING: 0.1,
  },
};

const MIN_SCORE = 0.22;

type PageWithBlocks = Prisma.PageGetPayload<{
  include: {
    blocks: {
      select: {
        content: true;
      };
    };
  };
}>;

function flattenTextContent(value: unknown, key?: string): string[] {
  if (typeof value === "string") {
    return key === "text" ? [value] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenTextContent(item));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([entryKey, entryValue]) =>
      flattenTextContent(entryValue, entryKey)
    );
  }
  return [];
}

function normalizeToken(token: string) {
  return token.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function tokenize(text: string) {
  return Array.from(
    new Set(
      text
        .split(/\s+/)
        .map(normalizeToken)
        .filter((token) => token.length > 2 && !STOP_WORDS.has(token))
    )
  );
}

function buildPageText(page: PageWithBlocks) {
  const blockText = page.blocks
    .flatMap((block) => flattenTextContent(block.content))
    .join(" ");
  return `${page.title} ${blockText}`.trim();
}

function sharedTerms(a: string[], b: string[]) {
  const bSet = new Set(b);
  return a.filter((term) => bSet.has(term));
}

function titleCoverage(sourceTokens: string[], targetTitleTokens: string[]) {
  if (targetTitleTokens.length === 0) return 0;
  const sourceSet = new Set(sourceTokens);
  const hits = targetTitleTokens.filter((token) => sourceSet.has(token)).length;
  return hits / targetTitleTokens.length;
}

function summarizeRationale(targetTitle: string, overlappingTerms: string[]) {
  const topTerms = overlappingTerms.slice(0, 4).join(", ");
  return topTerms
    ? `Matched "${targetTitle}" on ${topTerms}.`
    : `Matched "${targetTitle}" on related page language.`;
}

function scoreCandidate(source: PageWithBlocks, target: PageWithBlocks) {
  const sourceText = buildPageText(source);
  const targetText = buildPageText(target);
  const sourceTokens = tokenize(sourceText);
  const targetTokens = tokenize(targetText);
  const overlappingTerms = sharedTerms(sourceTokens, targetTokens);

  if (overlappingTerms.length < 2) {
    return null;
  }

  const overlapRatio =
    overlappingTerms.length / Math.max(2, Math.min(sourceTokens.length, targetTokens.length));
  const targetTitleTokens = tokenize(target.title);
  const sourceTitleTokens = tokenize(source.title);
  const titleMatch =
    titleCoverage(sourceTokens, targetTitleTokens) * 0.65 +
    titleCoverage(targetTokens, sourceTitleTokens) * 0.35;
  const kindBonus = KIND_BONUS[source.kind]?.[target.kind] ?? 0;
  const score = overlapRatio * 0.62 + titleMatch * 0.22 + kindBonus;

  if (score < MIN_SCORE) {
    return null;
  }

  return {
    confidence: Number(score.toFixed(2)),
    rationale: summarizeRationale(target.title, overlappingTerms),
  };
}

function toRelatedPageSummary(page: {
  id: string;
  title: string;
  icon: string | null;
  kind: PageKind;
}): RelatedPageSummary {
  return {
    id: page.id,
    title: page.title,
    icon: page.icon,
    kind: page.kind,
  };
}

export async function refreshContextSuggestionsForPage(pageId: string, client = prisma) {
  const source = await client.page.findUnique({
    where: { id: pageId },
    include: {
      blocks: {
        select: {
          content: true,
        },
      },
    },
  });

  if (!source) return;

  const candidateKinds = SCAN_TARGETS[source.kind];
  if (candidateKinds.length === 0) {
    await client.relationSuggestion.deleteMany({
      where: {
        sourcePageId: pageId,
        status: "PENDING",
      },
    });
    return;
  }

  const [candidates, approvedRelations] = await Promise.all([
    client.page.findMany({
      where: {
        workspaceId: source.workspaceId,
        id: { not: pageId },
        kind: { in: candidateKinds },
      },
      include: {
        blocks: {
          select: {
            content: true,
          },
        },
      },
    }),
    client.pageRelation.findMany({
      where: {
        sourcePageId: pageId,
      },
      select: {
        targetPageId: true,
      },
    }),
  ]);

  const approvedTargetIds = new Set(approvedRelations.map((relation) => relation.targetPageId));
  const scored = candidates
    .filter((candidate) => !approvedTargetIds.has(candidate.id))
    .map((candidate) => ({
      candidate,
      score: scoreCandidate(source, candidate),
    }))
    .filter((entry): entry is { candidate: PageWithBlocks; score: { confidence: number; rationale: string } } => Boolean(entry.score));

  const pendingTargetIds = scored.map((entry) => entry.candidate.id);

  await client.$transaction([
    client.relationSuggestion.deleteMany({
      where: {
        sourcePageId: pageId,
        status: "PENDING",
        ...(pendingTargetIds.length > 0
          ? { targetPageId: { notIn: pendingTargetIds } }
          : {}),
      },
    }),
    ...scored.map(({ candidate, score }) =>
      client.relationSuggestion.upsert({
        where: {
          sourcePageId_targetPageId: {
            sourcePageId: pageId,
            targetPageId: candidate.id,
          },
        },
        update: {
          confidence: score.confidence,
          rationale: score.rationale,
          status: "PENDING",
        },
        create: {
          sourcePageId: pageId,
          targetPageId: candidate.id,
          confidence: score.confidence,
          rationale: score.rationale,
          status: "PENDING",
        },
      })
    ),
  ]);
}

export async function getContextWeaverPayload(pageId: string, client = prisma): Promise<ContextWeaverPayload> {
  const [suggestions, relations] = await Promise.all([
    client.relationSuggestion.findMany({
      where: {
        sourcePageId: pageId,
        status: "PENDING",
      },
      include: {
        targetPage: true,
      },
      orderBy: [{ confidence: "desc" }, { updatedAt: "desc" }],
    }),
    client.pageRelation.findMany({
      where: {
        OR: [{ sourcePageId: pageId }, { targetPageId: pageId }],
      },
      include: {
        sourcePage: true,
        targetPage: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
  ]);

  const suggestionCards: SuggestionCard[] = suggestions.map((suggestion) => ({
    id: suggestion.id,
    confidence: suggestion.confidence,
    rationale: suggestion.rationale,
    relatedPage: toRelatedPageSummary(suggestion.targetPage),
  }));

  const relationCards: ApprovedRelationCard[] = relations.map((relation) => {
    const isOutgoing = relation.sourcePageId === pageId;
    return {
      id: relation.id,
      confidence: relation.confidence,
      rationale: relation.rationale,
      relationType: relation.relationType,
      direction: isOutgoing ? "outgoing" : "incoming",
      relatedPage: toRelatedPageSummary(isOutgoing ? relation.targetPage : relation.sourcePage),
    };
  });

  return {
    suggestions: suggestionCards,
    relations: relationCards,
  };
}
