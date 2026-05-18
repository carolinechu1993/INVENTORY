import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as fbSignOut
} from 'firebase/auth'
import { firebaseAuth, googleProvider, isConfigured } from './config.js'

export function isFirebaseReady() {
  return isConfigured && firebaseAuth !== null
}

export async function signInWithGoogle() {
  if (!isFirebaseReady()) throw new Error('Firebase 尚未設定，請貼上 firebase config')
  try {
    const result = await signInWithPopup(firebaseAuth, googleProvider)
    return result.user
  } catch (err) {
    if (err?.code === 'auth/popup-blocked' || err?.code === 'auth/popup-closed-by-user') {
      // 手機 / iOS 上 popup 容易被擋，退回 redirect 模式
      await signInWithRedirect(firebaseAuth, googleProvider)
      return null
    }
    throw err
  }
}

export async function consumeRedirectResult() {
  if (!isFirebaseReady()) return null
  try {
    const result = await getRedirectResult(firebaseAuth)
    return result?.user || null
  } catch (err) {
    console.warn('redirect result error', err)
    return null
  }
}

export async function signOut() {
  if (!isFirebaseReady()) return
  await fbSignOut(firebaseAuth)
}

export function getCurrentUser() {
  return firebaseAuth?.currentUser || null
}

export function subscribeAuth(callback) {
  if (!isFirebaseReady()) {
    callback(null)
    return () => {}
  }
  return onAuthStateChanged(firebaseAuth, (user) => callback(user))
}
