"use client";

import "@fontsource-variable/instrument-sans";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Calculator,
  CornerDownLeft,
  Link2,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import {
  type ChatSessionSummary,
  loadStoredSessions,
  summarizeSession,
} from "@/lib/chat-sessions";
import {
  isFinanceLegislation,
  usePublishedDocuments,
} from "@/lib/published-documents";
import { RESEARCH_SECTIONS } from "@/lib/research-catalog";
import { type LawDocument, TAX_LIBRARY_DOCUMENTS } from "@/lib/tax-law-catalog";
import styles from "./tax-law-library.module.css";

export type { LawDocument };

const CATEGORIES = [
  "All Documents",
  "Acts",
  "Rules",
  "Finance Acts",
  "Directives",
  "Policies",
] as const;

const libraryCategories: Record<string, LawDocument["category"]> = {
  Act: "Acts",
  Rule: "Rules",
  Directive: "Directives",
  Circular: "Directives",
};

function FluidRibbonArtwork({ variant }: { variant: number }) {
  if (variant === 0) {
    // Warm Amber & Coral Luminous Silk
    return (
      <svg
        className={styles.artworkSvg}
        viewBox="0 0 340 180"
        preserveAspectRatio="none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="coralDarkBg" cx="70%" cy="30%" r="80%">
            <stop offset="0%" stopColor="#2e160e" />
            <stop offset="50%" stopColor="#140a06" />
            <stop offset="100%" stopColor="#080403" />
          </radialGradient>
          <linearGradient id="coralRibbon1" x1="0.1" y1="0" x2="0.9" y2="1">
            <stop offset="0%" stopColor="#ff7a59" />
            <stop offset="45%" stopColor="#ff522b" />
            <stop offset="100%" stopColor="#9e2208" />
          </linearGradient>
          <linearGradient id="coralRibbon2" x1="0" y1="0.2" x2="1" y2="0.8">
            <stop offset="0%" stopColor="#ffab91" stopOpacity="0.85" />
            <stop offset="60%" stopColor="#e64a19" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#5d1607" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#coralDarkBg)" />
        <path
          d="M -30 140 C 40 80, 110 30, 220 25 C 290 20, 340 60, 370 110 L 370 180 L -30 180 Z"
          fill="url(#coralRibbon2)"
        />
        <path
          d="M 20 180 C 100 120, 160 50, 270 40 C 330 35, 360 70, 380 120 L 380 180 Z"
          fill="url(#coralRibbon1)"
        />
        <circle cx="280" cy="50" r="70" fill="#ff522b" opacity="0.15" />
      </svg>
    );
  }
  if (variant === 1) {
    // Taxora Mint & Emerald Resonance
    return (
      <svg
        className={styles.artworkSvg}
        viewBox="0 0 340 180"
        preserveAspectRatio="none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="mintDarkBg" cx="70%" cy="30%" r="80%">
            <stop offset="0%" stopColor="#0d2e20" />
            <stop offset="50%" stopColor="#071710" />
            <stop offset="100%" stopColor="#030c08" />
          </radialGradient>
          <linearGradient id="mintRibbon1" x1="0.1" y1="0" x2="0.9" y2="1">
            <stop offset="0%" stopColor="#00df81" />
            <stop offset="50%" stopColor="#059669" />
            <stop offset="100%" stopColor="#023b2c" />
          </linearGradient>
          <linearGradient id="mintRibbon2" x1="0.1" y1="0.2" x2="1" y2="0.8">
            <stop offset="0%" stopColor="#6ee7b7" stopOpacity="0.85" />
            <stop offset="60%" stopColor="#10b981" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#064e3b" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#mintDarkBg)" />
        <path
          d="M -30 140 C 40 80, 110 30, 220 25 C 290 20, 340 60, 370 110 L 370 180 L -30 180 Z"
          fill="url(#mintRibbon2)"
        />
        <path
          d="M 20 180 C 100 120, 160 50, 270 40 C 330 35, 360 70, 380 120 L 380 180 Z"
          fill="url(#mintRibbon1)"
        />
        <circle cx="280" cy="50" r="70" fill="#00df81" opacity="0.15" />
      </svg>
    );
  }
  if (variant === 2) {
    // Electric Cyan & Royal Azure Silk
    return (
      <svg
        className={styles.artworkSvg}
        viewBox="0 0 340 180"
        preserveAspectRatio="none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="cyanDarkBg" cx="70%" cy="30%" r="80%">
            <stop offset="0%" stopColor="#0e283d" />
            <stop offset="50%" stopColor="#071521" />
            <stop offset="100%" stopColor="#030b12" />
          </radialGradient>
          <linearGradient id="cyanRibbon1" x1="0.2" y1="0" x2="0.8" y2="1">
            <stop offset="0%" stopColor="#00b4d8" />
            <stop offset="60%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
          <linearGradient id="cyanRibbon2" x1="0" y1="0.2" x2="1" y2="0.8">
            <stop offset="0%" stopColor="#7dd3fc" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>
          <filter id="cyanShadow" x="-10%" y="-10%" width="130%" height="130%">
            <feDropShadow
              dx="0"
              dy="8"
              stdDeviation="10"
              floodColor="#0369a1"
              floodOpacity="0.22"
            />
          </filter>
        </defs>
        <rect width="100%" height="100%" fill="url(#cyanDarkBg)" />
        <path
          d="M -30 140 C 40 80, 110 30, 220 25 C 290 20, 340 60, 370 110 L 370 180 L -30 180 Z"
          fill="url(#cyanRibbon2)"
          opacity="0.65"
        />
        <path
          d="M 20 180 C 100 120, 160 50, 270 40 C 330 35, 360 70, 380 120 L 380 180 Z"
          fill="url(#cyanRibbon1)"
          filter="url(#cyanShadow)"
        />
        <path
          d="M 160 180 C 220 130, 280 80, 360 85 L 360 180 Z"
          fill="#bae6fd"
          opacity="0.5"
        />
      </svg>
    );
  }
  // Royal Violet & Amethyst Silk
  return (
    <svg
      className={styles.artworkSvg}
      viewBox="0 0 340 180"
      preserveAspectRatio="none"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="violetDarkBg" cx="70%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#2c1445" />
          <stop offset="50%" stopColor="#140921" />
          <stop offset="100%" stopColor="#09040f" />
        </radialGradient>
        <linearGradient id="violetRibbon1" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#9333ea" />
          <stop offset="60%" stopColor="#7e22ce" />
          <stop offset="100%" stopColor="#581c87" />
        </linearGradient>
        <linearGradient id="violetRibbon2" x1="0" y1="0.2" x2="1" y2="0.8">
          <stop offset="0%" stopColor="#c084fc" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
        <filter id="violetShadow" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow
            dx="0"
            dy="8"
            stdDeviation="10"
            floodColor="#7e22ce"
            floodOpacity="0.22"
          />
        </filter>
      </defs>
      <rect width="100%" height="100%" fill="url(#violetDarkBg)" />
      <path
        d="M -30 140 C 40 80, 110 30, 220 25 C 290 20, 340 60, 370 110 L 370 180 L -30 180 Z"
        fill="url(#violetRibbon2)"
        opacity="0.65"
      />
      <path
        d="M 20 180 C 100 120, 160 50, 270 40 C 330 35, 360 70, 380 120 L 380 180 Z"
        fill="url(#violetRibbon1)"
        filter="url(#violetShadow)"
      />
      <path
        d="M 160 180 C 220 130, 280 80, 360 85 L 360 180 Z"
        fill="#e9d5ff"
        opacity="0.5"
      />
    </svg>
  );
}

