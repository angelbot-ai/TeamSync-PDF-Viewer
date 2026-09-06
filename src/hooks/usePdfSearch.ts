/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */
import { useState, useCallback } from 'react';
import type * as pdfjsLib from 'pdfjs-dist';
import type { Redaction, SearchBounds } from '../core/types';

import { buildPageText, collapseWhitespace, boundsForRawRange } from '../utils/pageText';

export type { SearchBounds };

export interface SearchResult {
  id: string;
  pageIndex: number;
  snippet: string;
  matchStartIndex: number;
  matchLength: number;
  bounds: SearchBounds[];
}

/**
 * Standalone asynchronous text search across all pages (or specified pages) of a PDFDocumentProxy.
 * Sanitizes redacted regions and returns matching snippets and bounding boxes.
 */
export async function searchPdfText(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  query: string,
  redactions: Redaction[] = [],
  onProgress?: (progress: number) => void,
  pages?: number[]
): Promise<SearchResult[]> {
  if (!pdfDoc || !query.trim()) return [];

  const results: SearchResult[] = [];
  const qn = collapseWhitespace(query).toLowerCase();
  if (!qn) return [];

  const numPages = pdfDoc.numPages;
  let targetPages: number[];
  if (pages !== undefined) {
    const deduped = Array.from(new Set(pages));
    targetPages = deduped
      .filter(p => Number.isInteger(p) && p >= 1 && p <= numPages)
      .sort((a, b) => a - b);
    if (targetPages.length === 0) {
      onProgress?.(100);
      return [];
    }
  } else {
    targetPages = Array.from({ length: numPages }, (_, i) => i + 1);
  }

  const batchSize = 10;

  for (let batchStart = 0; batchStart < targetPages.length; batchStart += batchSize) {
    const batchPages = targetPages.slice(batchStart, batchStart + batchSize);
    const batchPromises = batchPages.map(pageNum =>
      (async () => {
        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();

        // --- Text Layer Sanitization ---
        let items = textContent.items as any[];
        if (redactions && redactions.length > 0) {
          const pageRedactions = redactions.filter(r => r.pageIndex === pageNum);
          if (pageRedactions.length > 0) {
            const vp = page.getViewport({ scale: 1 });
            items = items.filter((item: any) => {
              if (!item.str || item.str.trim() === '') return true;

              const itemX = item.transform[4];
              const itemY = item.transform[5];
              const itemW = item.width;
              const itemH = item.height || Math.abs(item.transform[3]);
              const itemTopY = vp.height - itemY - itemH;

              for (const red of pageRedactions) {
                const intersectX = Math.max(itemX, red.x) < Math.min(itemX + itemW, red.x + red.width);
                const intersectY = Math.max(itemTopY, red.y) < Math.min(itemTopY + itemH, red.y + red.height);

                if (intersectX && intersectY) {
                  return false; // Intersects redacted region, exclude from search results!
                }
              }
              return true;
            });
          }
        }

        const pageText = buildPageText(items);
        const { fullText, normText, normToRaw } = pageText;
        const lowerNormText = normText.toLowerCase();
        let n = 0;
        const pageResults: SearchResult[] = [];

        while ((n = lowerNormText.indexOf(qn, n)) !== -1) {
          const rawStart = normToRaw[n];
          const rawEndExcl = normToRaw[n + qn.length - 1] + 1;
          const snippetStart = Math.max(0, rawStart - 30);
          const snippetEnd = Math.min(fullText.length, rawEndExcl + 30);
          const snippet = fullText.substring(snippetStart, snippetEnd).replace(/\n/g, ' ');

          const bounds = boundsForRawRange(items, pageText, rawStart, rawEndExcl);

          pageResults.push({
            id: `p${pageNum}-idx${rawStart}`,
            pageIndex: pageNum,
            snippet,
            matchStartIndex: rawStart - snippetStart,
            matchLength: rawEndExcl - rawStart,
            bounds,
          });

          n += qn.length;
        }

        page.cleanup?.();
        return pageResults;
      })()
    );

    const batchResultsArray = await Promise.all(batchPromises);
    batchResultsArray.forEach(pageResults => results.push(...pageResults));

    onProgress?.(Math.round(((batchStart + batchPages.length) / targetPages.length) * 100));
    // Yield to main thread to allow UI to render progress bar
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  // Stable sort by pageIndex maintains sequential page order and ascending intra-page order
  results.sort((a, b) => a.pageIndex - b.pageIndex);

  return results;
}

export function usePdfSearch(pdfDoc: pdfjsLib.PDFDocumentProxy | null, redactions: Redaction[] = []) {
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchProgress, setSearchProgress] = useState(0);

  const search = useCallback(
    async (query: string) => {
      if (!pdfDoc || !query.trim()) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      setSearchProgress(0);

      try {
        const results = await searchPdfText(pdfDoc, query, redactions, p => setSearchProgress(p));
        setSearchResults(results);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsSearching(false);
        setSearchProgress(100);
      }
    },
    [pdfDoc, redactions]
  );

  return { search, searchResults, isSearching, searchProgress, clearSearch: () => setSearchResults([]) };
}
