/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */

import { describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import InsertLinkModal from './InsertLinkModal';

// @ts-ignore
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('InsertLinkModal', () => {
  it('renders and saves document link with page number', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const onSave = vi.fn();
    const onClose = vi.fn();

    await act(async () => {
      root.render(
        <InsertLinkModal
          initialUrl="supporting-doc.pdf#page=4"
          initialText="Exhibit B"
          showTextInput={true}
          onClose={onClose}
          onSave={onSave}
        />
      );
    });

    // The modal should open on the 'Other Doc' tab because initialUrl is a document link
    const otherDocTab = Array.from(container.querySelectorAll('div')).find(el => el.textContent === 'Other Doc');
    expect(otherDocTab).toBeDefined();

    // The document input should have 'supporting-doc.pdf'
    const inputs = container.querySelectorAll('input');
    expect(inputs.length).toBeGreaterThanOrEqual(2);
    expect((inputs[0] as HTMLInputElement).value).toBe('supporting-doc.pdf');
    expect((inputs[1] as HTMLInputElement).value).toBe('4');

    // Click Link (save) button
    const linkBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Link');
    expect(linkBtn).toBeDefined();

    await act(async () => {
      linkBtn?.click();
    });

    expect(onSave).toHaveBeenCalledWith('supporting-doc.pdf#page=4', 'Exhibit B');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('renders and saves web URL', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const onSave = vi.fn();
    const onClose = vi.fn();

    await act(async () => {
      root.render(
        <InsertLinkModal
          initialUrl="https://teamsync.link"
          showTextInput={false}
          onClose={onClose}
          onSave={onSave}
        />
      );
    });

    // Save button
    const linkBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Link');
    await act(async () => {
      linkBtn?.click();
    });

    expect(onSave).toHaveBeenCalledWith('https://teamsync.link');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('renders and saves current document page jump', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const onSave = vi.fn();
    const onClose = vi.fn();

    await act(async () => {
      root.render(
        <InsertLinkModal
          initialUrl="#page=8"
          showTextInput={false}
          onClose={onClose}
          onSave={onSave}
        />
      );
    });

    // Save button
    const linkBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Link');
    await act(async () => {
      linkBtn?.click();
    });

    expect(onSave).toHaveBeenCalledWith('#page=8');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
