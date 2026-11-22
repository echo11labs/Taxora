import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  MOCK_TAX_KNOWLEDGE_BASE_EN,
  MOCK_TAX_KNOWLEDGE_BASE_NP,
  type MockQAPair,
  type QaCategory,
} from "./mock-tax-chat";
import { generateId } from "./utils";

export interface TaxContributor {
  id?: string;
  clerkUserId?: string;
  fullName: string;
  icanNumber?: string;
  firmName?: string;
  email: string;
  bio?: string;
  linkedinUrl?: string;
  isVerifiedCa: boolean;
}

export interface TaxCitation {
  title: string;
  citation: string;
  authority: string;
  url?: string;
  libraryId?: string;
}

export interface TaxQAEntry {
  id: string;
  question: string;
  shortTopic: string;
  category: QaCategory;
  fiscalYear: string;
  language: "en" | "np";
  keywords: string[];
  answer: string;
  citations: TaxCitation[];
  reasoningSteps: string[];
  rateTable?: MockQAPair["rateTable"];
  taskList?: MockQAPair["taskList"];
  researchAudit?: MockQAPair["researchAudit"];
  contributor?: TaxContributor;
  isAnonymous: boolean;
  status: "verified" | "pending_review" | "rejected";
  helpfulCount: number;
  createdAt: string;
}

export interface TaxDocument {
  id: string;
  title: string;
  documentType:
    | "Directive"
    | "Circular"
    | "Act"
    | "Rule"
    | "Rajpatra"
    | "Precedent"
    | "Advisory Note";
  issuingAuthority: string;
  fiscalYear: string;
  fileUrl: string;
  storagePath: string;
  fileSizeBytes: number;
  fileName: string;
  mimeType: string;
  summary?: string;
  contributor?: TaxContributor;
  isAnonymous: boolean;
  status: "verified" | "pending_review" | "rejected";
  downloadCount: number;
  createdAt: string;
}

export type ReviewSubmission<T extends TaxQAEntry | TaxDocument> = Omit<
  T,
  "contributor"
> & { contributor?: Pick<TaxContributor, "fullName"> };

export interface PendingReviewSubmissions {
  qaEntries: ReviewSubmission<TaxQAEntry>[];
  documents: ReviewSubmission<TaxDocument>[];
}

export type ReviewDecision = "approve" | "decline" | "delete";
type ReviewDecisionResult = "updated" | "not_pending" | "file_cleanup_failed";

export interface TaxKnowledgeRepository {
  searchQA(
    query: string,
    lang?: "en" | "np",
    category?: string,
  ): Promise<TaxQAEntry[]>;
  getQAById(id: string): Promise<TaxQAEntry | null>;
  submitQA(
    entry: Omit<TaxQAEntry, "id" | "status" | "createdAt" | "helpfulCount">,
  ): Promise<TaxQAEntry>;
  listDocuments(filter?: {
    documentType?: string;
    fiscalYear?: string;
    status?: string;
  }): Promise<TaxDocument[]>;
  submitDocument(
    doc: Omit<TaxDocument, "id" | "status" | "createdAt" | "downloadCount">,
  ): Promise<TaxDocument>;
  listPendingSubmissions(): Promise<PendingReviewSubmissions>;
  decideSubmission(
    type: "qa" | "document",
    id: string,
    decision: ReviewDecision,
  ): Promise<ReviewDecisionResult>;
}

// Convert Mock data into standard TaxQAEntry records
function mockToQaEntry(mock: MockQAPair, lang: "en" | "np"): TaxQAEntry {
  return {
    id: mock.id,
    question: mock.question,
    shortTopic: mock.shortTopic,
    category: mock.category,
    fiscalYear: mock.fiscalYear ?? "2081/82",
    language: lang,
    keywords: mock.keywords,
    answer: mock.answer,
    citations: mock.resources.map((r) => ({
      title: r.title,
      citation: r.citation,
      authority: r.authority,
      url: r.externalUrl,
      libraryId: r.libraryId,
    })),
    reasoningSteps: mock.thoughtProcess?.steps ?? [
      `Dispatched tax intelligence query for ${mock.shortTopic}.`,
      "Cross-referenced Income Tax Act, VAT directives, and Rajpatra schedules.",
      "Synthesized statutory compliance response.",
    ],
    rateTable: mock.rateTable,
    taskList: mock.taskList,
    researchAudit: mock.researchAudit,
    isAnonymous: false,
    status: "verified",
    helpfulCount: 42,
    createdAt: new Date("2025-01-10T10:00:00.000Z").toISOString(),
    contributor: {
      fullName: mock.contributor?.fullName ?? "Taxora Editorial Board",
      icanNumber: mock.contributor?.icanNumber,
      firmName:
        mock.contributor?.firmName ?? "Taxora Legal Knowledge Committee",
      email: mock.contributor?.email ?? "editorial@taxora.org",
      isVerifiedCa: mock.contributor?.isVerifiedCa ?? true,
    },
  };
}

