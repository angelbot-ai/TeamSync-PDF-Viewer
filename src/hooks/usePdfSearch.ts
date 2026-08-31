/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */
import { useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { Redaction } from '../core/types';

export interface SearchBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SearchResult {
  id: string;
  pageIndex: number;
  snippet: string;
  matchStartIndex: number;
  matchLength: number;
  bounds: SearchBounds[];
}

export function usePdfSearch(pdfDoc: pdfjsLib.PDFDocumentProxy | null, redactions: Redaction[] = []) {
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchProgress, setSearchProgress] = useState(0);

  const search = useCallback(async (query: string) => {
    if (!pdfDoc || !query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setSearchProgress(0);
    const results: SearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    try {
      const numPages = pdfDoc.numPages;
      
      const batchSize = 10;
      
      for (let batchStart = 1; batchStart <= numPages; batchStart += batchSize) {
        const batchPromises = [];
        const batchEnd = Math.min(batchStart + batchSize - 1, numPages);
        
        for (let pageNum = batchStart; pageNum <= batchEnd; pageNum++) {
          batchPromises.push(
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
              
              let fullText = '';
              const itemIndices: number[] = [];
              const charIndices: number[] = [];
              
              items.forEach((item, index) => {
                const str = item.str;
                for (let i = 0; i < str.length; i++) {
                  itemIndices.push(index);
                  charIndices.push(i);
                }
                fullText += str;
                
                if (item.hasEOL) {
                  fullText += '\n';
                  itemIndices.push(-1);
                  charIndices.push(-1);
                } else {
                  fullText += ' ';
                  itemIndices.push(-1);
                  charIndices.push(-1);
                }
              });

              const lowerFullText = fullText.toLowerCase();
              let startIndex = 0;
              const pageResults: SearchResult[] = [];

              while ((startIndex = lowerFullText.indexOf(lowerQuery, startIndex)) !== -1) {
                // Extract snippet
                const snippetStart = Math.max(0, startIndex - 30);
                const snippetEnd = Math.min(fullText.length, startIndex + query.length + 30);
                let snippet = fullText.substring(snippetStart, snippetEnd);
                snippet = snippet.replace(/\n/g, ' ');

                // Find involved TextItems and track exact character match range per item
                const itemMatches = new Map<number, { min: number, max: number }>();
                for (let i = startIndex; i < startIndex + query.length; i++) {
                  const itemIdx = itemIndices[i];
                  const charIdx = charIndices[i];
                  if (itemIdx !== undefined && itemIdx !== -1) {
                    const existing = itemMatches.get(itemIdx);
                    if (existing) {
                      existing.min = Math.min(existing.min, charIdx);
                      existing.max = Math.max(existing.max, charIdx);
                    } else {
                      itemMatches.set(itemIdx, { min: charIdx, max: charIdx });
                    }
                  }
                }

                const bounds: SearchBounds[] = [];
                
                itemMatches.forEach((match, itemIndex) => {
                  const item = items[itemIndex];
                  if (!item || !item.transform) return;
                  
                  const x = item.transform[4];
                  const y = item.transform[5];
                  const width = item.width;
                  const height = item.height || Math.abs(item.transform[3]);
                  const strLen = item.str.length;
                  
                  if (strLen > 0) {
                    // Approximate accurate bounding box by interpolating string character positions
                    const charWidth = width / strLen;
                    const startX = x + (match.min * charWidth);
                    const matchWidth = (match.max - match.min + 1) * charWidth;
                    bounds.push({ x: startX, y, width: matchWidth, height });
                  } else {
                    bounds.push({ x, y, width, height });
                  }
                });

                pageResults.push({
                  id: `p${pageNum}-idx${startIndex}`,
                  pageIndex: pageNum,
                  snippet,
                  matchStartIndex: startIndex - snippetStart,
                  matchLength: query.length,
                  bounds
                });

                startIndex += query.length;
              }
              page.cleanup();
              return pageResults;
            })()
          );
        }
        
        const batchResultsArray = await Promise.all(batchPromises);
        batchResultsArray.forEach(pageResults => results.push(...pageResults));
        
        // Sort results to maintain sequential page order since Promise.all resolves concurrently
        results.sort((a, b) => a.pageIndex !== b.pageIndex ? a.pageIndex - b.pageIndex : a.matchStartIndex - b.matchStartIndex);
        
        setSearchProgress(Math.round((batchEnd / numPages) * 100));
        // Yield to main thread to allow UI to render progress bar
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      setSearchResults(results);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsSearching(false);
      setSearchProgress(100);
    }
  }, [pdfDoc, redactions]);

  return { search, searchResults, isSearching, searchProgress, clearSearch: () => setSearchResults([]) };
}
