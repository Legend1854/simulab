import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import { MemoryStore, STORAGE_KEYS } from '../../src/services/persistence/storage';
import { renderApp } from './render';

describe('resilience', () => {
  it('shows a dismissible notice when stored data is corrupted, and still works with defaults', async () => {
    const storage = new MemoryStore();
    storage.setItem(STORAGE_KEYS.config, '{"schemaVersion":1,"data":{"name":42}}');
    storage.setItem(STORAGE_KEYS.sessions, 'not json');
    const { user } = renderApp('#/', storage);
    expect(screen.getByText(/saved configuration failed validation, so the defaults were loaded/)).toBeInTheDocument();
    expect(screen.getByText(/Saved sessions could not be read/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Five market rounds. Every number explained.');
    await user.click(screen.getAllByRole('button', { name: 'Dismiss' })[0]!);
    expect(screen.getAllByRole('button', { name: 'Dismiss' })).toHaveLength(1);
  });

  it('replaces a crashed page with recovery actions instead of a blank screen', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const Broken = () => {
      throw new Error('boom');
    };
    render(
      <ErrorBoundary onResetData={() => undefined}>
        <Broken />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
    expect(screen.getByRole('button', { name: 'Reload the page' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear SimuLab data and reload' })).toBeInTheDocument();
    quiet.mockRestore();
  });
});
