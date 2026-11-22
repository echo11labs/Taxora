"use client";

import "@fontsource-variable/instrument-sans";
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  Filter,
  Search,
  Shuffle,
} from "lucide-react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuthStatus } from "@/components/auth-provider";
import { BackgroundBeams } from "@/components/ui/background-beams";
import { SphereAnimation } from "@/components/sphere-animation";
import { VoiceWaveVisualizer } from "@/components/ui/voice-wave-visualizer";
import {
  type ChatSession,
  createNewSession,
  generateSessionTitle,
  getChatSessionLimit,
  limitSessions,
  loadActiveSessionId,
  loadStoredSessions,
  saveActiveSessionId,
  saveStoredSessions,
  summarizeSession,
} from "@/lib/chat-sessions";
import {
  type ChatThoughtProcess,
  findMockTaxAnswer,
  getMockKnowledgeBase,
  type MockQAPair,
  type ResponseLanguage,
  shuffleArray,
} from "@/lib/mock-tax-chat";
import {
  isFinanceLegislation,
  usePublishedDocuments,
  type PublishedDocument,
} from "@/lib/published-documents";
import {
  RESEARCH_SECTIONS,
  type ResearchSourceItem,
} from "@/lib/research-catalog";
import { TAX_LIBRARY_DOCUMENTS } from "@/lib/tax-law-catalog";
import type { TaxQAEntry } from "@/lib/tax-repository";
import { generateId } from "@/lib/utils";
import ChatAttachments, { type ChatAttachment } from "./chat-attachments";
import ChatBackdrop from "./chat-backdrop";
import ChatComposer from "./chat-composer";
import ChatResponse, { type ChatMessage } from "./chat-response";
import {
  AmendmentTrackerIcon,
  DirectivesIcon,
  RegulatoryUpdatesIcon,
  TaxAssistantIcon,
} from "./custom-icons";
import styles from "./dashboard.module.css";

const assistant = {
  id: "tax-assistant",
  name: "CA Ora",
  icon: TaxAssistantIcon,
};

const researchIcons: Record<string, typeof DirectivesIcon> = {
  directives: DirectivesIcon,
  amendments: AmendmentTrackerIcon,
  "regulatory-updates": RegulatoryUpdatesIcon,
};

function getPublishedResearchItem(
  document: PublishedDocument,
  sectionId: string,
): ResearchSourceItem | undefined {
  const { documentType, title, fiscalYear } = document;
  const amendment =
    (documentType === "Act" ||
      documentType === "Rule" ||
      documentType === "Rajpatra") &&
    (isFinanceLegislation(title) ||
      /\bamend(?:ment|ing)s?\b|संशोधन/iu.test(title));
  let category: string;
  if (sectionId === "amendments" && amendment) {
    category = `FY ${fiscalYear}`;
  } else if (
    sectionId === "directives" &&
    (documentType === "Directive" ||
      documentType === "Circular" ||
      documentType === "Rule" ||
      documentType === "Advisory Note")
  ) {
    category =
      documentType === "Rule" ? "Rules & Compliance" : "Published Guidance";
  } else if (
    sectionId === "regulatory-updates" &&
    (documentType === "Rajpatra" || documentType === "Precedent")
  ) {
    category = "Statutory Texts";
  } else {
    return undefined;
  }

  return {
    title,
    shortTitle: title,
    subTitle: `FY ${fiscalYear}`,
    category,
    authority: document.issuingAuthority,
    tag: documentType,
    provisions: document.summary ?? "",
    sourceLabel:
      document.mimeType === "application/pdf" ? "View PDF" : "Open document",
    sourceUrl: document.fileUrl,
    fileName: document.fileName,
  };
}

function renderFormattedUserMessage(text: string) {
  const parts = text.split(/(@[a-zA-Z0-9_\u0900-\u097F]+)/g);
  return parts.map((part, index) => {
    if (!part) return null;
    if (part.startsWith("@")) {
      return (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: Mention tag position in parsed message
          key={`mention-${index}-${part}`}
          className={styles.userMentionTag}
        >
          {part}
        </span>
      );
    }
    return (
      // biome-ignore lint/suspicious/noArrayIndexKey: Text fragment position in parsed message
      <span key={`text-${index}-${part}`}>{part}</span>
    );
  });
}

const CONTRIBUTE_HOVER_PROMPTS = [
  "Are you CA?",
  "Share your tax expertise",
  "Upload circulars & PDFs",
  "Join the verified CA circle →",
];