export function TaxLawLibrary() {
  const [search, setSearch] = useState("");
  const { documents: publishedDocuments, managedCatalog } =
    usePublishedDocuments();
  const [selectedCategory, setSelectedCategory] =
    useState<string>("All Documents");
  const [collapsed, setCollapsed] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [savedSessions, setSavedSessions] = useState<ChatSessionSummary[]>([]);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSavedSessions(loadStoredSessions().map(summarizeSession));
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsSearchOpen(true);
        searchInputRef.current?.focus();
      } else if (e.key === "Escape" && isSearchOpen) {
        setIsSearchOpen(false);
        searchInputRef.current?.blur();
      }
    }

    function handleClickOutside(e: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setIsSearchOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isSearchOpen]);

  const filteredDocs = useMemo(() => {
    const published = publishedDocuments.flatMap((document): LawDocument[] => {
      const curated = TAX_LIBRARY_DOCUMENTS.find(
        (item) =>
          item.title === document.title &&
          (item.sourceUrl === document.fileUrl ||
            item.authorityDomain === document.fileName),
      );
      if (curated) {
        return managedCatalog
          ? [
              {
                ...curated,
                sourceUrl: document.fileUrl,
                authority: document.issuingAuthority,
                description: document.summary ?? "",
              },
            ]
          : [];
      }
      // Research summaries may share a PDF with a full library source.
      const researchSummary = RESEARCH_SECTIONS.some((section) =>
        section.items.some(
          (item) =>
            item.title === document.title &&
            (item.sourceUrl === document.fileUrl ||
              item.fileName === document.fileName),
        ),
      );
      const isBundledFallback =
        !managedCatalog &&
        TAX_LIBRARY_DOCUMENTS.some(
          (item) =>
            item.sourceUrl === document.fileUrl ||
            item.authorityDomain === document.fileName,
        );
      if (researchSummary || isBundledFallback) return [];

      return [
        {
          id: document.id,
          title: document.title,
          shortTitle: document.title,
          monogram: "",
          category: isFinanceLegislation(document.title)
            ? "Finance Acts"
            : (libraryCategories[document.documentType] ?? "Policies"),
          tag: document.documentType,
          authority: document.issuingAuthority,
          authorityDomain: "",
          sourceUrl: document.fileUrl,
          description: document.summary ?? "",
          sectionsCount: "",
          chaptersCount: "",
          enactmentDate: `FY ${document.fiscalYear}`,
          variant: 1,
        },
      ];
    });

    return [
      ...published,
      ...(managedCatalog ? [] : TAX_LIBRARY_DOCUMENTS),
    ].filter((item) => {
      const matchCategory =
        selectedCategory === "All Documents" ||
        item.category === selectedCategory;

      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.shortTitle.toLowerCase().includes(q) ||
        item.monogram.toLowerCase().includes(q) ||
        item.tag.toLowerCase().includes(q) ||
        item.authority.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.sectionsCount.toLowerCase().includes(q) ||
        item.enactmentDate.toLowerCase().includes(q);

      return matchCategory && matchSearch;
    });
  }, [managedCatalog, publishedDocuments, search, selectedCategory]);

  return (
    <div className={styles.shell} data-collapsed={collapsed}>
      {/* Canonical Shared App Sidebar */}
      <AppSidebar
        current="tax-law-library"
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        sessions={savedSessions}
      />

      {/* Main Library View */}
      <main className={styles.main} id="main-content">
        {/* Ambient Backdrop Blur Overlay when Search is Active */}
        {isSearchOpen && (
          <div className={styles.searchBackdrop} aria-hidden="true" />
        )}

        <div className={styles.contentWrapper} data-search-open={isSearchOpen}>
          <div className={styles.headerGroup}>
            <div className={styles.topBar}>
              <Link href="/" className={styles.backLink}>
                <ArrowLeft aria-hidden="true" />
                <span>Back to Assistant</span>
              </Link>
            </div>

            <div className={styles.titleArea}>
              <h1 className={styles.pageTitle}>Tax Law Library</h1>
              <p className={styles.pageSubtitle}>
                Browse verified Acts, Rules, Finance Acts, and individual legal
                provisions promulgated under Nepal Rajpatra and statutory
                amendments.
              </p>
            </div>

            {/* Search Command Palette Container */}
            <div
              className={styles.searchCommandContainer}
              ref={searchContainerRef}
              data-open={isSearchOpen}
            >
              <div className={styles.searchBar}>
                <Search className={styles.searchIcon} aria-hidden="true" />
                <input
                  ref={searchInputRef}
                  type="search"
                  role="combobox"
                  aria-expanded={isSearchOpen}
                  aria-autocomplete="list"
                  aria-controls="tax-library-search-dropdown"
                  className={styles.searchInput}
                  placeholder="Search provisions, Acts, or years (e.g. Section 88, VAT Act, TDS)…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    if (!isSearchOpen) setIsSearchOpen(true);
                  }}
                  onFocus={() => setIsSearchOpen(true)}
                  aria-label="Search Tax Law Library"
                />
                {search && (
                  <button
                    type="button"
                    className={styles.clearSearchBtn}
                    onClick={() => {
                      setSearch("");
                      searchInputRef.current?.focus();
                    }}
                    aria-label="Clear search"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                )}
                <kbd className={styles.cmdBadge}>
                  <span className={styles.cmdSymbol}>⌘</span>K
                </kbd>
              </div>

              {isSearchOpen && (
                <section
                  id="tax-library-search-dropdown"
                  className={styles.searchDropdown}
                  aria-label="Search recommendations and filters"
                >
                  {/* Section 1: Searching For */}
                  <div className={styles.dropdownSection}>
                    <p className={styles.dropdownHeading}>Searching For</p>
                    <div className={styles.filterChipsRow} role="tablist">
                      {CATEGORIES.map((cat) => {
                        const isActive = selectedCategory === cat;
                        return (
                          <button
                            key={cat}
                            type="button"
                            role="tab"
                            aria-selected={isActive}
                            className={styles.filterChip}
                            data-active={isActive}
                            onClick={() =>
                              setSelectedCategory(
                                isActive && cat !== "All Documents"
                                  ? "All Documents"
                                  : cat,
                              )
                            }
                          >
                            <span>{cat}</span>
                            {isActive && cat !== "All Documents" && (
                              <X
                                className={styles.chipRemoveIcon}
                                size={12}
                                aria-hidden="true"
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Section 2: Recent / Matching Statutes */}
                  <div className={styles.dropdownSection}>
                    <p className={styles.dropdownHeading}>
                      {search
                        ? "Matching Statutes"
                        : "Recent & Primary Statutes"}
                    </p>
                    <div className={styles.resultsList}>
                      {filteredDocs.slice(0, 4).map((doc) => (
                        <button
                          key={doc.id}
                          type="button"
                          className={styles.resultItem}
                          onClick={() => {
                            setSearch(doc.shortTitle);
                            setIsSearchOpen(false);
                          }}
                        >
                          <div className={styles.resultItemLeft}>
                            <div className={styles.resultDetails}>
                              <span className={styles.resultTitle}>
                                {doc.shortTitle}
                              </span>
                              <span className={styles.resultSub}>
                                {doc.authority}
                              </span>
                            </div>
                          </div>
                          <span className={styles.resultCount}>
                            {doc.sectionsCount}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Section 3: Quick Actions */}
                  <div className={styles.dropdownSection}>
                    <p className={styles.dropdownHeading}>Quick Actions</p>
                    <div className={styles.actionsList}>
                      <Link
                        href={`/?q=${encodeURIComponent(
                          "What are the withholding tax (TDS) rates under Section 88 of Income Tax Act 2058?",
                        )}`}
                        className={styles.actionItem}
                        onClick={() => setIsSearchOpen(false)}
                      >
                        <div className={styles.actionItemLeft}>
                          <Sparkles
                            className={styles.actionIcon}
                            size={15}
                            aria-hidden="true"
                          />
                          <span>Research Section 88 TDS Rates</span>
                        </div>
                        <ArrowUpRight
                          className={styles.actionLinkIcon}
                          size={14}
                          aria-hidden="true"
                        />
                      </Link>
                      <Link
                        href={`/?q=${encodeURIComponent(
                          "Explain the 13% standard VAT rate schedule and exemptions under VAT Act 2052.",
                        )}`}
                        className={styles.actionItem}
                        onClick={() => setIsSearchOpen(false)}
                      >
                        <div className={styles.actionItemLeft}>
                          <Calculator
                            className={styles.actionIcon}
                            size={15}
                            aria-hidden="true"
                          />
                          <span>View 13% Standard VAT Schedules</span>
                        </div>
                        <ArrowUpRight
                          className={styles.actionLinkIcon}
                          size={14}
                          aria-hidden="true"
                        />
                      </Link>
                    </div>
                  </div>

                  {/* Section 4: Footer */}
                  <div className={styles.dropdownFooter}>
                    <div className={styles.footerHint}>
                      <span className={styles.footerKbd}>↓ ↑</span>
                      <span>Move</span>
                    </div>
                    <div className={styles.footerHint}>
                      <span className={styles.footerKbd}>
                        <CornerDownLeft size={11} aria-hidden="true" />
                      </span>
                      <span>Select</span>
                    </div>
                    <div className={styles.footerHint}>
                      <span className={styles.footerKbd}>ESC</span>
                      <span>Close</span>
                    </div>
                  </div>
                </section>
              )}
            </div>
          </div>

          {/* Portrait Legal Statute Cards Grid */}
          <div className={styles.grid}>
            {filteredDocs.map((item) => (
              <article
                key={item.id}
                className={styles.foremarkCard}
                data-variant={item.variant}
              >
                {/* 1. Top Display Screen with 3D Silk Artwork */}
                <div className={styles.cardDisplayScreen}>
                  <div className={styles.artworkContainer}>
                    <FluidRibbonArtwork variant={item.variant} />
                  </div>

                  <div className={styles.displayScreenTop}>
                    <span className={styles.categoryTagPill}>{item.tag}</span>
                    <span className={styles.enactmentPill}>
                      {item.enactmentDate}
                    </span>
                  </div>

                  {/* Legal Identity Panel at Base of Screen */}
                  <div className={styles.identityCard}>
                    <div className={styles.identityMain}>
                      <div className={styles.identityText}>
                        <h2 className={styles.cardTitle}>{item.shortTitle}</h2>
                        <span className={styles.authorityLabel}>
                          {item.authority}
                        </span>
                      </div>
                    </div>

                    <Link
                      href={`/?q=${encodeURIComponent(
                        `Tell me about ${item.title} and its key tax provisions.`,
                      )}`}
                      className={styles.researchActionLink}
                      title={`Research ${item.shortTitle} with CA Ora`}
                      aria-label={`Research ${item.shortTitle} with CA Ora`}
                    >
                      <ArrowUpRight
                        className={styles.actionArrow}
                        aria-hidden="true"
                      />
                    </Link>
                  </div>
                </div>

                {/* 2. Bottom Dark Chassis Section */}
                <div className={styles.chassisContent}>
                  {item.description && (
                    <p className={styles.cardBio}>{item.description}</p>
                  )}

                  {(item.sectionsCount || item.chaptersCount) && (
                    <div className={styles.statsRow}>
                      <div className={styles.statItem}>
                        <span className={styles.statValue}>
                          {item.sectionsCount.split(" ")[0]}
                        </span>
                        <span className={styles.statLabel}>
                          {item.sectionsCount.split(" ").slice(1).join(" ")}
                        </span>
                      </div>

                      <div className={styles.statItem}>
                        <span className={styles.statValue}>
                          {item.chaptersCount.split(" ")[0]}
                        </span>
                        <span className={styles.statLabel}>
                          {item.chaptersCount.split(" ").slice(1).join(" ")}
                        </span>
                      </div>
                    </div>
                  )}

                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.authorityLinkRow}
                  >
                    <Link2
                      className={styles.authorityLinkIcon}
                      aria-hidden="true"
                    />
                    <span>Open source document</span>
                  </a>
                </div>
              </article>
            ))}
          </div>

          <footer className={styles.pageFooterNote}>
            <p className={styles.footerNoteText}>
              All documents in this library open directly from verified
              statutory and regulatory source files stored in the repository.
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}
export default TaxLawLibrary;
