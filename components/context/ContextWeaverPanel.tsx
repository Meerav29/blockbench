"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ApprovedRelationCard,
  ContextWeaverPayload,
  PageKind,
  SuggestionCard,
} from "@/lib/types";

const PAGE_KIND_OPTIONS: { value: PageKind; label: string }[] = [
  { value: "GENERAL", label: "General doc" },
  { value: "MEETING", label: "Meeting note" },
  { value: "ROADMAP", label: "Roadmap item" },
  { value: "TASK", label: "Task" },
  { value: "FEEDBACK", label: "User feedback" },
];

const TARGET_COPY: Record<PageKind, string> = {
  GENERAL: "General docs are not scanned yet. Pick a PM-specific page type to enable linking.",
  MEETING: "Meeting notes scan against roadmap items, tasks, and feedback pages.",
  ROADMAP: "Roadmap items scan against meetings, feedback, and tasks.",
  TASK: "Tasks scan against roadmap items, meetings, and feedback.",
  FEEDBACK: "Feedback pages scan against roadmap items, tasks, and meetings.",
};

function confidenceLabel(confidence: number) {
  if (confidence >= 0.6) return "High";
  if (confidence >= 0.4) return "Medium";
  return "Low";
}

interface Props {
  pageId: string;
  currentKind: PageKind;
  initialData: ContextWeaverPayload;
}

export function ContextWeaverPanel({ pageId, currentKind, initialData }: Props) {
  const [kind, setKind] = useState<PageKind>(currentKind);
  const [suggestions, setSuggestions] = useState<SuggestionCard[]>(initialData.suggestions);
  const [relations, setRelations] = useState<ApprovedRelationCard[]>(initialData.relations);
  const [busy, setBusy] = useState(false);

  function applyPayload(payload: ContextWeaverPayload) {
    setSuggestions(payload.suggestions);
    setRelations(payload.relations);
  }

  const loadContext = useCallback(async (method: "GET" | "POST" = "GET") => {
    setBusy(true);
    try {
      const res = await fetch(`/api/pages/${pageId}/context`, { method });
      if (!res.ok) throw new Error("Context load failed");
      const payload = (await res.json()) as ContextWeaverPayload;
      applyPayload(payload);
    } finally {
      setBusy(false);
    }
  }, [pageId]);

  async function updateKind(nextKind: PageKind) {
    setKind(nextKind);
    setBusy(true);
    try {
      const res = await fetch(`/api/pages/${pageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: nextKind }),
      });
      if (!res.ok) throw new Error("Kind update failed");
      await loadContext("POST");
    } finally {
      setBusy(false);
    }
  }

  async function resolveSuggestion(suggestionId: string, action: "approve" | "dismiss") {
    setBusy(true);
    try {
      const res = await fetch(`/api/pages/${pageId}/suggestions/${suggestionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error("Suggestion update failed");
      const payload = (await res.json()) as ContextWeaverPayload;
      applyPayload(payload);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    function handleRefresh(event: Event) {
      const detail = (event as CustomEvent<{ pageId?: string }>).detail;
      if (!detail || detail.pageId !== pageId) return;
      void loadContext();
    }

    window.addEventListener("context-weaver:refresh", handleRefresh);
    return () => window.removeEventListener("context-weaver:refresh", handleRefresh);
  }, [loadContext, pageId]);

  return (
    <aside className="w-80 shrink-0 border-l border-gray-200 bg-stone-50/70">
      <div className="h-screen overflow-y-auto px-4 py-5">
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                Context Weaver
              </div>
              <h2 className="mt-1 text-lg font-semibold text-stone-900">
                Automated Relation Engine
              </h2>
            </div>
            <button
              onClick={() => void loadContext("POST")}
              disabled={busy}
              className="rounded-full border border-stone-200 px-3 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
            >
              Re-run scan
            </button>
          </div>

          <div className="mt-4">
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-stone-500">
              Source Database
            </label>
            <select
              value={kind}
              onChange={(event) => void updateKind(event.target.value as PageKind)}
              className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 outline-none"
            >
              {PAGE_KIND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-sm leading-5 text-stone-500">{TARGET_COPY[kind]}</p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-stone-100 px-3 py-3">
              <div className="text-xs uppercase tracking-[0.16em] text-stone-500">Pending Links</div>
              <div className="mt-1 text-2xl font-semibold text-stone-900">{suggestions.length}</div>
            </div>
            <div className="rounded-2xl bg-stone-100 px-3 py-3">
              <div className="text-xs uppercase tracking-[0.16em] text-stone-500">Approved Links</div>
              <div className="mt-1 text-2xl font-semibold text-stone-900">{relations.length}</div>
            </div>
          </div>
        </div>

        <section className="mt-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-stone-900">Suggested Context</h3>
            {busy ? <span className="text-xs text-stone-400">Syncing...</span> : null}
          </div>

          <div className="mt-3 space-y-3">
            {suggestions.length === 0 ? (
              <p className="text-sm leading-5 text-stone-500">
                No suggestions yet. Save or classify the page to trigger a new scan.
              </p>
            ) : (
              suggestions.map((suggestion) => (
                <div key={suggestion.id} className="rounded-2xl border border-stone-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-[0.16em] text-stone-500">
                        {suggestion.relatedPage.kind}
                      </div>
                      <Link
                        href={`/${suggestion.relatedPage.id}`}
                        className="mt-1 block text-sm font-semibold text-stone-900 hover:text-stone-700"
                      >
                        {suggestion.relatedPage.icon ?? "📄"} {suggestion.relatedPage.title}
                      </Link>
                    </div>
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-800">
                      {confidenceLabel(suggestion.confidence)} {Math.round(suggestion.confidence * 100)}%
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-5 text-stone-600">{suggestion.rationale}</p>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => void resolveSuggestion(suggestion.id, "approve")}
                      disabled={busy}
                      className="rounded-full bg-stone-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-800 disabled:opacity-50"
                    >
                      Approve link
                    </button>
                    <button
                      onClick={() => void resolveSuggestion(suggestion.id, "dismiss")}
                      disabled={busy}
                      className="rounded-full border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-stone-900">Approved Links</h3>
          <div className="mt-3 space-y-3">
            {relations.length === 0 ? (
              <p className="text-sm leading-5 text-stone-500">
                Approved links will appear here as your lightweight knowledge graph.
              </p>
            ) : (
              relations.map((relation) => (
                <div key={relation.id} className="rounded-2xl border border-stone-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-[0.16em] text-stone-500">
                        {relation.direction === "outgoing" ? "Linked to" : "Linked from"}
                      </div>
                      <Link
                        href={`/${relation.relatedPage.id}`}
                        className="mt-1 block text-sm font-semibold text-stone-900 hover:text-stone-700"
                      >
                        {relation.relatedPage.icon ?? "📄"} {relation.relatedPage.title}
                      </Link>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-medium text-emerald-800">
                      {Math.round(relation.confidence * 100)}%
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-5 text-stone-600">{relation.rationale}</p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </aside>
  );
}
