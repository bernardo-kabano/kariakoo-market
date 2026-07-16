import { initializeApp } from 'firebase/app'
import { getAnalytics } from 'firebase/analytics'
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  deleteDoc,
  where,
} from 'firebase/firestore'
import { getFirestore } from 'firebase/firestore'
import { initialProducts, initialShops } from './data'
import type { Product, Shop } from './types'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
try {
  if (typeof window !== 'undefined') {
    // Initialize Analytics when running in the browser
    getAnalytics(app)
  }
} catch (e) {
  // Analytics may fail in non-browser environments; ignore
}
const auth = getAuth(app)
const db = getFirestore(app)

function getEmailFromUsername(username: string) {
  const cleanUsername = username.trim().toLowerCase().replace(/\s+/g, '')
  return cleanUsername ? `${cleanUsername}@kariakoo.com` : 'user@kariakoo.com'
}

export async function signUpVendor(username: string, password: string) {
  if (!username.trim() || password.length < 6) {
    return { success: false, message: 'Username must not be empty and password must be at least 6 characters.' }
  }

  try {
    await createUserWithEmailAndPassword(auth, getEmailFromUsername(username), password)
    return { success: true }
  } catch (error: any) {
    return { success: false, message: error?.message || 'Registration failed.' }
  }
}

export async function signInVendor(username: string, password: string) {
  if (!username.trim() || !password.trim()) {
    return { success: false, message: 'Username and password cannot be blank.' }
  }

  try {
    await signOut(auth)
  } catch {
    // ignore stale sign-out errors
  }

  try {
    await signInWithEmailAndPassword(auth, getEmailFromUsername(username), password)
    return { success: true }
  } catch (error: any) {
    return { success: false, message: error?.message || 'Authentication failed.' }
  }
}

export function observeShops(onUpdate: (shops: Shop[]) => void) {
  try {
    const shopsQuery = query(collection(db, 'shops'))
    return onSnapshot(
      shopsQuery,
      (snapshot) => {
        const list: Shop[] = snapshot.docs.map((doc) => ({ ...(doc.data() as Shop), id: doc.id }))
        onUpdate(list)
      },
      () => {
        onUpdate(initialShops)
      },
    )
  } catch (error) {
    console.error('Firestore shops observer failed', error)
    onUpdate(initialShops)
    return () => {}
  }
}

export function observeProducts(onUpdate: (products: Product[]) => void) {
  try {
    const productsQuery = query(collection(db, 'products'))
    return onSnapshot(
      productsQuery,
      (snapshot) => {
        const list: Product[] = snapshot.docs.map((doc) => ({ ...(doc.data() as Product), id: doc.id }))
        onUpdate(list)
      },
      () => {
        onUpdate(initialProducts)
      },
    )
  } catch (error) {
    console.error('Firestore products observer failed', error)
    onUpdate(initialProducts)
    return () => {}
  }
}

export async function saveShop(shop: Shop) {
  try {
    await setDoc(doc(db, 'shops', shop.id), { ...shop, timestamp: serverTimestamp() })
    return true
  } catch (error) {
    console.error('Error saving shop:', error)
    return false
  }
}

export async function saveProduct(product: Product) {
  try {
    await setDoc(doc(db, 'products', product.id), { ...product, timestamp: serverTimestamp() })
    return true
  } catch (error) {
    console.error('Error saving product:', error)
    return false
  }
}

export async function deleteProduct(productId: string) {
  try {
    await deleteDoc(doc(db, 'products', productId))
    return true
  } catch (error) {
    console.error('Error deleting product:', error)
    return false
  }
}

export async function deleteVendor(vendorId: string) {
  try {
    await deleteDoc(doc(db, 'shops', vendorId))
    const productQuery = query(collection(db, 'products'), where('shopId', '==', vendorId))
    const snapshot = await getDocs(productQuery)
    const deletes = snapshot.docs.map((docItem) => deleteDoc(doc(db, 'products', docItem.id)))
    await Promise.all(deletes)
    return true
  } catch (error) {
    console.error('Error deleting vendor:', error)
    return false
  }
}

export async function recordInteraction(action: string, data: unknown) {
  try {
    await setDoc(doc(collection(db, 'interactions')), {
      action,
      data,
      timestamp: serverTimestamp(),
    })
  } catch (error) {
    console.error('Error recording interaction:', error)
  }
}

export async function seedInitialDataIfEmpty() {
  try {
    const shopsSnapshot = await getDocs(collection(db, 'shops'))
    if (shopsSnapshot.empty) {
      await Promise.all(initialShops.map((shop) => saveShop(shop)))
    }

    const productsSnapshot = await getDocs(collection(db, 'products'))
    if (productsSnapshot.empty) {
      await Promise.all(initialProducts.map((product) => saveProduct(product)))
    }
  } catch (error) {
    console.warn('Unable to seed initial data. Firestore may not be available.', error)
  }
}