export default function Dashboard() {
  const [current, setCurrent] = useState(assistant.id);
  const [collapsed, setCollapsed] = useState(false);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [composerVersion, setComposerVersion] = useState(0);
  const [sectionFilter, setSectionFilter] = useState("All");
  const [sectionSearch, setSectionSearch] = useState("");
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [isSphereHovered, setIsSphereHovered] = useState(false);
  const [spherePromptIndex, setSpherePromptIndex] = useState(0);

  // Multi-session state management (1 guest session; +2 after sign-in up to 3)
  const { isSignedIn, clerkConfigured } = useAuthStatus();
  const sessionLimit = getChatSessionLimit(isSignedIn, clerkConfigured);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [guestLimitOpen, setGuestLimitOpen] = useState(false);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [waitlistReason, setWaitlistReason] = useState<
    "limit_reached" | "direct"
  >("direct");
  const [waitlistPassCode, setWaitlistPassCode] = useState<string | null>(null);

  useEffect(() => {
    if (isSignedIn) {
      setGuestLimitOpen(false);
    }
  }, [isSignedIn]);

  const [responseLang, setResponseLang] = useState<ResponseLanguage>("en");
  const [starterQuestions, setStarterQuestions] = useState<MockQAPair[]>(() =>
    getMockKnowledgeBase("en").slice(0, 4),
  );

  const thinkingTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const activeIntervals = useRef<ReturnType<typeof setInterval>[]>([]);
  const composer = useRef<HTMLTextAreaElement>(null);
  const messageEnd = useRef<HTMLDivElement>(null);
  const focusComposer = useRef(false);
  const activeRequestRef = useRef<string | null>(null);
  const section = RESEARCH_SECTIONS.find(({ id }) => id === current);
  const { documents: publishedDocuments, managedCatalog } =
    usePublishedDocuments(Boolean(section));
  const SectionIcon = section ? researchIcons[section.id] : undefined;
  const resourceItems = section
    ? [
        ...publishedDocuments.flatMap((document) => {
          const curated = section.items.find(
            (item) =>
              item.title === document.title &&
              (item.sourceUrl === document.fileUrl ||
                item.fileName === document.fileName),
          );
          if (curated) {
            return managedCatalog
              ? [
                  {
                    ...curated,
                    sourceUrl: document.fileUrl,
                    authority: document.issuingAuthority,
                    provisions: document.summary ?? "",
                  },
                ]
              : [];
          }
          const isCuratedElsewhere = RESEARCH_SECTIONS.some((candidate) =>
            candidate.items.some(
              (item) =>
                item.title === document.title &&
                (item.sourceUrl === document.fileUrl ||
                  item.fileName === document.fileName),
            ),
          );
          const isBundledSource =
            TAX_LIBRARY_DOCUMENTS.some(
              (item) =>
                item.title === document.title &&
                (item.sourceUrl === document.fileUrl ||
                  item.authorityDomain === document.fileName),
            ) ||
            (!managedCatalog &&
              section.items.some(
                (item) => item.sourceUrl === document.fileUrl,
              ));
          if (isCuratedElsewhere || isBundledSource) return [];
          const item = getPublishedResearchItem(document, section.id);
          return item ? [item] : [];
        }),
        ...(managedCatalog ? [] : section.items),
      ]
    : [];
  const resourceCategories = section
    ? [
        ...new Set([
          ...section.categories,
          ...resourceItems.map((item) => item.category),
        ]),
      ]
    : [];

  const activeSession =
    sessions.find((s) => s.id === activeSessionId) ?? sessions[0] ?? null;
  const messages = activeSession?.messages ?? [];
  const chatStartedAt = activeSession?.createdAt
    ? new Date(activeSession.createdAt)
    : null;

  useEffect(() => {
    if (!isSphereHovered) {
      setSpherePromptIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setSpherePromptIndex(
        (prev) => (prev + 1) % CONTRIBUTE_HOVER_PROMPTS.length,
      );
    }, 1800);

    return () => clearInterval(interval);
  }, [isSphereHovered]);

  // Hydrate sessions from localStorage on client mount & handle ?session=<id>
  useEffect(() => {
    const stored = loadStoredSessions();
    setSessions(stored);

    const params = new URLSearchParams(window.location.search);
    const sessionParam = params.get("session");
    const storedActive = loadActiveSessionId();

    const targetId =
      (sessionParam &&
        stored.some((s) => s.id === sessionParam) &&
        sessionParam) ||
      (storedActive &&
        stored.some((s) => s.id === storedActive) &&
        storedActive) ||
      stored[0]?.id ||
      "";

    if (targetId) {
      setActiveSessionId(targetId);
    }
  }, []);

  useEffect(() => {
    if (messages.length === 0) {
      setStarterQuestions(
        shuffleArray(getMockKnowledgeBase(responseLang)).slice(0, 4),
      );
    }
  }, [responseLang, messages.length]);

  useEffect(() => {
    return () => {
      for (const timer of thinkingTimers.current) clearTimeout(timer);
      for (const interval of activeIntervals.current) clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const query = params.get("q");
    if (query) {
      setDraft(query);
      if (!window.matchMedia("(max-width: 899px)").matches) {
        focusComposer.current = true;
      }
    }

    const rawPass = params.get("pass")?.trim().toUpperCase();
    if (rawPass && /^TXR-L1-[A-Z0-9]{4,10}$/.test(rawPass)) {
      setWaitlistPassCode(rawPass);
      setWaitlistReason("direct");
      setWaitlistOpen(true);
      navigator.clipboard?.writeText(rawPass).catch(() => {});
      params.delete("pass");
      const nextSearch = params.toString();
      const cleanedUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`;
      window.history.replaceState({}, "", cleanedUrl);
    }
  }, []);

  useEffect(() => {
    function syncSection() {
      const destination = window.location.hash.slice(1);
      if (destination === "main") return;
      const knownSection = RESEARCH_SECTIONS.find(
        ({ id }) => id === destination,
      );
      setCurrent(knownSection?.id ?? assistant.id);
      setSectionFilter(knownSection?.categories[0] ?? "All");
      setSectionSearch("");
    }

    syncSection();
    window.addEventListener("hashchange", syncSection);
    return () => window.removeEventListener("hashchange", syncSection);
  }, []);

  useEffect(() => {
    if (!section && focusComposer.current) {
      composer.current?.focus();
      focusComposer.current = false;
    }
  });

  useEffect(() => {
    if (messages.length > 0 && !section) {
      messageEnd.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [messages, section]);

  function formatChatStartTime(date: Date): string {
    const datePart = new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    }).format(date);
    const timePart = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
    return `${datePart} • ${timePart}`;
  }

  function clearActiveIntervals() {
    activeRequestRef.current = null;
    for (const timer of thinkingTimers.current) clearTimeout(timer);
    thinkingTimers.current = [];
    for (const interval of activeIntervals.current) clearInterval(interval);
    activeIntervals.current = [];
  }

  function openSessionLimitPrompt() {
    if (clerkConfigured && !isSignedIn) {
      setGuestLimitOpen(true);
    } else {
      setWaitlistReason("limit_reached");
      setWaitlistOpen(true);
    }
  }

  function newChat() {
    clearActiveIntervals();

    // Guests get 1 session and are prompted to sign in for 2 more (3 total)
    if (sessions.length >= sessionLimit) {
      openSessionLimitPrompt();
      return;
    }

    const newSession = createNewSession();
    const nextSessions = limitSessions([newSession, ...sessions]);
    setSessions(nextSessions);
    setActiveSessionId(newSession.id);
    saveActiveSessionId(newSession.id);
    saveStoredSessions(nextSessions);
    window.history.replaceState(null, "", `/?session=${newSession.id}`);

    setDraft("");
    setAttachments([]);
    setIsVoiceActive(false);
    setVoiceLevel(0);
    setStarterQuestions(
      shuffleArray(getMockKnowledgeBase(responseLang)).slice(0, 4),
    );
    if (!window.matchMedia("(max-width: 899px)").matches) {
      focusComposer.current = true;
    }
    setComposerVersion((value) => value + 1);
    if (section) window.location.hash = assistant.id;
  }

  function selectSession(id: string) {
    clearActiveIntervals();
    setActiveSessionId(id);
    saveActiveSessionId(id);
    window.history.replaceState(null, "", `/?session=${id}`);
    setDraft("");
    setAttachments([]);
    setIsVoiceActive(false);
    setVoiceLevel(0);
    if (!window.matchMedia("(max-width: 899px)").matches) {
      focusComposer.current = true;
    }
    if (section) window.location.hash = assistant.id;
  }

  function handleRenameSession(id: string, newTitle: string) {
    setSessions((prev) => {
      const updated = prev.map((s) =>
        s.id === id
          ? { ...s, title: newTitle, updatedAt: new Date().toISOString() }
          : s,
      );
      saveStoredSessions(updated);
      return updated;
    });
  }

  function handleDeleteSession(id: string) {
    if (id === activeSessionId) {
      clearActiveIntervals();
    }

    setSessions((prev) => {
      const remaining = prev.filter((s) => s.id !== id);
      if (remaining.length === 0) {
        setActiveSessionId("");
        saveActiveSessionId(null);
        saveStoredSessions([]);
        window.history.replaceState(null, "", "/");
        return [];
      }

      if (id === activeSessionId) {
        const nextActive = remaining[0].id;
        setActiveSessionId(nextActive);
        saveActiveSessionId(nextActive);
        window.history.replaceState(null, "", `/?session=${nextActive}`);
      }

      saveStoredSessions(remaining);
      return remaining;
    });
  }

  function handleDeleteAndRestart() {
    const targetId = activeSession?.id ?? sessions[0]?.id;
    if (targetId) {
      handleDeleteSession(targetId);
    }
    setGuestLimitOpen(false);
    setDraft("");
    setAttachments([]);
    setIsVoiceActive(false);
    setVoiceLevel(0);
    if (!window.matchMedia("(max-width: 899px)").matches) {
      focusComposer.current = true;
    }
    setComposerVersion((value) => value + 1);
    if (section) window.location.hash = assistant.id;
  }

  function handleSendMessage(
    messageText: string,
    currentAttachments: ChatAttachment[] = [],
  ) {
    const text = messageText.trim();
    if (!text) return;

    const currentMessages = activeSession?.messages ?? [];

    // Prevent re-entrant submissions while live thinking or streaming
    if (currentMessages.some((m) => m.isLiveThinking || m.isStreaming)) {
      return;
    }

    // Parse language directives via @ mentions (e.g. @nepali)
    const hasNepaliTag =
      /@nepali\b/i.test(text) ||
      /@नेपाली\b/.test(text) ||
      text.toLowerCase().includes("@nepali");
    const hasEnglishTag =
      /@english\b/i.test(text) || text.toLowerCase().includes("@english");

    let effectiveLang: ResponseLanguage = responseLang;
    if (hasNepaliTag) {
      effectiveLang = "np";
      setResponseLang("np");
    } else if (hasEnglishTag) {
      effectiveLang = "en";
      setResponseLang("en");
    }

    const cleanQuery = text
      .replace(/@nepali\b/gi, "")
      .replace(/@नेपाली\b/g, "")
      .replace(/@english\b/gi, "")
      .trim();

    // Determine session title if this is the first message or if title is default
    let updatedTitle = activeSession?.title;
    if (
      !updatedTitle ||
      currentMessages.length === 0 ||
      updatedTitle === "New Research Session"
    ) {
      updatedTitle = generateSessionTitle(cleanQuery || text, effectiveLang);
    }

    const userMessage: ChatMessage = {
      id: generateId(),
      sender: "user",
      text,
      attachments: currentAttachments,
      timestamp: "Just now",
    };

    setDraft("");
    setAttachments([]);
    setIsVoiceActive(false);
    setVoiceLevel(0);
    if (!window.matchMedia("(max-width: 899px)").matches) {
      composer.current?.focus();
    }

    clearActiveIntervals();

    const requestStartMs = performance.now();
    const localMatchStartMs = performance.now();

    // Match against the verified Nepal tax legal Q&A topics
    const initialMatched = findMockTaxAnswer(cleanQuery || text, effectiveLang);
    const matched: MockQAPair = { ...initialMatched };
    const localMatchElapsedSec = Number(
      ((performance.now() - localMatchStartMs) / 1000).toFixed(2),
    );

    const rawSteps = matched.thoughtProcess?.steps || [
      `Dispatched tax intelligence query for ${matched.shortTopic}.`,
      `Cross-referenced Income Tax Act, VAT directives, and Rajpatra schedules.`,
      `Synthesized verified statutory compliance response.`,
    ];
    const steps = [...rawSteps];
    const stepCount = steps.length;

    const initialThoughtProcess: ChatThoughtProcess = {
      duration: "0.0 seconds",
      summary:
        matched.thoughtProcess?.summary ||
        `Evaluated statutory provisions and IRD circulars on ${matched.shortTopic}.`,
      steps,
    };

    const assistantId = generateId();
    const assistantMessage: ChatMessage = {
      id: assistantId,
      sender: "assistant",
      text: "",
      resources: matched.resources,
      followUps: shuffleArray(matched.followUps),
      timestamp: "Just now",
      responseType: matched.responseType,
      thoughtProcess: initialThoughtProcess,
      researchAudit: matched.researchAudit,
      taskList: matched.taskList,
      rateTable: matched.rateTable,
      contributor: matched.contributor,
      isLiveThinking: true,
      activeStepIndex: 0,
      stepDurations: [],
      currentStepElapsed: 0,
      totalElapsed: 0,
      isStreaming: false,
      thoughtCollapsed: false,
    };

    let targetSessionId = activeSession?.id ?? activeSessionId;
    let createdSession: ChatSession | null = null;
    if (!activeSession || !sessions.some((s) => s.id === targetSessionId)) {
      if (sessions.length >= sessionLimit) {
        openSessionLimitPrompt();
        return;
      }
      createdSession = createNewSession(
        updatedTitle || "New Research Session",
        effectiveLang,
      );
      targetSessionId = createdSession.id;
      setActiveSessionId(targetSessionId);
      saveActiveSessionId(targetSessionId);
      window.history.replaceState(null, "", `/?session=${targetSessionId}`);
    }

    // Append userMessage and assistantMessage to the individual session (capped to 3)
    setSessions((prev) => {
      const exists = prev.some((s) => s.id === targetSessionId);
      const updated = exists
        ? prev.map((s) =>
            s.id === targetSessionId
              ? {
                  ...s,
                  title: updatedTitle ?? s.title,
                  updatedAt: new Date().toISOString(),
                  messages: [...s.messages, userMessage, assistantMessage],
                }
              : s,
          )
        : limitSessions([
            {
              ...(createdSession ??
                createNewSession(
                  updatedTitle || "New Research Session",
                  effectiveLang,
                )),
              id: targetSessionId,
              title: updatedTitle || "New Research Session",
              updatedAt: new Date().toISOString(),
              responseLang: effectiveLang,
              messages: [userMessage, assistantMessage],
            },
            ...prev,
          ]);
      saveStoredSessions(updated);
      return updated;
    });

    const searchStepIndex = stepCount > 1 ? 1 : 0;
    const recordedStepDurations: number[] =
      searchStepIndex > 0 ? [localMatchElapsedSec] : [];
    let currentStep = searchStepIndex;
    let currentStepStartMs = performance.now();

    const thinkingInterval = setInterval(() => {
      const now = performance.now();
      const totalElapsedSec = Number(
        ((now - requestStartMs) / 1000).toFixed(1),
      );
      const stepElapsedSec = Number(
        ((now - currentStepStartMs) / 1000).toFixed(1),
      );

      setSessions((prev) =>
        prev.map((s) =>
          s.id === targetSessionId
            ? {
                ...s,
                messages: s.messages.map((msg) =>
                  msg.id === assistantId
                    ? {
                        ...msg,
                        activeStepIndex: currentStep,
                        currentStepElapsed: stepElapsedSec,
                        totalElapsed: totalElapsedSec,
                        stepDurations: [...recordedStepDurations],
                      }
                    : msg,
                ),
              }
            : s,
        ),
      );
    }, 50);

    activeIntervals.current.push(thinkingInterval);

    let usedPublishedSearch = false;
    const startResponseStreaming = () => {
      clearInterval(thinkingInterval);
      const totalElapsedSec = Number(
        ((performance.now() - requestStartMs) / 1000).toFixed(1),
      );
      const durationLabel =
        totalElapsedSec < 0.1
          ? "< 0.1 seconds"
          : totalElapsedSec === 1
            ? "1.0 second"
            : `${totalElapsedSec.toFixed(1)} seconds`;

      setSessions((prev) =>
        prev.map((s) =>
          s.id === targetSessionId
            ? {
                ...s,
                messages: s.messages.map((msg) =>
                  msg.id === assistantId
                    ? {
                        ...msg,
                        resources: matched.resources,
                        contributor: matched.contributor,
                        rateTable: matched.rateTable,
                        ...(usedPublishedSearch && {
                          followUps: [],
                          researchAudit: undefined,
                          taskList: undefined,
                          responseType: undefined,
                        }),
                        isLiveThinking: false,
                        thoughtCollapsed: true,
                        thoughtProcess: {
                          ...(usedPublishedSearch
                            ? {
                                summary: "Searched published Q&A.",
                                steps: [],
                              }
                            : initialThoughtProcess),
                          duration: durationLabel,
                        },
                        stepDurations: [...recordedStepDurations],
                        totalElapsed: totalElapsedSec,
                        isStreaming: true,
                      }
                    : msg,
                ),
              }
            : s,
        ),
      );

      const words = matched.answer.split(" ");
      let wordIndex = 0;
      const wordsPerTick = 2;

      const streamInterval = setInterval(() => {
        wordIndex = Math.min(words.length, wordIndex + wordsPerTick);
        const currentChunk = words.slice(0, wordIndex).join(" ");

        if (wordIndex >= words.length) {
          clearInterval(streamInterval);
          setSessions((prev) => {
            const finalSessions = prev.map((s) =>
              s.id === targetSessionId
                ? {
                    ...s,
                    updatedAt: new Date().toISOString(),
                    messages: s.messages.map((msg) =>
                      msg.id === assistantId
                        ? {
                            ...msg,
                            text: matched.answer,
                            isStreaming: false,
                          }
                        : msg,
                    ),
                  }
                : s,
            );
            saveStoredSessions(finalSessions);
            return finalSessions;
          });
        } else {
          setSessions((prev) =>
            prev.map((s) =>
              s.id === targetSessionId
                ? {
                    ...s,
                    messages: s.messages.map((msg) =>
                      msg.id === assistantId
                        ? {
                            ...msg,
                            text: currentChunk,
                            isStreaming: true,
                          }
                        : msg,
                    ),
                  }
                : s,
            ),
          );
        }
      }, 25);

      activeIntervals.current.push(streamInterval);
    };

    const requestId = generateId();
    activeRequestRef.current = requestId;

    const query = (cleanQuery || text).trim();
    // Check dynamic repository for verified CA entries in real time
    fetch("/api/qa/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, lang: effectiveLang }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (activeRequestRef.current !== requestId) return;
        const results: TaxQAEntry[] = data?.results ?? [];
        // The repository also returns broad keyword matches. Require an exact
        // question or topic when the local matcher found no tax context.
        const normalize = (value: string) =>
          value
            .toLowerCase()
            .trim()
            .replace(/[?.!]+$/u, "")
            .replace(/\s+/gu, " ");
        const normalizedQuery = normalize(query);
        const exactMatch = results.find((entry) =>
          [entry.question, entry.shortTopic].some(
            (value) => normalize(value) === normalizedQuery,
          ),
        );
        const exactBundledMatch =
          matched.id !== "out-of-scope-query" &&
          [matched.question, matched.shortTopic].some(
            (value) => normalize(value) === normalizedQuery,
          );
        const topMatch =
          exactMatch ??
          (matched.id !== "out-of-scope-query" && !exactBundledMatch
            ? results[0]
            : undefined);
        if (!topMatch?.answer) return;

        usedPublishedSearch = true;
        matched.answer = topMatch.answer;
        matched.contributor =
          topMatch.contributor && !topMatch.isAnonymous
            ? {
                fullName: topMatch.contributor.fullName,
                icanNumber: topMatch.contributor.icanNumber,
                firmName: topMatch.contributor.firmName,
                isVerifiedCa: topMatch.contributor.isVerifiedCa,
              }
            : undefined;
        matched.resources = (topMatch.citations ?? [])
          .filter(
            (citation) =>
              typeof citation?.title === "string" &&
              typeof citation.citation === "string",
          )
          .map((citation) => ({
            title: citation.title,
            citation: citation.citation,
            authority: citation.authority,
            externalUrl: citation.url,
            libraryId: citation.libraryId,
          }));
        matched.rateTable = topMatch.rateTable;
      })
      .catch(() => {
        // Fallback silently to initial matched answer
      })
      .finally(() => {
        if (activeRequestRef.current !== requestId) return;
        const searchElapsedSec = Number(
          ((performance.now() - currentStepStartMs) / 1000).toFixed(2),
        );
        recordedStepDurations.push(searchElapsedSec);

        // Measure remaining synthesis steps with real wall-clock timestamps
        for (let idx = searchStepIndex + 1; idx < stepCount; idx++) {
          currentStep = idx;
          const stepStart = performance.now();
          currentStepStartMs = stepStart;
          const stepElapsed = Number(
            ((performance.now() - stepStart) / 1000).toFixed(2),
          );
          recordedStepDurations.push(stepElapsed);
        }

        startResponseStreaming();
      });
  }

  function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    handleSendMessage(draft, attachments);
  }

  function backToAssistant() {
    window.location.hash = assistant.id;
  }

  return (
    <div className={styles.shell} data-collapsed={collapsed}>
      <a className={styles.skipLink} href="#main">
        Skip to main content
      </a>

      {/* Shared Canonical App Sidebar with Multi-Session Management */}
      <AppSidebar
        current={current}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        onNewChat={newChat}
        sessions={sessions.map(summarizeSession)}
        activeSessionId={activeSession?.id ?? activeSessionId}
        onSelectSession={selectSession}
        onDeleteSession={handleDeleteSession}
        onRenameSession={handleRenameSession}
        waitlistOpen={waitlistOpen}
        waitlistReason={waitlistReason}
        waitlistPassCode={waitlistPassCode}
        onOpenWaitlist={(reason = "direct") => {
          setWaitlistReason(reason);
          setWaitlistOpen(true);
        }}
        onCloseWaitlist={() => setWaitlistOpen(false)}
        guestLimitOpen={guestLimitOpen}
        onOpenGuestLimit={() => setGuestLimitOpen(true)}
        onCloseGuestLimit={() => setGuestLimitOpen(false)}
        onDeleteAndRestart={handleDeleteAndRestart}
        onNavigate={(id) => {
          if (
            id === "tax-law-library" ||
            id === "about" ||
            id === "review-queue"
          ) {
            return;
          }
          setCurrent(id);
          const nextSection = RESEARCH_SECTIONS.find((s) => s.id === id);
          if (nextSection) {
            setSectionFilter(nextSection.categories[0] ?? "All");
            setSectionSearch("");
          }
          if (id === "tax-assistant") {
            window.location.hash = assistant.id;
          }
        }}
      />

      <main className={styles.main} id="main" tabIndex={-1}>
        {/* Top-right animated sphere for Contribute Knowledge (96px square, no borders) */}
        <Link
          href="/contribute"
          className={styles.contributeSphereTopRight}
          data-in-chat={Boolean(section) || messages.length > 0}
          onMouseEnter={() => setIsSphereHovered(true)}
          onMouseLeave={() => setIsSphereHovered(false)}
          onFocus={() => setIsSphereHovered(true)}
          onBlur={() => setIsSphereHovered(false)}
          title="Contribute Knowledge - Nepal CA Portal"
          aria-label="Contribute Knowledge - Nepal CA Portal"
        >
          <AnimatePresence>
            {isSphereHovered && (
              <motion.div
                initial={{ opacity: 0, x: 16, scale: 0.94 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 12, scale: 0.94 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className={styles.hoverPromptBadge}
              >
                <span className={styles.pulseDot} aria-hidden="true" />
                <div className={styles.promptTextTrack}>
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={spherePromptIndex}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                    >
                      {CONTRIBUTE_HOVER_PROMPTS[spherePromptIndex]}
                    </motion.span>
                  </AnimatePresence>
                </div>
                <ArrowRight
                  size={12}
                  className={styles.promptArrow}
                  aria-hidden="true"
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div className={styles.sphereWrapper}>
            <SphereAnimation size={96} />
          </div>
        </Link>
        <AnimatePresence>
          {!section && !isVoiceActive && messages.length === 0 && (
            <motion.div
              key="ambient-beams"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
                zIndex: 0,
                overflow: "hidden",
              }}
            >
              <BackgroundBeams className={styles.mainBeams} />
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {isVoiceActive && !section && messages.length === 0 && (
            <VoiceWaveVisualizer voiceLevel={voiceLevel} />
          )}
        </AnimatePresence>
        {section && SectionIcon ? (
          <section
            className={styles.resource}
            aria-labelledby="workspace-title"
          >
            <div className={styles.resourceHeader}>
              <button
                type="button"
                className={styles.backButton}
                onClick={backToAssistant}
                aria-label="Back to CA Ora"
              >
                <ArrowLeft aria-hidden="true" />
                <span>Back to CA Ora</span>
              </button>
              <div className={styles.resourceTitleGroup}>
                <SectionIcon
                  className={styles.resourceBadgeIcon}
                  aria-hidden="true"
                />
                <div>
                  <h1 id="workspace-title">{section.name}</h1>
                  <p>{section.description}</p>
                </div>
              </div>
            </div>

            <div className={styles.resourceToolbar}>
              <div className={styles.searchBar}>
                <Search aria-hidden="true" />
                <input
                  type="search"
                  placeholder={section.searchPlaceholder}
                  value={sectionSearch}
                  onChange={(e) => setSectionSearch(e.target.value)}
                  aria-label={`Search in ${section.name}`}
                />
              </div>

              <div
                className={styles.filterPills}
                role="tablist"
                aria-label="Categories"
              >
                {resourceCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    role="tab"
                    aria-selected={sectionFilter === cat}
                    className={styles.filterPill}
                    onClick={() => setSectionFilter(cat)}
                  >
                    <Filter aria-hidden="true" className={styles.filterIcon} />
                    <span>{cat}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.resourceGrid}>
              {resourceItems
                .filter((item) => {
                  const isAllCategory =
                    sectionFilter === "All" ||
                    sectionFilter === section.categories[0];
                  const matchesCat =
                    isAllCategory || item.category === sectionFilter;
                  const q = sectionSearch.trim().toLowerCase();
                  const matchesQuery =
                    !q ||
                    item.title.toLowerCase().includes(q) ||
                    item.subTitle.toLowerCase().includes(q) ||
                    item.provisions.toLowerCase().includes(q) ||
                    item.authority.toLowerCase().includes(q) ||
                    item.tag.toLowerCase().includes(q) ||
                    item.fileName.toLowerCase().includes(q);
                  return matchesCat && matchesQuery;
                })
                .map((item) => (
                  <article
                    key={`${item.sourceUrl}-${item.title}`}
                    className={styles.resourceCard}
                  >
                    <div className={styles.cardHeader}>
                      <span className={styles.cardTag}>{item.tag}</span>
                      {item.status && (
                        <span className={styles.cardStatus}>
                          <span
                            className={styles.cardStatusDot}
                            aria-hidden="true"
                          />
                          {item.status}
                        </span>
                      )}
                    </div>
                    <h2 className={styles.cardTitle}>{item.title}</h2>
                    <p className={styles.cardSubTitle}>{item.subTitle}</p>
                    {item.provisions && (
                      <p className={styles.cardProvisions}>{item.provisions}</p>
                    )}
                    <div className={styles.cardFooter}>
                      <p className={styles.cardAuthority}>{item.authority}</p>
                      <div className={styles.cardActions}>
                        <a
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.cardAction}
                        >
                          <FileText aria-hidden="true" />
                          <span>{item.sourceLabel ?? "View PDF"}</span>
                        </a>
                        <button
                          type="button"
                          className={`${styles.cardAction} ${styles.cardAskAction}`}
                          onClick={() => {
                            setDraft(
                              `Tell me about ${item.title} and its key tax provisions.`,
                            );
                            window.location.hash = assistant.id;
                          }}
                        >
                          <span>Ask CA Ora</span>
                          <ArrowRight aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
            </div>

            <div className={styles.resourceFooterNote}>
              <p className={styles.resourceFooterText}>
                Every item shown above opens directly from verified statutory,
                procedural, or regulatory source files stored in the repository.
              </p>
            </div>
          </section>
        ) : (
          <section
            className={styles.chat}
            data-empty-chat={messages.length === 0}
            aria-label="CA Ora Chat"
          >
            {messages.length === 0 ? (
              <div className={styles.intro}>
                <div className={styles.wordmarkFrame}>
                  <ChatBackdrop
                    isVoiceActive={isVoiceActive}
                    voiceLevel={voiceLevel}
                  />
                </div>

                <div className={styles.starterQuestionsGroup}>
                  <div className={styles.starterQuestionsHeader}>
                    <span className={styles.starterQuestionsLabel}>
                      Explore Legal Intelligence Scenarios
                    </span>
                    <button
                      type="button"
                      className={styles.starterShuffleBtn}
                      onClick={() =>
                        setStarterQuestions(
                          shuffleArray(
                            getMockKnowledgeBase(responseLang),
                          ).slice(0, 4),
                        )
                      }
                      aria-label="Shuffle questions randomly"
                      title="Shuffle questions"
                    >
                      <Shuffle size={13} aria-hidden="true" />
                      <span className={styles.starterShuffleText}>
                        Shuffle questions
                      </span>
                    </button>
                  </div>
                  <div className={styles.starterChipsGrid}>
                    {starterQuestions.map((q) => (
                      <button
                        key={q.id}
                        type="button"
                        className={styles.starterChip}
                        onClick={() => handleSendMessage(q.question)}
                      >
                        <span>{q.shortTopic}</span>
                        <span className={styles.starterChipTopic}>
                          {q.category} →
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className={styles.conversation}>
                <div className={styles.conversationHeader}>
                  <time
                    className={styles.conversationStartTime}
                    dateTime={(chatStartedAt || new Date(0)).toISOString()}
                    suppressHydrationWarning
                  >
                    {chatStartedAt ? formatChatStartTime(chatStartedAt) : ""}
                  </time>
                </div>

                <ol
                  aria-label="Conversation"
                  className={styles.messageListWrapper}
                >
                  {messages.map((msg) => (
                    <li
                      key={msg.id}
                      className={
                        msg.sender === "user"
                          ? styles.userMessage
                          : styles.assistantMessage
                      }
                      data-sender={msg.sender}
                    >
                      {msg.sender === "user" ? (
                        <>
                          <p className={styles.userMessageText}>
                            {renderFormattedUserMessage(msg.text)}
                          </p>
                          {msg.attachments && (
                            <ChatAttachments attachments={msg.attachments} />
                          )}
                        </>
                      ) : (
                        <ChatResponse
                          message={msg}
                          onFollowUpClick={handleSendMessage}
                        />
                      )}
                    </li>
                  ))}
                </ol>

                <div ref={messageEnd} aria-hidden="true" />
              </div>
            )}

            <div className={styles.composeArea}>
              {messages.length === 0 && (
                <div
                  className={styles.composePromptHeader}
                  data-voice-active={isVoiceActive}
                >
                  <h1 className={styles.composeTitle}>
                    What would you like to research?
                  </h1>
                  <p className={styles.composeSubtitle}>
                    Ask CA Ora about Nepal’s tax laws, official guidance, or
                    amendments.
                  </p>
                </div>
              )}
              <ChatComposer
                key={composerVersion}
                value={draft}
                textareaRef={composer}
                attachments={attachments}
                hasMessages={messages.length > 0}
                onChange={setDraft}
                onAdd={(selection) =>
                  setAttachments((previous) => [...previous, ...selection])
                }
                onRemove={(id) =>
                  setAttachments((previous) =>
                    previous.filter((attachment) => attachment.id !== id),
                  )
                }
                onSubmit={submitMessage}
                onOpenWaitlist={() => {
                  setWaitlistReason("direct");
                  setWaitlistOpen(true);
                }}
                onVoiceChange={(isActive, level, audioBlob) => {
                  setIsVoiceActive(isActive);
                  setVoiceLevel(level);
                  if (audioBlob) {
                    const voiceFile = new File(
                      [audioBlob],
                      `voice-note-${Date.now()}.webm`,
                      {
                        type: audioBlob.type || "audio/webm",
                      },
                    );
                    setAttachments((prev) => [
                      ...prev,
                      {
                        id: generateId(),
                        file: voiceFile,
                        kind: "file",
                      },
                    ]);
                  }
                }}
              />
              <p className={styles.notice}>
                Questions and attachments stay in this browser session.
              </p>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
