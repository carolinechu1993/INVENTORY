import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore'
import { firestore } from './config.js'
import { getCurrentUser } from './auth.js'

const CODE_WORDS = ['happy', 'sunny', 'lucky', 'tiny', 'cool', 'warm', 'kind', 'brave', 'calm', 'bright']
const CODE_ANIMALS = ['cat', 'dog', 'fox', 'owl', 'bear', 'duck', 'lion', 'fish', 'bird', 'whale']

function generateCode() {
  const w = CODE_WORDS[Math.floor(Math.random() * CODE_WORDS.length)]
  const a = CODE_ANIMALS[Math.floor(Math.random() * CODE_ANIMALS.length)]
  const n = Math.floor(Math.random() * 90) + 10
  return `${w}-${a}-${n}`
}

function generateId() {
  return `hh_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
}

export async function createHousehold(name = '我家') {
  const user = getCurrentUser()
  if (!user) throw new Error('請先登入 Google 帳號')

  let code
  let collision = true
  while (collision) {
    code = generateCode()
    const dup = await findHouseholdByCode(code)
    collision = dup !== null
  }

  const householdId = generateId()
  const ref = doc(firestore, 'households', householdId)
  await setDoc(ref, {
    name,
    code,
    createdAt: serverTimestamp(),
    createdBy: user.uid,
    members: [user.uid]
  })
  return { householdId, code, name }
}

export async function findHouseholdByCode(code) {
  const ref = collection(firestore, 'households')
  const q = query(ref, where('code', '==', code))
  const snap = await getDocs(q)
  if (snap.empty) return null
  const docSnap = snap.docs[0]
  return { householdId: docSnap.id, ...docSnap.data() }
}

export async function joinHouseholdByCode(code) {
  const user = getCurrentUser()
  if (!user) throw new Error('請先登入 Google 帳號')
  const found = await findHouseholdByCode(code)
  if (!found) throw new Error('找不到這個家庭代碼')
  if (found.members?.includes(user.uid)) {
    return found
  }
  const ref = doc(firestore, 'households', found.householdId)
  await updateDoc(ref, { members: arrayUnion(user.uid) })
  return { ...found, members: [...(found.members || []), user.uid] }
}

export async function leaveHousehold(householdId) {
  const user = getCurrentUser()
  if (!user) throw new Error('未登入')
  const ref = doc(firestore, 'households', householdId)
  await updateDoc(ref, { members: arrayRemove(user.uid) })
}

export async function getHouseholdsForCurrentUser() {
  const user = getCurrentUser()
  if (!user) return []
  const ref = collection(firestore, 'households')
  const q = query(ref, where('members', 'array-contains', user.uid))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ householdId: d.id, ...d.data() }))
}

export async function getHousehold(householdId) {
  const ref = doc(firestore, 'households', householdId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return { householdId: snap.id, ...snap.data() }
}
