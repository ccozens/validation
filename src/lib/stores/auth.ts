// src/lib/stores/auth.ts
import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { auth, googleProvider, ALLOWED_EMAIL } from '$lib/firebase';
import {
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User
} from 'firebase/auth';

export const user = writable<User | null>(null);
export const authLoading = writable(true);
export const authError = writable<string | null>(null);
let authUnsubscribe: (() => void) | null = null;

// Initialise auth listener
export function initAuth() {
  if (authUnsubscribe) return authUnsubscribe;
  authLoading.set(true);

  let settled = false;
  const settle = () => {
    settled = true;
    authLoading.set(false);
  };

  // Safety net: avoid infinite loading if auth state never resolves.
  const timeoutId = setTimeout(() => {
    if (!settled) {
      authError.set('Authentication is taking longer than expected. Please refresh.');
      settle();
    }
  }, 8000);

  try {
    authUnsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        if (firebaseUser && firebaseUser.email === ALLOWED_EMAIL) {
          user.set(firebaseUser);
        } else if (firebaseUser) {
          // Signed in but not whitelisted
          firebaseSignOut(auth);
          authError.set('This app is private. That Google account is not authorised.');
          user.set(null);
        } else {
          user.set(null);
        }
        settle();
      },
      () => {
        authError.set('Authentication failed to initialise. Check your Firebase config.');
        user.set(null);
        settle();
      }
    );

    return () => {
      clearTimeout(timeoutId);
      authUnsubscribe?.();
      authUnsubscribe = null;
    };
  } catch {
    clearTimeout(timeoutId);
    authError.set('Authentication setup failed. Check your Firebase config.');
    user.set(null);
    settle();
    return () => {};
  }
}

if (browser) {
  initAuth();
}

export async function signIn() {
  authError.set(null);
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (e) {
    authError.set('Sign in failed. Please try again.');
  }
}

export async function signOut() {
  await firebaseSignOut(auth);
}
