/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */
import * as pdfjsLib from 'pdfjs-dist';
import type { Redaction } from '../main';

export async function findRegexRedactions(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  regexes: RegExp[]
): Promise<Redaction[]> {
  const redactions: Redaction[] = [];
  if (!pdfDoc || !regexes || regexes.length === 0) return redactions;

  const numPages = pdfDoc.numPages;
  // Pre-compile global regex instances once outside the page loop
  const globalRegexes = regexes.map(r => new RegExp(r, r.flags.includes('g') ? r.flags : r.flags + 'g'));

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    try {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const items = textContent.items as any[];
      
      let fullText = '';
      // Flat arrays to eliminate object allocation per character
      const itemIndices: number[] = [];
      const charIndices: number[] = [];
      
      // Reconstruct text and build source map
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
          // Add a space to simulate visual gap, unless it's the very end
          fullText += ' ';
          itemIndices.push(-1);
          charIndices.push(-1);
        }
      });

      // Find matches for each pre-compiled regex
      for (const globalRegex of globalRegexes) {
        globalRegex.lastIndex = 0; // Reset state for global regex reuse
        const matches = [...fullText.matchAll(globalRegex)];

        for (const match of matches) {
          if (match.index === undefined) continue;
          
          const matchStart = match.index;
          const matchLength = match[0].length;
          
          // Track involved TextItems
          const itemMatches = new Map<number, { min: number; max: number }>();
          for (let i = matchStart; i < matchStart + matchLength; i++) {
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
          
          // Calculate bounding boxes for each involved item
          itemMatches.forEach((matchInfo, itemIndex) => {
            const item = items[itemIndex];
            
            // TextItem transforms: [scaleX, skewY, skewX, scaleY, tx, ty]
            // PDF origin is bottom-left
            const tx = item.transform[4];
            const ty = item.transform[5];
            const scaleY = item.transform[3];
            
            // Approximate width per character (assuming monospaced or average width)
            // A more robust solution uses font width metrics, but this works well for standard texts
            const charWidth = item.width / item.str.length;
            
            const startX = tx + (matchInfo.min * charWidth);
            const matchWidth = ((matchInfo.max - matchInfo.min) + 1) * charWidth;
            const matchHeight = item.height || scaleY; // Use item.height or scaleY fallback
            
            const padding = 2;
            const viewport = page.getViewport({ scale: 1 });
            const topY = viewport.height - ty - matchHeight;
            
            redactions.push({
              id: `regex-${pageNum}-${Math.random().toString(36).substr(2, 9)}`,
              pageIndex: pageNum,
              x: startX - padding,
              y: topY - padding,
              width: matchWidth + (padding * 2),
              height: matchHeight + (padding * 2),
              status: 'pending'
            });
          });
        }
      }
      
      // Memory Management: Clear parsed text structures for this page to prevent >1GB OOM crashes
      page.cleanup();
      
      // Thread Management: Yield to the main thread every 10 pages so the UI doesn't freeze
      if (pageNum % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    } catch (e) {
      console.error(`Failed to process page ${pageNum} for regex redaction`, e);
    }
  }

  return redactions;
}
