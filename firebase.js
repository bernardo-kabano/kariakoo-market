import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js'
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-analytics.js'
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js'
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  deleteDoc,
  where,
} from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js'
import { initialProducts, initialShops } from './src/data.js'

let auth = null
let db = null
let initialized = false

export function initFirebase(config) {
  if (initialized) {
    return
  }
  initialized = true

  const app = initializeApp(config)
  try {
    if (typeof window !== 'undefined') {
      getAnalytics(app)
    }
  } catch (error) {
    // Ignore analytics errors in unsupported environments.
  }

  auth = getAuth(app)
  db = getFirestore(app)
}

function getEmailFromUsername(username) {
  const cleanUsername = username.trim().toLowerCase().replace(/\s+/g, '')
  return cleanUsername ? `${cleanUsername}@kariakoo.com` : 'user@kariakoo.com'
}

export async function signUpVendor(username, password) {
  if (!username.trim() || password.length < 6) {
    return { success: false, message: 'Username must not be empty and password must be at least 6 characters.' }
  }

  try {
    await createUserWithEmailAndPassword(auth, getEmailFromUsername(username), password)
    return { success: true }
  } catch (error) {
    return { success: false, message: error?.message || 'Registration failed.' }
  }
}

export async function signInVendor(username, password) {
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
  } catch (error) {
    return { success: false, message: error?.message || 'Authentication failed.' }
  }
}

export function observeShops(onUpdate) {
  if (!db) {
    onUpdate(initialShops)
    return () => {}
  }

  try {
    const shopsQuery = query(collection(db, 'shops'))
    return onSnapshot(
      shopsQuery,
      (snapshot) => {
        const list = snapshot.docs.map((docItem) => ({ ...docItem.data(), id: docItem.id }))
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

export function observeProducts(onUpdate) {
  if (!db) {
    onUpdate(initialProducts)
    return () => {}
  }

  try {
    const productsQuery = query(collection(db, 'products'))
    return onSnapshot(
      productsQuery,
      (snapshot) => {
        const list = snapshot.docs.map((docItem) => ({ ...docItem.data(), id: docItem.id }))
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

export async function saveShop(shop) {
  try {
    await setDoc(doc(db, 'shops', shop.id), { ...shop, timestamp: serverTimestamp() })
    return true
  } catch (error) {
    console.error('Error saving shop:', error)
    return false
  }
}

export async function saveProduct(product) {
  try {
    await setDoc(doc(db, 'products', product.id), { ...product, timestamp: serverTimestamp() })
    return true
  } catch (error) {
    console.error('Error saving product:', error)
    return false
  }
}

export async function deleteProduct(productId) {
  try {
    await deleteDoc(doc(db, 'products', productId))
    return true
  } catch (error) {
    console.error('Error deleting product:', error)
    return false
  }
}

export async function deleteVendor(vendorId) {
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

export async function recordInteraction(action, data) {
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
  if (!db) {
    return
  }

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
