/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * Cross-environment clipboard utility with secure and fallback execCommand copying.
 */

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // Modern asynchronous Clipboard API (supported in secure HTTPS / localhost contexts)
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below if permission was denied or running in an iframe / non-secure context
    }
  }

  // Fallback using textarea + document.execCommand('copy')
  if (typeof document !== 'undefined') {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.setAttribute('readonly', '');
      textArea.style.contain = 'strict';
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      textArea.style.top = '-9999px';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      textArea.setSelectionRange(0, text.length);
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    } catch (err) {
      console.error('Failed to copy text to clipboard fallback:', err);
      return false;
    }
  }

  return false;
}
