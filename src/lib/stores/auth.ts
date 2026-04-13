// src/lib/stores/auth.ts
import { writable } from 'svelte/store';
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

// Initialise auth listener
export function initAuth() {
  return onAuthStateChanged(auth, (firebaseUser) => {
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
    authLoading.set(false);
  });
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
