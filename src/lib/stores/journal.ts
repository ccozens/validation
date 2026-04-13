// src/lib/stores/journal.ts
import { writable } from 'svelte/store';
import { db } from '$lib/firebase';
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  doc,
  setDoc,
  where
} from 'firebase/firestore';
import type { User } from 'firebase/auth';

export interface JournalEntry {
  id: string;
  text: string;
  createdAt: Date;
  type: 'entry';
}

export interface DaySummary {
  id: string;
  date: string; // YYYY-MM-DD
  summary: string;
  createdAt: Date;
  type: 'day-summary';
}

export interface WeekSummary {
  id: string;
  weekStart: string; // YYYY-MM-DD (Monday)
  weekEnd: string;   // YYYY-MM-DD (Sunday)
  summary: string;
  createdAt: Date;
  type: 'week-summary';
}

export type JournalItem = JournalEntry | DaySummary | WeekSummary;

export const entries = writable<JournalEntry[]>([]);
export const daySummaries = writable<DaySummary[]>([]);
export const weekSummaries = writable<WeekSummary[]>([]);
export const journalLoading = writable(true);
export const summaryLoading = writable(false);

let unsubEntries: (() => void) | null = null;
let unsubDaySummaries: (() => void) | null = null;
let unsubWeekSummaries: (() => void) | null = null;

export function initJournal(user: User) {
  journalLoading.set(true);

  const entriesRef = collection(db, 'users', user.uid, 'entries');
  const daySummariesRef = collection(db, 'users', user.uid, 'daySummaries');
  const weekSummariesRef = collection(db, 'users', user.uid, 'weekSummaries');

  // Entries — last 60 days
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  const entriesQuery = query(
    entriesRef,
    where('createdAt', '>=', Timestamp.fromDate(sixtyDaysAgo)),
    orderBy('createdAt', 'desc')
  );

  unsubEntries = onSnapshot(entriesQuery, (snap) => {
    entries.set(
      snap.docs.map((d) => ({
        id: d.id,
        text: d.data().text,
        createdAt: (d.data().createdAt as Timestamp)?.toDate() ?? new Date(),
        type: 'entry',
      }))
    );
    journalLoading.set(false);
  });

  unsubDaySummaries = onSnapshot(
    query(daySummariesRef, orderBy('date', 'asc')),
    (snap) => {
      daySummaries.set(
        snap.docs.map((d) => ({
          id: d.id,
          date: d.data().date,
          summary: d.data().summary,
          createdAt: (d.data().createdAt as Timestamp)?.toDate() ?? new Date(),
          type: 'day-summary',
        }))
      );
    }
  );

  unsubWeekSummaries = onSnapshot(
    query(weekSummariesRef, orderBy('weekStart', 'asc')),
    (snap) => {
      weekSummaries.set(
        snap.docs.map((d) => ({
          id: d.id,
          weekStart: d.data().weekStart,
          weekEnd: d.data().weekEnd,
          summary: d.data().summary,
          createdAt: (d.data().createdAt as Timestamp)?.toDate() ?? new Date(),
          type: 'week-summary',
        }))
      );
    }
  );
}

export function teardownJournal() {
  unsubEntries?.();
  unsubDaySummaries?.();
  unsubWeekSummaries?.();
  entries.set([]);
  daySummaries.set([]);
  weekSummaries.set([]);
}

export async function addEntry(user: User, text: string) {
  const entriesRef = collection(db, 'users', user.uid, 'entries');
  await addDoc(entriesRef, {
    text: text.trim(),
    createdAt: serverTimestamp(),
  });
}

export async function saveDaySummary(user: User, date: string, summary: string) {
  const ref = doc(db, 'users', user.uid, 'daySummaries', date);
  await setDoc(ref, {
    date,
    summary,
    createdAt: serverTimestamp(),
  });
}

export async function saveWeekSummary(
  user: User,
  weekStart: string,
  weekEnd: string,
  summary: string
) {
  const ref = doc(db, 'users', user.uid, 'weekSummaries', weekStart);
  await setDoc(ref, {
    weekStart,
    weekEnd,
    summary,
    createdAt: serverTimestamp(),
  });
}

export function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Returns entries since the last week summary was generated (or all entries
 * if no summary exists yet). Also returns whether there's enough material
 * to warrant a new summary (entries spanning at least 5 distinct days).
 */
export function getEntriesSinceLastSummary(
  allEntries: JournalEntry[],
  allWeekSummaries: WeekSummary[]
): { entries: JournalEntry[]; sinceDate: string | null; hasEnough: boolean } {
  let sinceDate: string | null = null;

  if (allWeekSummaries.length > 0) {
    // Most recent summary — entries are stored newest-first so we need the max weekEnd
    const lastSummary = allWeekSummaries.reduce((a, b) =>
      a.weekEnd > b.weekEnd ? a : b
    );
    sinceDate = lastSummary.weekEnd;
  }

  const filtered = sinceDate
    ? allEntries.filter((e) => toDateStr(e.createdAt) > sinceDate!)
    : allEntries;

  // Count distinct days
  const distinctDays = new Set(filtered.map((e) => toDateStr(e.createdAt)));
  const hasEnough = distinctDays.size >= 5;

  return { entries: filtered, sinceDate, hasEnough };
}

// Group entries by date for display — days newest first, entries newest first within day
export function groupEntriesByDate(
  allEntries: JournalEntry[],
  allDaySummaries: DaySummary[],
  allWeekSummaries: WeekSummary[]
): Map<string, { entries: JournalEntry[]; daySummary: DaySummary | null; weekSummaryAfter: WeekSummary | null }> {
  const map = new Map<string, { entries: JournalEntry[]; daySummary: DaySummary | null; weekSummaryAfter: WeekSummary | null }>();

  // Entries already newest-first from Firestore query
  for (const entry of allEntries) {
    const dateStr = toDateStr(entry.createdAt);
    if (!map.has(dateStr)) map.set(dateStr, { entries: [], daySummary: null, weekSummaryAfter: null });
    map.get(dateStr)!.entries.push(entry);
  }

  for (const summary of allDaySummaries) {
    if (!map.has(summary.date)) map.set(summary.date, { entries: [], daySummary: null, weekSummaryAfter: null });
    map.get(summary.date)!.daySummary = summary;
  }

  // Attach each week summary to the day matching its weekEnd date
  for (const ws of allWeekSummaries) {
    const targetDate = ws.weekEnd;
    if (!map.has(targetDate)) map.set(targetDate, { entries: [], daySummary: null, weekSummaryAfter: null });
    map.get(targetDate)!.weekSummaryAfter = ws;
  }

  // Sort by date descending
  return new Map([...map.entries()].sort((a, b) => b[0].localeCompare(a[0])));
}