function scoreQaCandidates(
  candidates: TaxQAEntry[],
  query: string,
): TaxQAEntry[] {
  const clean = query.trim().toLowerCase();
  if (!clean) return [];

  const tokens = clean
    .split(/[\s,?.!;:()[\]{}'"]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);

  const scored = candidates.map((entry) => {
    let score = 0;
    const q = entry.question.toLowerCase();
    const topic = entry.shortTopic.toLowerCase();
    const ans = entry.answer.toLowerCase();

    if (q.includes(clean) || clean.includes(q)) score += 50;
    if (topic.includes(clean)) score += 30;

    for (const kw of entry.keywords) {
      const kwLower = kw.toLowerCase();
      if (clean.includes(kwLower) || kwLower.includes(clean)) {
        score += kw.length > 3 ? 12 : 5;
      }
    }

    for (const tok of tokens) {
      if (topic.includes(tok)) score += 6;
      if (q.includes(tok)) score += 4;
      if (ans.includes(tok)) score += 2;
      if (entry.keywords.some((kw) => kw.toLowerCase().includes(tok))) {
        score += 8;
      }
    }

    return { entry, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.filter((s) => s.score > 0).map((s) => s.entry);
}

/**
 * Local in-memory repository fallback.
 * Works with zero external services configured.
 */
class LocalTaxRepository implements TaxKnowledgeRepository {
  private qaEntries: TaxQAEntry[] = [];
  private documents: TaxDocument[] = [];

  constructor() {
    // Seed with initial English and Nepali verified Q&As
    for (const item of MOCK_TAX_KNOWLEDGE_BASE_EN) {
      this.qaEntries.push(mockToQaEntry(item, "en"));
    }
    for (const item of MOCK_TAX_KNOWLEDGE_BASE_NP) {
      this.qaEntries.push(mockToQaEntry(item, "np"));
    }

    // Seed initial official reference documents
    this.documents = [
      {
        id: "doc-income-tax-act-2058",
        title: "Income Tax Act, 2058 (2002) — English Consolidation",
        documentType: "Act",
        issuingAuthority: "Nepal Law Commission / Inland Revenue Department",
        fiscalYear: "2081/82",
        fileUrl: "/api/sources/income-tax-act-2058",
        storagePath: "docs/Files/Nepal_inctax.pdf",
        fileSizeBytes: 5925806,
        fileName: "Nepal_inctax.pdf",
        mimeType: "application/pdf",
        summary:
          "Official English consolidation of the Income Tax Act, 2058 governing natural persons, entities, deductions, withholding taxes, assessments, and appeals.",
        isAnonymous: false,
        status: "verified",
        downloadCount: 0,
        createdAt: "2026-11-18T22:25:00.000Z",
        contributor: {
          fullName: "Taxora Editorial Board",
          firmName: "Taxora Legal Knowledge Committee",
          email: "editorial@taxora.org",
          isVerifiedCa: true,
        },
      },
      {
        id: "doc-vat-act-2052",
        title: "Value Added Tax Act, 2052 (1996) — English Consolidation",
        documentType: "Act",
        issuingAuthority: "Nepal Law Commission / Inland Revenue Department",
        fiscalYear: "2081/82",
        fileUrl: "/api/sources/vat-act-2052",
        storagePath: "docs/Files/Nepal_Value.pdf",
        fileSizeBytes: 629230,
        fileName: "Nepal_Value.pdf",
        mimeType: "application/pdf",
        summary:
          "Official English consolidation of the Value Added Tax Act, 2052 establishing VAT registration thresholds, exemptions, credits, and administration.",
        isAnonymous: false,
        status: "verified",
        downloadCount: 0,
        createdAt: "2026-11-18T22:25:00.000Z",
        contributor: {
          fullName: "Taxora Editorial Board",
          firmName: "Taxora Legal Knowledge Committee",
          email: "editorial@taxora.org",
          isVerifiedCa: true,
        },
      },
      {
        id: "doc-finance-bill-2083-pdf",
        title: "Finance Bill, 2083 (Official Scanned PDF)",
        documentType: "Act",
        issuingAuthority:
          "Federal Parliament Secretariat / Ministry of Finance",
        fiscalYear: "2083/84",
        fileUrl: "/api/sources/finance-bill-2083-pdf",
        storagePath: "docs/Files/finance-bill-2083-84-original.pdf",
        fileSizeBytes: 128859962,
        fileName: "finance-bill-2083-84-original.pdf",
        mimeType: "application/pdf",
        summary:
          "Original 461-page scanned official PDF of Finance Bill, 2083 for FY 2083/84.",
        isAnonymous: false,
        status: "verified",
        downloadCount: 0,
        createdAt: "2026-11-18T22:21:00.000Z",
        contributor: {
          fullName: "Taxora Editorial Board",
          firmName: "Taxora Legal Knowledge Committee",
          email: "editorial@taxora.org",
          isVerifiedCa: true,
        },
      },
      {
        id: "doc-companies-act-2063",
        title: "The Companies Act, 2063 (2006)",
        documentType: "Act",
        issuingAuthority: "Nepal Law Commission / Office of Company Registrar",
        fiscalYear: "General",
        fileUrl: "/api/sources/companies-act-2063",
        storagePath: "docs/Files/Nepal_Companies.pdf",
        fileSizeBytes: 745644,
        fileName: "Nepal_Companies.pdf",
        mimeType: "application/pdf",
        summary:
          "English consolidation of The Companies Act, 2063 (198 pages) governing corporate registration, governance, and reporting.",
        isAnonymous: false,
        status: "verified",
        downloadCount: 0,
        createdAt: "2026-11-18T21:26:00.000Z",
        contributor: {
          fullName: "Taxora Editorial Board",
          firmName: "Taxora Legal Knowledge Committee",
          email: "editorial@taxora.org",
          isVerifiedCa: true,
        },
      },
      {
        id: "doc-tds-guide-2058",
        title: "Income Tax Act, 2058 — Tax Deduction at Source (TDS)",
        documentType: "Directive",
        issuingAuthority: "Inland Revenue Department, Lazimpat",
        fiscalYear: "2058+",
        fileUrl: "/api/sources/tds-guide-2058",
        storagePath: "docs/Files/Nepal_TDS.pdf",
        fileSizeBytes: 393994,
        fileName: "Nepal_TDS.pdf",
        mimeType: "application/pdf",
        summary:
          "Official IRD informational booklet covering Tax Deduction at Source rules and procedures under Income Tax Act, 2058.",
        isAnonymous: false,
        status: "verified",
        downloadCount: 0,
        createdAt: "2026-11-18T21:25:00.000Z",
        contributor: {
          fullName: "Taxora Editorial Board",
          firmName: "Taxora Legal Knowledge Committee",
          email: "editorial@taxora.org",
          isVerifiedCa: true,
        },
      },
      {
        id: "doc-aml-rules-2009",
        title: "Asset (Money) Laundering Prevention Rules, 2009",
        documentType: "Directive",
        issuingAuthority: "Government of Nepal",
        fiscalYear: "2009",
        fileUrl: "/api/sources/aml-rules-2009",
        storagePath: "docs/Files/Nepal_AML_Rules_2009_English.pdf",
        fileSizeBytes: 51346,
        fileName: "Nepal_AML_Rules_2009_English.pdf",
        mimeType: "application/pdf",
        summary:
          "English translation of the Asset (Money) Laundering Prevention Rules, 2009 (13 pages).",
        isAnonymous: false,
        status: "verified",
        downloadCount: 0,
        createdAt: "2026-11-18T21:25:00.000Z",
        contributor: {
          fullName: "Taxora Editorial Board",
          firmName: "Taxora Legal Knowledge Committee",
          email: "editorial@taxora.org",
          isVerifiedCa: true,
        },
      },
      {
        id: "doc-development-cooperation-policy-2014",
        title: "Development Cooperation Policy, 2014",
        documentType: "Circular",
        issuingAuthority: "Ministry of Finance, Nepal",
        fiscalYear: "2014",
        fileUrl: "/api/sources/development-cooperation-policy-2014",
        storagePath: "docs/Files/Nepal_DevelcoopNepal.pdf",
        fileSizeBytes: 217380,
        fileName: "Nepal_DevelcoopNepal.pdf",
        mimeType: "application/pdf",
        summary:
          "English translation of Nepal's Development Cooperation Policy, 2014 issued by the Ministry of Finance.",
        isAnonymous: false,
        status: "verified",
        downloadCount: 0,
        createdAt: "2026-11-18T21:27:00.000Z",
        contributor: {
          fullName: "Taxora Editorial Board",
          firmName: "Taxora Legal Knowledge Committee",
          email: "editorial@taxora.org",
          isVerifiedCa: true,
        },
      },
    ];
  }

  async searchQA(
    query: string,
    lang: "en" | "np" = "en",
    category?: string,
  ): Promise<TaxQAEntry[]> {
    const clean = query.trim().toLowerCase();
    const isDevanagari = /[\u0900-\u097F]/.test(query);
    const targetLang = isDevanagari ? "np" : lang;

    // Filter by language and only include verified entries for public search
    let candidates = this.qaEntries.filter(
      (e) => e.status === "verified" && e.language === targetLang,
    );

    if (category && category !== "All") {
      candidates = candidates.filter((e) => e.category === category);
    }

    if (!clean) return candidates.slice(0, 10);

    const matches = scoreQaCandidates(candidates, clean);
    return matches;
  }

  async getQAById(id: string): Promise<TaxQAEntry | null> {
    return this.qaEntries.find((e) => e.id === id) ?? null;
  }

  async submitQA(
    entry: Omit<TaxQAEntry, "id" | "status" | "createdAt" | "helpfulCount">,
  ): Promise<TaxQAEntry> {
    const newEntry: TaxQAEntry = {
      ...entry,
      id: `qa-${generateId()}`,
      status: "pending_review", // Stored for editorial review, not immediately public
      helpfulCount: 0,
      createdAt: new Date().toISOString(),
    };
    this.qaEntries.unshift(newEntry);
    return newEntry;
  }

  async listDocuments(filter?: {
    documentType?: string;
    fiscalYear?: string;
    status?: string;
  }): Promise<TaxDocument[]> {
    let docs = this.documents;
    if (filter?.status && filter.status !== "all") {
      docs = docs.filter((d) => d.status === filter.status);
    } else if (!filter?.status) {
      // By default return verified documents to public
      docs = docs.filter((d) => d.status === "verified");
    }

    if (filter?.documentType && filter.documentType !== "All") {
      docs = docs.filter((d) => d.documentType === filter.documentType);
    }

    if (filter?.fiscalYear && filter.fiscalYear !== "All") {
      docs = docs.filter((d) => d.fiscalYear === filter.fiscalYear);
    }

    return docs;
  }

  async submitDocument(
    doc: Omit<TaxDocument, "id" | "status" | "createdAt" | "downloadCount">,
  ): Promise<TaxDocument> {
    const newDoc: TaxDocument = {
      ...doc,
      id: `doc-${generateId()}`,
      status: "pending_review", // Enters review queue
      downloadCount: 0,
      createdAt: new Date().toISOString(),
    };
    this.documents.unshift(newDoc);
    return newDoc;
  }

  async listPendingSubmissions(): Promise<PendingReviewSubmissions> {
    function pending<T extends TaxQAEntry | TaxDocument>(
      entries: T[],
    ): ReviewSubmission<T>[] {
      return entries
        .filter((entry) => entry.status === "pending_review")
        .map((entry) => ({
          ...entry,
          contributor:
            !entry.isAnonymous && entry.contributor
              ? { fullName: entry.contributor.fullName }
              : undefined,
        }));
    }

    return {
      qaEntries: pending(this.qaEntries),
      documents: pending(this.documents),
    };
  }

  async decideSubmission(
    type: "qa" | "document",
    id: string,
    decision: ReviewDecision,
  ): Promise<ReviewDecisionResult> {
    const entries = type === "qa" ? this.qaEntries : this.documents;
    const index = entries.findIndex(
      (entry) => entry.id === id && entry.status === "pending_review",
    );
    if (index === -1) return "not_pending";

    if (decision === "delete") {
      entries.splice(index, 1);
    } else {
      entries[index].status = decision === "approve" ? "verified" : "rejected";
    }
    return "updated";
  }
}

/**
 * Supabase repository implementation.
 * Connects directly to PostgreSQL tables and Supabase Storage.
 */
class SupabaseTaxRepository implements TaxKnowledgeRepository {
  private client: SupabaseClient;

  constructor(url: string, key: string) {
    this.client = createClient(url, key, {
      auth: { persistSession: false },
    });
  }

  async searchQA(
    query: string,
    lang: "en" | "np" = "en",
    category?: string,
  ): Promise<TaxQAEntry[]> {
    const isDevanagari = /[\u0900-\u097F]/.test(query);
    const targetLang = isDevanagari ? "np" : lang;

    let dbQuery = this.client
      .from("tax_qa_entries")
      .select("*, tax_contributors(*)")
      .eq("status", "verified")
      .eq("language", targetLang);

    if (category && category !== "All") {
      dbQuery = dbQuery.eq("category", category);
    }

    const data = [];
    const pageSize = 200;
    dbQuery = dbQuery.order("id");
    for (let offset = 0; ; offset += pageSize) {
      const { data: page, error } = await dbQuery.range(
        offset,
        offset + pageSize - 1,
      );
      if (error || !page) throw new Error("Unable to load published Q&A.");
      data.push(...page);
      if (page.length < pageSize || !query.trim()) break;
    }

    const mapped: TaxQAEntry[] = data.map((row) => ({
      id: row.id,
      question: row.question,
      shortTopic: row.short_topic,
      category: row.category,
      fiscalYear: row.fiscal_year,
      language: row.language,
      keywords: row.keywords || [],
      answer: row.answer,
      citations: row.citations || [],
      reasoningSteps: row.reasoning_steps || [],
      rateTable: row.rate_table,
      contributor: row.tax_contributors
        ? {
            fullName: row.tax_contributors.full_name,
            icanNumber: row.tax_contributors.ican_number,
            firmName: row.tax_contributors.firm_name,
            email: row.tax_contributors.email,
            bio: row.tax_contributors.bio,
            linkedinUrl: row.tax_contributors.linkedin_url,
            isVerifiedCa: row.tax_contributors.is_verified_ca,
          }
        : undefined,
      isAnonymous: row.is_anonymous,
      status: row.status,
      helpfulCount: row.helpful_count || 0,
      createdAt: row.created_at,
    }));

    if (!query.trim()) {
      return mapped.slice(0, 10);
    }

    return scoreQaCandidates(mapped, query).slice(0, 10);
  }

  private async resolveContributorId(
    contributor: TaxContributor,
  ): Promise<string | undefined> {
    const email = (contributor.email || "").trim().toLowerCase();
    const fullName = (contributor.fullName || "").trim();
    if (!fullName && !email) return undefined;

    const payload = {
      full_name: fullName || "Nepal CA Practitioner",
      ican_number: contributor.icanNumber || null,
      firm_name: contributor.firmName || null,
      email: email || "contributor@taxora.org",
      bio: contributor.bio || null,
      linkedin_url: contributor.linkedinUrl || null,
      clerk_user_id: contributor.clerkUserId || null,
      is_verified_ca: Boolean(contributor.isVerifiedCa),
    };

    const { data: existing } = await this.client
      .from("tax_contributors")
      .select("id")
      .eq("email", payload.email)
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      await this.client
        .from("tax_contributors")
        .update(payload)
        .eq("id", existing.id);
      return existing.id;
    }

    const { data: inserted } = await this.client
      .from("tax_contributors")
      .insert(payload)
      .select("id")
      .single();

    return inserted?.id;
  }

  async getQAById(id: string): Promise<TaxQAEntry | null> {
    const { data } = await this.client
      .from("tax_qa_entries")
      .select("*, tax_contributors(*)")
      .eq("id", id)
      .single();

    if (!data) return null;

    return {
      id: data.id,
      question: data.question,
      shortTopic: data.short_topic,
      category: data.category,
      fiscalYear: data.fiscal_year,
      language: data.language,
      keywords: data.keywords || [],
      answer: data.answer,
      citations: data.citations || [],
      reasoningSteps: data.reasoning_steps || [],
      rateTable: data.rate_table,
      contributor: data.tax_contributors
        ? {
            fullName: data.tax_contributors.full_name,
            icanNumber: data.tax_contributors.ican_number,
            firmName: data.tax_contributors.firm_name,
            email: data.tax_contributors.email,
            isVerifiedCa: data.tax_contributors.is_verified_ca,
          }
        : undefined,
      isAnonymous: data.is_anonymous,
      status: data.status,
      helpfulCount: data.helpful_count || 0,
      createdAt: data.created_at,
    };
  }

  async submitQA(
    entry: Omit<TaxQAEntry, "id" | "status" | "createdAt" | "helpfulCount">,
  ): Promise<TaxQAEntry> {
    let contributorId: string | undefined;

    if (!entry.isAnonymous && entry.contributor) {
      contributorId = await this.resolveContributorId(entry.contributor);
    }

    const { data, error } = await this.client
      .from("tax_qa_entries")
      .insert({
        question: entry.question,
        short_topic: entry.shortTopic,
        category: entry.category,
        fiscal_year: entry.fiscalYear,
        language: entry.language,
        keywords: entry.keywords,
        answer: entry.answer,
        citations: entry.citations,
        reasoning_steps: entry.reasoningSteps,
        rate_table: entry.rateTable,
        contributor_id: contributorId,
        is_anonymous: entry.isAnonymous,
        status: "pending_review",
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to insert QA record: ${error?.message}`);
    }

    return {
      id: data.id,
      question: data.question,
      shortTopic: data.short_topic,
      category: data.category,
      fiscalYear: data.fiscal_year,
      language: data.language,
      keywords: data.keywords || [],
      answer: data.answer,
      citations: data.citations || [],
      reasoningSteps: data.reasoning_steps || [],
      rateTable: data.rate_table,
      contributor: entry.contributor,
      isAnonymous: data.is_anonymous,
      status: data.status,
      helpfulCount: 0,
      createdAt: data.created_at,
    };
  }

  async listDocuments(filter?: {
    documentType?: string;
    fiscalYear?: string;
    status?: string;
  }): Promise<TaxDocument[]> {
    let query = this.client
      .from("tax_documents")
      .select("*, tax_contributors(*)")
      .order("created_at", { ascending: false });

    if (filter?.status && filter.status !== "all") {
      query = query.eq("status", filter.status);
    } else if (!filter?.status) {
      query = query.eq("status", "verified");
    }

    if (filter?.documentType && filter.documentType !== "All") {
      query = query.eq("document_type", filter.documentType);
    }

    if (filter?.fiscalYear && filter.fiscalYear !== "All") {
      query = query.eq("fiscal_year", filter.fiscalYear);
    }

    const { data, error } = await query;
    if (error) throw new Error("Unable to load documents.");

    return (data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      documentType: row.document_type,
      issuingAuthority: row.issuing_authority,
      fiscalYear: row.fiscal_year,
      fileUrl: row.file_url,
      storagePath: row.storage_path,
      fileSizeBytes: Number(row.file_size_bytes || 0),
      fileName: row.file_name,
      mimeType: row.mime_type,
      summary: row.summary,
      contributor: row.tax_contributors
        ? {
            fullName: row.tax_contributors.full_name,
            icanNumber: row.tax_contributors.ican_number,
            firmName: row.tax_contributors.firm_name,
            email: row.tax_contributors.email,
            isVerifiedCa: row.tax_contributors.is_verified_ca,
          }
        : undefined,
      isAnonymous: row.is_anonymous,
      status: row.status,
      downloadCount: row.download_count || 0,
      createdAt: row.created_at,
    }));
  }

  async submitDocument(
    doc: Omit<TaxDocument, "id" | "status" | "createdAt" | "downloadCount">,
  ): Promise<TaxDocument> {
    let contributorId: string | undefined;

    if (!doc.isAnonymous && doc.contributor) {
      contributorId = await this.resolveContributorId(doc.contributor);
    }

    const { data, error } = await this.client
      .from("tax_documents")
      .insert({
        title: doc.title,
        document_type: doc.documentType,
        issuing_authority: doc.issuingAuthority,
        fiscal_year: doc.fiscalYear,
        file_url: doc.fileUrl,
        storage_path: doc.storagePath,
        file_size_bytes: doc.fileSizeBytes,
        file_name: doc.fileName,
        mime_type: doc.mimeType,
        summary: doc.summary,
        contributor_id: contributorId,
        is_anonymous: doc.isAnonymous,
        status: "pending_review",
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to insert document: ${error?.message}`);
    }

    return {
      id: data.id,
      title: data.title,
      documentType: data.document_type,
      issuingAuthority: data.issuing_authority,
      fiscalYear: data.fiscal_year,
      fileUrl: data.file_url,
      storagePath: data.storage_path,
      fileSizeBytes: Number(data.file_size_bytes),
      fileName: data.file_name,
      mimeType: data.mime_type,
      summary: data.summary,
      contributor: doc.contributor,
      isAnonymous: data.is_anonymous,
      status: data.status,
      downloadCount: 0,
      createdAt: data.created_at,
    };
  }

  async listPendingSubmissions(): Promise<PendingReviewSubmissions> {
    const [qa, docs] = await Promise.all([
      this.client
        .from("tax_qa_entries")
        .select("*, tax_contributors(full_name)")
        .eq("status", "pending_review"),
      this.client
        .from("tax_documents")
        .select("*, tax_contributors(full_name)")
        .eq("status", "pending_review"),
    ]);
    if (qa.error || docs.error) {
      throw new Error("Unable to load pending submissions.");
    }

    return {
      qaEntries: (qa.data || []).map((row) => ({
        id: row.id,
        question: row.question,
        shortTopic: row.short_topic,
        category: row.category,
        fiscalYear: row.fiscal_year,
        language: row.language,
        keywords: row.keywords || [],
        answer: row.answer,
        citations: row.citations || [],
        reasoningSteps: row.reasoning_steps || [],
        rateTable: row.rate_table,
        contributor:
          !row.is_anonymous && row.tax_contributors
            ? {
                fullName: row.tax_contributors.full_name,
              }
            : undefined,
        isAnonymous: row.is_anonymous,
        status: row.status,
        helpfulCount: 0,
        createdAt: row.created_at,
      })),
      documents: (docs.data || []).map((row) => ({
        id: row.id,
        title: row.title,
        documentType: row.document_type,
        issuingAuthority: row.issuing_authority,
        fiscalYear: row.fiscal_year,
        fileUrl: row.file_url,
        storagePath: row.storage_path,
        fileSizeBytes: Number(row.file_size_bytes || 0),
        fileName: row.file_name,
        mimeType: row.mime_type,
        summary: row.summary,
        contributor:
          !row.is_anonymous && row.tax_contributors
            ? {
                fullName: row.tax_contributors.full_name,
              }
            : undefined,
        isAnonymous: row.is_anonymous,
        status: row.status,
        downloadCount: 0,
        createdAt: row.created_at,
      })),
    };
  }

  async decideSubmission(
    type: "qa" | "document",
    id: string,
    decision: ReviewDecision,
  ): Promise<ReviewDecisionResult> {
    const table = type === "qa" ? "tax_qa_entries" : "tax_documents";
    if (decision === "delete") {
      const { data, error } = await this.client
        .from(table)
        .delete()
        .eq("id", id)
        .eq("status", "pending_review")
        .select(type === "qa" ? "id" : "id, storage_path")
        .maybeSingle();
      if (error) throw new Error("Unable to delete submission.");
      if (!data) return "not_pending";

      if (
        "storage_path" in data &&
        typeof data.storage_path === "string" &&
        data.storage_path.startsWith("contributed/")
      ) {
        try {
          const { error: storageError } = await this.client.storage
            .from("tax-documents")
            .remove([data.storage_path]);
          if (storageError) return "file_cleanup_failed";
        } catch {
          return "file_cleanup_failed";
        }
      }

      return "updated";
    }

    const status = decision === "approve" ? "verified" : "rejected";
    const { data, error } = await this.client
      .from(table)
      .update(
        type === "qa"
          ? {
              status,
              reviewed_at: new Date().toISOString(),
              reviewed_by: "Taxora Editorial Admin",
            }
          : { status },
      )
      .eq("id", id)
      .eq("status", "pending_review")
      .select("id")
      .maybeSingle();

    if (error) throw new Error("Unable to update submission.");
    return data ? "updated" : "not_pending";
  }
}

// The local repository holds submissions in memory across requests.
let localRepository: LocalTaxRepository | undefined;

export function getSupabaseServerConfig(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY;

  const isPlaceholder =
    !url ||
    !key ||
    url.includes("<your-project-id>") ||
    url.includes("your-project") ||
    key.includes("...");

  if (isPlaceholder) return null;
  return { url, key };
}

export function getTaxRepository(): TaxKnowledgeRepository {
  const config = getSupabaseServerConfig();
  if (config) {
    return new SupabaseTaxRepository(config.url, config.key);
  }

  // A development hot reload can retain an instance of the previous class.
  if (!(localRepository instanceof LocalTaxRepository)) {
    localRepository = new LocalTaxRepository();
  }
  return localRepository;
}
