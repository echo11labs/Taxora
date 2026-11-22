"use client";

import { useEffect, useState } from "react";
import type { TaxDocument } from "./tax-repository";

export type PublishedDocument = Pick<
  TaxDocument,
  | "id"
  | "title"
  | "documentType"
  | "issuingAuthority"
  | "fiscalYear"
  | "fileUrl"
  | "fileName"
  | "mimeType"
  | "summary"
  | "status"
>;

export function isFinanceLegislation(title: string) {
  return /\bfinance (?:act|bill)\b|आर्थिक (?:ऐन|विधेयक)/iu.test(title);
}

export function usePublishedDocuments(enabled = true) {
  const [catalog, setCatalog] = useState<{
    documents: PublishedDocument[];
    managedCatalog: boolean;
  }>({ documents: [], managedCatalog: false });

  useEffect(() => {
    if (!enabled) return;
    const request = new AbortController();
    fetch("/api/resources", {
      cache: "no-store",
      signal: request.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then(
        (
          result: {
            documents: PublishedDocument[];
            managedCatalog?: boolean;
          } | null,
        ) => {
          if (request.signal.aborted || !result) return;
          setCatalog({
            managedCatalog: result.managedCatalog === true,
            documents: result.documents.filter(
              (document) =>
                document.status === "verified" &&
                (/^https?:\/\//i.test(document.fileUrl) ||
                  /^\/api\/sources\/[\w-]+$/.test(document.fileUrl)),
            ),
          });
        },
      )
      .catch(() => {
        // The bundled references remain available if the live catalog fails.
      });
    return () => request.abort();
  }, [enabled]);

  return catalog;
}
