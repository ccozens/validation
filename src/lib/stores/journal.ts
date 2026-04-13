// src/lib/stores/journal.ts
import { writable, get } from 'svelte/store';
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
  getDocs,
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
export const journalError = writable<string | null>(null);
export const summaryLoading = writable(false);

let unsubEntries: (() => void) | null = null;
let unsubDaySummaries: (() => void) | null = null;
let unsubWeekSummaries: (() => void) | null = null;
let activeUserId: string | null = null;
let journalInitTimeout: ReturnType<typeof setTimeout> | null = null;
let initialLoadSettled = false;

export function initJournal(user: User) {
  if (activeUserId === user.uid && (unsubEntries || unsubDaySummaries || unsubWeekSummaries)) {
    return;
  }

  teardownJournal();
  activeUserId = user.uid;
  journalLoading.set(true);
  journalError.set(null);
  initialLoadSettled = false;

  const settleInitialLoad = () => {
    if (initialLoadSettled) return;
    initialLoadSettled = true;
    if (journalInitTimeout) {
      clearTimeout(journalInitTimeout);
      journalInitTimeout = null;
    }
    journalLoading.set(false);
  };

  // Safety net: avoid indefinite spinner if listeners never resolve.
  journalInitTimeout = setTimeout(() => {
    journalError.set('Could not load journal data. Check Firestore rules/indexes and refresh.');
    settleInitialLoad();
  }, 8000);

  const entriesRef = collection(db, 'users', user.uid, 'entries');
  const daySummariesRef = collection(db, 'users', user.uid, 'daySummaries');
  const weekSummariesRef = collection(db, 'users', user.uid, 'weekSummaries');

  // Entries — last 60 days
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  const entriesQuery = query(
    entriesRef,
    where('createdAt', '>=', Timestamp.fromDate(sixtyDaysAgo)),
    orderBy('createdAt', 'asc')
  );

  unsubEntries = onSnapshot(
    entriesQuery,
    (snap) => {
      entries.set(
        snap.docs.map((d) => ({
          id: d.id,
          text: d.data().text,
          createdAt: (d.data().createdAt as Timestamp)?.toDate() ?? new Date(),
          type: 'entry',
        }))
      );
      settleInitialLoad();
    },
    () => {
      entries.set([]);
      journalError.set('Could not load entries. Check Firestore permissions.');
      settleInitialLoad();
    }
  );

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
    },
    () => {
      daySummaries.set([]);
      journalError.set('Could not load day summaries. Check Firestore permissions.');
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
    },
    () => {
      weekSummaries.set([]);
      journalError.set('Could not load week summaries. Check Firestore permissions.');
    }
  );
}

export function teardownJournal() {
  if (journalInitTimeout) {
    clearTimeout(journalInitTimeout);
    journalInitTimeout = null;
  }
  initialLoadSettled = false;
  activeUserId = null;
  unsubEntries?.();
  unsubDaySummaries?.();
  unsubWeekSummaries?.();
  unsubEntries = null;
  unsubDaySummaries = null;
  unsubWeekSummaries = null;
  entries.set([]);
  daySummaries.set([]);
  weekSummaries.set([]);
  journalLoading.set(false);
  journalError.set(null);
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

// Get entries for a specific YYYY-MM-DD date string
export function getEntriesForDate(allEntries: JournalEntry[], dateStr: string): JournalEntry[] {
  return allEntries.filter((e) => toDateStr(e.createdAt) === dateStr);
}

// Get entries for current Mon–Sun week
export function getEntriesForCurrentWeek(allEntries: JournalEntry[]): JournalEntry[] {
  const { start, end } = getCurrentWeekRange();
  return allEntries.filter((e) => e.createdAt >= start && e.createdAt <= end);
}

export function getCurrentWeekRange(): { start: Date; end: Date; startStr: string; endStr: string } {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const diffToMonday = (day === 0 ? -6 : 1 - day);
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return {
    start: monday,
    end: sunday,
    startStr: toDateStr(monday),
    endStr: toDateStr(sunday),
  };
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

// Group entries by date for display
export function groupEntriesByDate(
  allEntries: JournalEntry[],
  allDaySummaries: DaySummary[]
): Map<string, { entries: JournalEntry[]; summary: DaySummary | null }> {
  const map = new Map<string, { entries: JournalEntry[]; summary: DaySummary | null }>();

  for (const entry of allEntries) {
    const dateStr = toDateStr(entry.createdAt);
    if (!map.has(dateStr)) map.set(dateStr, { entries: [], summary: null });
    map.get(dateStr)!.entries.push(entry);
  }

  for (const summary of allDaySummaries) {
    if (!map.has(summary.date)) map.set(summary.date, { entries: [], summary: null });
    map.get(summary.date)!.summary = summary;
  }

  // Sort by date descending for display
  return new Map([...map.entries()].sort((a, b) => b[0].localeCompare(a[0])));
}
