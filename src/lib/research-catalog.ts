export interface ResearchSourceItem {
  title: string;
  shortTitle: string;
  subTitle: string;
  category: string;
  authority: string;
  tag: string;
  provisions: string;
  status?: string;
  sourceLabel?: string;
  sourceUrl: string;
  fileName: string;
}

export interface ResearchSection {
  id: string;
  name: string;
  description: string;
  searchPlaceholder: string;
  categories: readonly string[];
  items: readonly ResearchSourceItem[];
}

export const RESEARCH_SECTIONS: readonly ResearchSection[] = [
  {
    id: "directives",
    name: "Directives & Circulars",
    description:
      "Browse verified IRD guidance, subordinate rules, and policy source files stored in the repository.",
    searchPlaceholder: "Search guidance…",
    categories: [
      "All Guidance",
      "Withholding Guidance",
      "Rules & Compliance",
      "Ministry Policies",
    ],
    items: [
      {
        title: "Income Tax Act, 2058 — Tax Deduction at Source (TDS)",
        shortTitle: "TDS Procedural Guide",
        subTitle: "Withholding Agent Reference",
        category: "Withholding Guidance",
        authority: "Inland Revenue Department, Lazimpat",
        tag: "IRD Guidance",
        provisions:
          "Official IRD informational booklet covering TDS rates, withholding thresholds, and deposit obligations under Chapter 17.",
        status: "Verified Source PDF",
        sourceUrl: "/api/sources/tds-guide-2058",
        fileName: "Nepal_TDS.pdf",
      },
      {
        title: "Asset (Money) Laundering Prevention Rules, 2009",
        shortTitle: "AML Prevention Rules",
        subTitle: "Subordinate Regulatory Rules",
        category: "Rules & Compliance",
        authority: "Government of Nepal",
        tag: "Rules",
        provisions:
          "English text of the Asset (Money) Laundering Prevention Rules, 2009 governing customer due diligence and reporting compliance.",
        status: "Verified Source PDF",
        sourceUrl: "/api/sources/aml-rules-2009",
        fileName: "Nepal_AML_Rules_2009_English.pdf",
      },
      {
        title: "Development Cooperation Policy, 2014",
        shortTitle: "Development Cooperation Policy",
        subTitle: "Ministry of Finance Framework",
        category: "Ministry Policies",
        authority: "Ministry of Finance, Nepal",
        tag: "Policy",
        provisions:
          "Official English translation of Nepal's Development Cooperation Policy governing international grants, projects, and tax terms.",
        status: "Verified Source PDF",
        sourceUrl: "/api/sources/development-cooperation-policy-2014",
        fileName: "Nepal_DevelcoopNepal.pdf",
      },
    ],
  },
  {
    id: "amendments",
    name: "Amendment Tracker",
    description:
      "Inspect verified statutory amendments from Finance Bill, 2083 alongside consolidated base Acts.",
    searchPlaceholder:
      "Filter amendments by fiscal year (e.g. 2083/84) or statute…",
    categories: [
      "All Fiscal Years",
      "FY 2083/84 (Finance Bill 2083)",
      "Consolidated Base Acts",
    ],
    items: [
      {
        title: "Finance Bill, 2083 — Income Tax Act, 2058 Amendments (Sec. 57)",
        shortTitle: "Income Tax Amendments 2083",
        subTitle: "APA, International Transactions & VC/PE",
        category: "FY 2083/84 (Finance Bill 2083)",
        authority: "Federal Parliament Secretariat / Ministry of Finance",
        tag: "FY 2083/84 Amendment",
        provisions:
          "Adds international transaction definition (Sec. 2(kha1)), Advance Pricing Agreements (Sec. 33B), VC/PE exemption (Sec. 10(tha1)), and Sec. 95Ka rules.",
        sourceUrl: "/api/sources/finance-bill-2083-pdf",
        fileName: "finance-bill-2083-84-original.pdf",
      },
      {
        title:
          "Finance Bill, 2083 — VAT Act & Excise Duty Act Amendments (Sec. 55–56)",
        shortTitle: "VAT & Excise Amendments 2083",
        subTitle: "Multi-Rate VAT, Liquor & Micro-Brewery Rules",
        category: "FY 2083/84 (Finance Bill 2083)",
        authority: "Federal Parliament Secretariat / Ministry of Finance",
        tag: "FY 2083/84 Amendment",
        provisions:
          "Authorizes Gazetted concessional VAT rates (Sec. 7(1a)), updates liquor definition (Sec. 2(n1)), micro-brewery licensing, and excise suspension renewals.",
        sourceUrl: "/api/sources/finance-bill-2083-pdf",
        fileName: "finance-bill-2083-84-original.pdf",
      },
      {
        title:
          "Finance Bill, 2083 — Customs Duty & Customs Act Amendments (Sec. 58–59)",
        shortTitle: "Customs Amendments 2083",
        subTitle: "Sec. 28A Review & Annex 4 Baggage Schedule",
        category: "FY 2083/84 (Finance Bill 2083)",
        authority: "Department of Customs / Ministry of Finance",
        tag: "FY 2083/84 Amendment",
        provisions:
          "Establishes administrative review under Sec. 28A of Customs Duty Act, 2081, amends Customs Act, 2082, and updates Annex 4 Baggage Rules.",
        sourceUrl: "/api/sources/finance-bill-2083-pdf",
        fileName: "finance-bill-2083-84-original.pdf",
      },
      {
        title: "Income Tax Act, 2058 & VAT Act, 2052 Consolidations",
        shortTitle: "Base Statutory Acts",
        subTitle: "Primary Direct & Indirect Tax Texts",
        category: "Consolidated Base Acts",
        authority: "Nepal Law Commission / IRD",
        tag: "Consolidated Statute",
        provisions:
          "Baseline English consolidations of Income Tax Act, 2058 (176 pages) and Value Added Tax Act, 2052 (42 pages).",
        status: "Verified Source PDF",
        sourceUrl: "/api/sources/income-tax-act-2058",
        fileName: "Nepal_inctax.pdf",
      },
    ],
  },
  {
    id: "regulatory-updates",
    name: "Regulatory updates",
    description:
      "Review verified statutory schemes, special levies, and amnesty provisions backed by repository source files.",
    searchPlaceholder:
      "Search verified amnesties, levies, and statutory files…",
    categories: [
      "All Updates",
      "Tax Amnesties",
      "Fees & Levies",
      "Statutory Texts",
    ],
    items: [
      {
        title:
          "Finance Bill, 2083 — Tax Amnesties & Arrears Waivers (Sec. 30–44)",
        shortTitle: "FY 2083/84 Amnesty Schemes",
        subTitle: "Legacy Taxes, 1% Arrears & 3-Tier Waivers",
        category: "Tax Amnesties",
        authority: "Inland Revenue Department / Ministry of Finance",
        tag: "Verified Relief Scheme",
        provisions:
          "Covers legacy tax write-offs (Sec. 30), post-clearance customs relief (Sec. 34), 3-tier income tax amnesty (Sec. 40), and 1% arrears settlement (Sec. 44).",
        sourceUrl: "/api/sources/finance-bill-2083-pdf",
        fileName: "finance-bill-2083-84-original.pdf",
      },
      {
        title: "Finance Bill, 2083 — Special Fees, Levies & DST (Sec. 5–22)",
        shortTitle: "Special Fees & Digital Levies",
        subTitle: "Foreign Employment, Tourism, Green Tax & Telecom",
        category: "Fees & Levies",
        authority: "Ministry of Finance",
        tag: "Statutory Levy Schedule",
        provisions:
          "Details 1% Foreign Employment Fee, Tourism Service Fee, Green Tax, Telecom Service Charge, Luxury Tax, and Digital Service Tax provisions.",
        sourceUrl: "/api/sources/finance-bill-2083-pdf",
        fileName: "finance-bill-2083-84-original.pdf",
      },
      {
        title: "The Companies Act, 2063 (2006) — English Consolidation",
        shortTitle: "Companies Act, 2063",
        subTitle: "Corporate Governance & Audits",
        category: "Statutory Texts",
        authority: "Nepal Law Commission / Office of Company Registrar",
        tag: "Corporate Statute",
        provisions:
          "198-page consolidated statutory text governing corporate registration, capital structure, financial audits, and compliance.",
        status: "Verified Source PDF",
        sourceUrl: "/api/sources/companies-act-2063",
        fileName: "Nepal_Companies.pdf",
      },
    ],
  },
];
