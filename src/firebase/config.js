import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyCpImSfGiEqJeNxmwc55314Fd3VunxRe64',
  authDomain: 'inventory-app-a313d.firebaseapp.com',
  projectId: 'inventory-app-a313d',
  storageBucket: 'inventory-app-a313d.firebasestorage.app',
  messagingSenderId: '1088044598294',
  appId: '1:1088044598294:web:ba04db3aee4487bf872137'
}

export const isConfigured = firebaseConfig.apiKey && !firebaseConfig.apiKey.includes('REPLACE')

export const firebaseApp = isConfigured ? initializeApp(firebaseConfig) : null
export const firebaseAuth = isConfigured ? getAuth(firebaseApp) : null
export const firestore = isConfigured ? getFirestore(firebaseApp) : null
export const googleProvider = isConfigured ? new GoogleAuthProvider() : null
