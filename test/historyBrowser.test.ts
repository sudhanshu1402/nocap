import { describe, expect, it } from 'vitest';
import { relativeTime } from '../src/ui/HistoryBrowser.js';

describe('relativeTime', () => {
  it('reads as "just now" for timestamps under a minute old', () => {
    expect(relativeTime(Date.now() - 5_000)).toBe('just now');
  });

  it('renders whole minutes for anything under an hour', () => {
    expect(relativeTime(Date.now() - 5 * 60_000)).toBe('5m ago');
  });

  it('renders whole hours for anything under a day', () => {
    expect(relativeTime(Date.now() - 3 * 60 * 60_000)).toBe('3h ago');
  });

  it('renders whole days beyond that', () => {
    expect(relativeTime(Date.now() - 2 * 24 * 60 * 60_000)).toBe('2d ago');
  });
});
