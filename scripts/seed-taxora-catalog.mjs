import { createHash } from "node:crypto";
import { statSync } from "node:fs";
import { registerHooks } from "node:module";
import { createClient } from "@supabase/supabase-js";

const loader = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      specifier.startsWith("./") &&
      !specifier.endsWith(".ts") &&
      context.parentURL?.endsWith(".ts")
    ) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});

const { RESEARCH_SECTIONS } = await import("../src/lib/research-catalog.ts");
const { TAX_LIBRARY_DOCUMENTS } = await import("../src/lib/tax-law-catalog.ts");
const { getMockKnowledgeBase } = await import("../src/lib/mock-tax-chat.ts");
loader.deregister();

const applies = process.argv.includes("--apply");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("Supabase server configuration is missing.");

const supabase = createClient(url, key, { auth: { persistSession: false } });

function stableId(namespace, key) {
  const hash = createHash("sha256")
    .update(`taxora:${namespace}:${key}`)
    .digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}
const documentKey = (row) => JSON.stringify([row.file_name, row.title]);
const questionKey = (row) =>
  JSON.stringify([row.question, row.fiscal_year, row.language]);

const sourceTypes = {
  "tds-guide-2058": "Directive",
  "aml-rules-2009": "Rule",
  "development-cooperation-policy-2014": "Circular",
};

const sourceFiscalYears = {
  "finance-bill-2083-pdf": "2083/84",
  "income-tax-act-2058": "2081/82",
  "vat-act-2052": "2081/82",
};

function documentRow({ title, fileName, sourceUrl, authority, summary }) {
  const slug = sourceUrl.split("/").at(-1);
  const row = {
    title,
    document_type: sourceTypes[slug] ?? "Act",
    issuing_authority: authority,
    fiscal_year: sourceFiscalYears[slug] ?? "General",
    file_url: sourceUrl,
    storage_path: `sources/${fileName}`,
    file_size_bytes: statSync(
      new URL(`../docs/Files/${encodeURIComponent(fileName)}`, import.meta.url),
    ).size,
    file_name: fileName,
    mime_type: "application/pdf",
    summary,
    status: "verified",
    is_anonymous: false,
  };
  return { ...row, id: stableId("document", documentKey(row)) };
}

const documents = TAX_LIBRARY_DOCUMENTS.map((source) =>
  documentRow({
    ...source,
    fileName: source.authorityDomain,
    summary: source.description,
  }),
);
documents.push(
  ...RESEARCH_SECTIONS.flatMap((section) =>
    section.items.map((source) =>
      documentRow({ ...source, summary: source.provisions }),
    ),
  ),
);

const questions = ["en", "np"].flatMap((language) =>
  getMockKnowledgeBase(language).map((item) => {
    const row = {
      question: item.question,
      short_topic: item.shortTopic,
      category: item.category,
      fiscal_year: item.fiscalYear ?? "2081/82",
      language,
      keywords: item.keywords,
      answer: item.answer,
      citations: item.resources.map(
        ({ title, citation, authority, externalUrl, libraryId }) => ({
          title,
          citation,
          authority,
          url: externalUrl,
          libraryId,
        }),
      ),
      reasoning_steps: item.thoughtProcess?.steps ?? [],
      rate_table: item.rateTable ?? null,
      status: "verified",
      is_anonymous: false,
    };
    return { ...row, id: stableId("question", questionKey(row)) };
  }),
);

async function catalogRows(table, columns) {
  const rows = [];
  const size = 500;
  for (let offset = 0; ; offset += size) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order("id")
      .range(offset, offset + size - 1);
    if (error)
      throw new Error(
        `Unable to read ${table} (${error.code ?? "request failed"}).`,
      );
    rows.push(...data);
    if (data.length < size) return rows;
  }
}

async function seed(table, columns, candidates, keyOf) {
  const existing = await catalogRows(table, columns);
  const keys = new Set(existing.map(keyOf));
  const unique = candidates.filter((row) => {
    const key = keyOf(row);
    if (keys.has(key)) return false;
    keys.add(key);
    return true;
  });

  if (!applies) {
    console.log(
      `${table}: ${unique.length} records to insert, ${existing.length} existing records preserved`,
    );
    return;
  }

  const categories = new Map();
  for (const row of unique) {
    const category = row.category ?? "";
    const group = categories.get(category) ?? [];
    group.push(row);
    categories.set(category, group);
  }

  const inserted = [];
  const blockedCategories = [];
  for (const [category, group] of categories) {
    for (let index = 0; index < group.length; index += 100) {
      const batch = group.slice(index, index + 100);
      const { error } = await supabase.from(table).upsert(batch, {
        onConflict: "id",
        ignoreDuplicates: true,
      });
      if (
        error?.code === "23514" &&
        error.message.includes("tax_qa_entries_category_check")
      ) {
        blockedCategories.push(category);
        break;
      }
      if (error) {
        const constraint = error.message.match(/constraint "([a-z_]+)"/u)?.[1];
        throw new Error(
          `Unable to seed ${table} (${constraint ?? error.code ?? "request failed"}).`,
        );
      }
      inserted.push(...batch);
    }
  }

  const persistedKeys = new Set((await catalogRows(table, columns)).map(keyOf));
  if (inserted.some((row) => !persistedKeys.has(keyOf(row)))) {
    throw new Error(`Some new ${table} rows could not be verified.`);
  }
  console.log(
    `${table}: ${inserted.length} new records verified, ${existing.length} existing records preserved`,
  );
  if (blockedCategories.length) {
    const blocked = unique.length - inserted.length;
    console.error(
      `${blocked} Q&A records blocked by the legacy category constraint: ${blockedCategories.join(", ")}. Apply scripts/supabase-migrate-custom-category.sql, then rerun the seed.`,
    );
    process.exitCode = 1;
  }
}

await seed("tax_documents", "id,title,file_name", documents, documentKey);
await seed(
  "tax_qa_entries",
  "id,question,fiscal_year,language",
  questions,
  questionKey,
);
