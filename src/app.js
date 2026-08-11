import { 
  initializeApp 
} from 'firebase/app'
import { 
  getAnalytics 
} from 'firebase/analytics'
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
  getFirestore,
} from 'firebase/firestore'
import { Loader } from '@googlemaps/js-api-loader'
import { initialProducts, initialShops } from './data.js'

// ============================================================================
// FIREBASE SETUP
// ============================================================================

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const firebaseApp = initializeApp(firebaseConfig)
try {
  if (typeof window !== 'undefined') {
    getAnalytics(firebaseApp)
  }
} catch (e) {
  // Analytics may fail; ignore
}

const auth = getAuth(firebaseApp)
const db = getFirestore(firebaseApp)

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? ''
const initialVendorImage = 'https://images.unsplash.com/photo-1488459711435-07859c07a58b?auto=format&fit=crop&q=80&w=400'

// ============================================================================
// FIREBASE FUNCTIONS
// ============================================================================

function getEmailFromUsername(username) {
  const cleanUsername = username.trim().toLowerCase().replace(/\s+/g, '')
  return cleanUsername ? `${cleanUsername}@kariakoo.com` : 'user@kariakoo.com'
}

async function signUpVendor(username, password) {
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

async function signInVendor(username, password) {
  if (!username.trim() || !password.trim()) {
    return { success: false, message: 'Username and password cannot be blank.' }
  }
  try {
    await signOut(auth)
  } catch {
    // ignore
  }
  try {
    await signInWithEmailAndPassword(auth, getEmailFromUsername(username), password)
    return { success: true }
  } catch (error) {
    return { success: false, message: error?.message || 'Authentication failed.' }
  }
}

function observeShops(onUpdate) {
  try {
    const shopsQuery = query(collection(db, 'shops'))
    return onSnapshot(
      shopsQuery,
      (snapshot) => {
        const list = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }))
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

function observeProducts(onUpdate) {
  try {
    const productsQuery = query(collection(db, 'products'))
    return onSnapshot(
      productsQuery,
      (snapshot) => {
        const list = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }))
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

async function saveShop(shop) {
  try {
    await setDoc(doc(db, 'shops', shop.id), { ...shop, timestamp: serverTimestamp() })
    return true
  } catch (error) {
    console.error('Error saving shop:', error)
    return false
  }
}

async function saveProduct(product) {
  try {
    await setDoc(doc(db, 'products', product.id), { ...product, timestamp: serverTimestamp() })
    return true
  } catch (error) {
    console.error('Error saving product:', error)
    return false
  }
}

async function deleteProduct(productId) {
  try {
    await deleteDoc(doc(db, 'products', productId))
    return true
  } catch (error) {
    console.error('Error deleting product:', error)
    return false
  }
}

async function deleteVendor(vendorId) {
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

async function recordInteraction(action, data) {
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

async function seedInitialDataIfEmpty() {
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

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function calculateDistance(lat1, lng1, lat2, lng2) {
  const toRadians = (value) => (value * Math.PI) / 180
  const dLat = toRadians(lat2 - lat1)
  const dLng = toRadians(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return 6371 * c
}

function getPathColor(distanceKm) {
  if (distanceKm <= 0.1) return '#2563eb'
  if (distanceKm <= 5.0) return '#22c55e'
  if (distanceKm <= 10.0) return '#ec4899'
  return '#ef4444'
}

function showToast(message) {
  const toast = document.createElement('div')
  toast.className = 'toast-message'
  toast.textContent = message
  document.body.appendChild(toast)
  setTimeout(() => toast.remove(), 3500)
}

// ============================================================================
// APP STATE & MAIN LOGIC
// ============================================================================

class KariakooApp {
  constructor() {
    this.activeScreen = 1
    this.userType = null
    this.searchQuery = 'Charger'
    this.budget = ''
    this.selectedClass = 'B'
    this.selectedShopId = null
    this.vendorUsername = ''
    this.vendorPhone = ''
    this.vendorPassword = ''
    this.vendorLocation = ''
    this.vendorLat = -6.8235
    this.vendorLng = 39.2790
    this.vendorShopName = ''
    this.vendorShopImage = initialVendorImage
    this.vendorIsRegistered = false
    this.shops = initialShops
    this.products = initialProducts
    this.mapInstance = null
    this.mapLoader = null
    this.init()
  }

  init() {
    this.setupDOM()
    this.setupFirebase()
  }

  setupDOM() {
    const root = document.getElementById('root')
    root.innerHTML = `
      <div class="app-shell">
        <div class="app-frame">
          <div class="hero-bar">
            <div>
              <div class="brand">Kariakoo Market</div>
              <div class="brand-subtitle">Web marketplace with vendor cataloging, customer search, and map navigation.</div>
            </div>
            <div class="hero-actions">
              <button id="admin-btn" class="button-text admin-button" data-action="navigateTo" data-param="12">Admin Access</button>
              <div class="status-pill">Version 1.0</div>
            </div>
          </div>
          <div class="screen-container" id="screen-container"></div>
        </div>
      </div>
    `
  }

  setupFirebase() {
    seedInitialDataIfEmpty()
    const unsubscribeShops = observeShops((shops) => {
      this.shops = shops
      this.render()
    })
    const unsubscribeProducts = observeProducts((products) => {
      this.products = products
      this.render()
    })
  }

  navigateTo(screen) {
    this.activeScreen = screen
    this.render()
  }

  handleBack() {
    switch (this.activeScreen) {
      case 2:
      case 6:
      case 12:
        this.navigateTo(1)
        break
      case 3:
        this.navigateTo(2)
        break
      case 4:
        this.navigateTo(3)
        break
      case 5:
        this.navigateTo(4)
        break
      case 7:
        this.navigateTo(6)
        break
      case 8:
        this.navigateTo(7)
        break
      case 9:
        this.navigateTo(8)
        break
      case 10:
        this.navigateTo(9)
        break
      case 11:
        this.navigateTo(6)
        break
      case 13:
        this.navigateTo(12)
        break
      default:
        this.navigateTo(1)
    }
  }

  render() {
    const container = document.getElementById('screen-container')
    let content = ''

    switch (this.activeScreen) {
      case 1:
        content = this.renderSelectionScreen()
        break
      case 2:
        content = this.renderVendorAuthScreen()
        break
      case 3:
        content = this.renderShopRegistrationScreen()
        break
      case 4:
        content = this.renderShopPreviewScreen()
        break
      case 5:
        content = this.renderProductManagementScreen()
        break
      case 6:
        content = this.renderCustomerSearchScreen()
        break
      case 7:
        content = this.renderClassSelectionScreen()
        break
      case 8:
        content = this.renderShopsListScreen()
        break
      case 9:
        content = this.renderProductDetailsScreen()
        break
      case 10:
        content = this.renderMapScreen()
        break
      case 11:
        content = this.renderRegisteredShopsScreen()
        break
      case 12:
        content = this.renderAdminLoginScreen()
        break
      case 13:
        content = this.renderAdminDashboardScreen()
        break
    }

    container.innerHTML = content
    this.attachEventListeners()
  }

  attachEventListeners() {
    // This will be populated dynamically based on screen
  }

  // ===== SCREEN RENDERERS =====

  renderSelectionScreen() {
    return `
      <div class="screen">
        <h2>Who are you?</h2>
        <p class="screen-copy">Identify your role to access specialized Kariakoo Market tools and fair-price indexing.</p>
        <div class="role-grid">
          <button class="role-card ${this.userType === 'customer' ? 'role-card-selected' : ''}" data-action="selectRole" data-param="customer">
            <div class="role-symbol">👤</div>
            <div>
              <strong>Customer</strong>
              <p>Search items across Class A, B, C and find the best vendor with fair prices.</p>
            </div>
          </button>
          <button class="role-card ${this.userType === 'vendor' ? 'role-card-selected' : ''}" data-action="selectRole" data-param="vendor">
            <div class="role-symbol">🏪</div>
            <div>
              <strong>Vendor / Merchant</strong>
              <p>Register stall credentials, catalog inventory grades, and advertise availability.</p>
            </div>
          </button>
        </div>
        <div class="button-row">
          <button class="button-solid" data-action="handleSelectionNext">Send Identification</button>
        </div>
      </div>
    `
  }

  selectRole(role) {
    this.userType = role
    recordInteraction('select_role', role)
    this.render()
  }

  handleSelectionNext() {
    if (!this.userType) {
      showToast('Please select a role before continuing.')
      return
    }
    recordInteraction('navigate_next', { from: 'selection', role: this.userType })
    this.navigateTo(this.userType === 'vendor' ? 2 : 6)
  }

  renderVendorAuthScreen() {
    const isLogin = true // State would track this - simplified for now
    return `
      <div class="screen">
        <button class="back-button" data-action="handleBack">← Back</button>
        <h2>Vendor Sign In</h2>
        <p class="screen-copy">Sign in to manage your shop listing and product catalog.</p>
        <label class="field-group">
          <span>Username / Business Code</span>
          <input id="vendor-username" placeholder="e.g. msimbazi_digital" />
        </label>
        <label class="field-group">
          <span>Password</span>
          <input type="password" id="vendor-password" placeholder="At least 6 characters" />
        </label>
        <button class="button-solid" data-action="handleVendorLogin">Submit & Sign In</button>
        <button class="button-outline" data-action="toggleVendorMode">New vendor? Register here</button>
      </div>
    `
  }

  handleVendorLogin() {
    const username = document.getElementById('vendor-username').value
    const password = document.getElementById('vendor-password').value
    signInVendor(username, password).then(result => {
      if (!result.success) {
        showToast(result.message || 'Login failed')
        return
      }
      const existingShop = this.shops.find((shop) => shop.username === username)
      if (existingShop) {
        this.vendorUsername = username
        this.vendorPhone = existingShop.phone
        this.vendorPassword = password
        this.vendorLocation = existingShop.location
        this.vendorLat = existingShop.latitude
        this.vendorLng = existingShop.longitude
        this.vendorShopName = existingShop.name
        this.vendorShopImage = existingShop.image
        this.vendorIsRegistered = true
        this.navigateTo(4)
      } else {
        this.vendorUsername = username
        this.vendorPassword = password
        this.navigateTo(3)
      }
    })
  }

  toggleVendorMode() {
    // Would toggle between login and register - simplified
  }

  renderShopRegistrationScreen() {
    return `
      <div class="screen">
        <button class="back-button" data-action="handleBack">← Back</button>
        <h2>Shop Registration</h2>
        <p class="screen-copy">Provide a shop name, image, and physical stall details.</p>
        <div class="image-picker" onclick="alert('Image uploads are simulated in this web version.')"> 
          <img src="${this.vendorShopImage}" alt="Shop preview" />
          <span>Click to choose a shop image</span>
        </div>
        <label class="field-group">
          <span>Shop / Stall Name</span>
          <input id="shop-name" placeholder="Kariakoo Stall Name" />
        </label>
        <label class="field-group">
          <span>Shop Location</span>
          <input id="shop-location" value="${this.vendorLocation}" placeholder="Congo Street, Block 4" />
        </label>
        <div class="field-row">
          <label class="field-group half-width">
            <span>Latitude</span>
            <input id="shop-lat" value="${this.vendorLat}" placeholder="-6.8235" />
          </label>
          <label class="field-group half-width">
            <span>Longitude</span>
            <input id="shop-lng" value="${this.vendorLng}" placeholder="39.2790" />
          </label>
        </div>
        <button class="button-solid" data-action="handleShopSave">Save & Preview Stall</button>
      </div>
    `
  }

  handleShopSave() {
    const shopName = document.getElementById('shop-name').value
    const shopLocation = document.getElementById('shop-location').value
    const shopLat = parseFloat(document.getElementById('shop-lat').value) || -6.8235
    const shopLng = parseFloat(document.getElementById('shop-lng').value) || 39.2790

    this.vendorShopName = shopName || 'Kariakoo Stall'
    this.vendorLocation = shopLocation
    this.vendorLat = shopLat
    this.vendorLng = shopLng

    const newShop = {
      id: `shop_${this.vendorUsername}`,
      name: shopName || 'Kariakoo Stall',
      username: this.vendorUsername,
      phone: this.vendorPhone,
      password: this.vendorPassword,
      image: this.vendorShopImage || initialVendorImage,
      description: 'Verified Kariakoo Merchant',
      location: shopLocation || 'Kariakoo Market Center',
      category: 'General',
      rating: 5.0,
      latitude: shopLat,
      longitude: shopLng,
      tags: ['New'],
    }

    saveShop(newShop).then(saved => {
      if (!saved) {
        showToast('Unable to register the shop. Try again.')
        return
      }
      this.vendorShopName = newShop.name
      this.vendorShopImage = newShop.image
      this.vendorIsRegistered = true
      recordInteraction('vendor_registered', { vendor: this.vendorUsername, shop: newShop.id })
      this.navigateTo(4)
    })
  }

  renderShopPreviewScreen() {
    return `
      <div class="screen">
        <button class="back-button" data-action="handleBack">← Back</button>
        <h2>Shop Preview</h2>
        <p class="screen-copy">Review the shop listing before opening your product catalog.</p>
        <div class="preview-card">
          <div class="preview-image" style="background-image: url('${this.vendorShopImage}')">
            <span class="verification-tag">Verified Retailer</span>
          </div>
          <div class="preview-details">
            <strong>${this.vendorShopName || 'Kariakoo Merchant'}</strong>
            <p>Phone: ${this.vendorPhone}</p>
            <p>Username: @${this.vendorUsername}</p>
            <p>All catalogs uploaded through this profile are audited for fair pricing.</p>
          </div>
        </div>
        <button class="button-solid" data-action="navigateTo" data-param="5">Go into Catalog</button>
      </div>
    `
  }

  renderProductManagementScreen() {
    const shopId = `shop_${this.vendorUsername}`
    const shopProducts = this.products.filter(p => p.shopId === shopId)
    let productsHtml = shopProducts.map(product => `
      <div class="product-card">
        <img src="${product.image}" alt="${product.name}" />
        <div class="product-content">
          <strong>${product.name}</strong>
          <p>${product.description}</p>
          <div class="chip-row">
            <span class="chip">Class ${product.class}</span>
            <span class="chip">${product.availability}</span>
          </div>
        </div>
        <div class="product-actions">
          <span class="price-tag">${product.price} TSh</span>
          <button class="button-text" data-action="handleDeleteProduct" data-param="${product.id}">Delete</button>
        </div>
      </div>
    `).join('')

    return `
      <div class="screen">
        <button class="back-button" data-action="handleBack">← Back</button>
        <div class="screen-heading-row">
          <div>
            <h2>Products</h2>
            <p class="screen-copy">Catalog items for ${this.vendorShopName}</p>
          </div>
          <button class="button-outline" data-action="showAddProductModal">+ Add Product</button>
        </div>
        <div class="products-list">
          ${productsHtml || '<div class="empty-state">No products yet</div>'}
        </div>
        <button class="button-outline red" data-action="handleCloseShop">Close My Shop</button>
      </div>
      <div id="product-modal"></div>
    `
  }

  showAddProductModal() {
    const modal = document.getElementById('product-modal')
    const shopId = `shop_${this.vendorUsername}`
    modal.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-card">
          <h3>New Product</h3>
          <label class="field-group">
            <span>Name</span>
            <input id="product-name" placeholder="Product title" />
          </label>
          <label class="field-group">
            <span>Price (TSh)</span>
            <input id="product-price" placeholder="18000" />
          </label>
          <label class="field-group">
            <span>Stock Quantity</span>
            <input id="product-stock" placeholder="45" />
          </label>
          <label class="field-group">
            <span>Description</span>
            <textarea id="product-desc" placeholder="Short description"></textarea>
          </label>
          <label class="field-group">
            <span>Product Image</span>
            <input type="file" id="product-image" accept="image/*" />
            <small style="display: block; margin-top: 8px; color: #666;">No image selected</small>
          </label>
          <div class="field-row quality-row">
            <button class="chip-button selected" data-class="A" data-action="selectQuality" data-param="A">Class A</button>
            <button class="chip-button" data-class="B" data-action="selectQuality" data-param="B">Class B</button>
            <button class="chip-button" data-class="C" data-action="selectQuality" data-param="C">Class C</button>
          </div>
          <div class="modal-actions">
            <button class="button-outline" data-action="hideAddProductModal">Cancel</button>
            <button class="button-solid" data-action="handleSaveProduct">Save</button>
          </div>
        </div>
      </div>
    `
    document.body.classList.add('modal-open')
    document.getElementById('product-image').addEventListener('change', (e) => {
      const file = e.target.files[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        app.productImage = reader.result
      }
      reader.readAsDataURL(file)
    })
  }

  selectQuality(cls) {
    this.productQuality = cls
    document.querySelectorAll('.quality-row .chip-button').forEach(btn => {
      btn.classList.remove('selected')
    })
    const selectedButton = document.querySelector(`.quality-row .chip-button[data-class="${cls}"]`)
    if (selectedButton) {
      selectedButton.classList.add('selected')
    }
  }

  hideAddProductModal() {
    const modal = document.getElementById('product-modal')
    if (modal) {
      modal.innerHTML = ''
    }
    document.body.classList.remove('modal-open')
  }

  handleSaveProduct() {
    const name = document.getElementById('product-name').value
    const price = Number(document.getElementById('product-price').value) || 0
    const stock = Number(document.getElementById('product-stock').value) || 0
    const desc = document.getElementById('product-desc').value
    const image = this.productImage || 'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?auto=format&fit=crop&q=80&w=300'
    const shopId = `shop_${this.vendorUsername}`

    const product = {
      id: `prod_${Date.now()}`,
      name: name || 'New Item',
      description: desc || 'No description provided.',
      price,
      image,
      category: 'General',
      class: this.productQuality || 'B',
      shopId,
      availability: 'Immediate Stock',
      stock,
    }

    saveProduct(product).then(success => {
      if (success) {
        showToast('Product catalog updated successfully.')
        recordInteraction('product_added', { shopId, productId: product.id })
        this.hideAddProductModal()
        this.render()
      } else {
        showToast('Failed to save the product. Please try again.')
      }
    })
  }

  handleDeleteProduct(productId) {
    deleteProduct(productId).then(success => {
      if (success) {
        showToast('Product removed successfully.')
        recordInteraction('product_deleted', { productId })
        this.render()
      } else {
        showToast('Failed to delete the product.')
      }
    })
  }

  handleCloseShop() {
    this.userType = null
    this.vendorUsername = ''
    this.vendorPhone = ''
    this.vendorPassword = ''
    this.vendorLocation = ''
    this.vendorShopName = ''
    this.vendorShopImage = initialVendorImage
    this.vendorIsRegistered = false
    this.navigateTo(1)
  }

  renderCustomerSearchScreen() {
    return `
      <div class="screen">
        <button class="back-button" data-action="handleBack">← Back</button>
        <h2>Customer Search</h2>
        <p class="screen-copy">Search your product, set a budget, and compare across quality classes.</p>
        <label class="field-group">
          <span>What are you buying today?</span>
          <input id="search-query" value="${this.searchQuery}" placeholder="Charger" />
        </label>
        <label class="field-group">
          <span>Budget (TSh)</span>
          <input id="search-budget" value="${this.budget}" placeholder="15000" />
        </label>
        <div class="action-row">
          <button class="button-solid" data-action="handleCustomerSearch">Proceed to Price Grades</button>
          <button class="button-outline" data-action="navigateTo" data-param="11">Browse Registered Shops</button>
        </div>
        <div class="chip-row">
          ${['Charger', 'Kitenge', 'Cloves', 'Sandal', 'Rice'].map(term => 
            `<button class="chip-button" data-action="quickSearch" data-param="${term}">
              ${term}
            </button>`
          ).join('')}
        </div>
        <div class="info-box">
          Search indexes allow comparison across three standardized marketplace quality classes A, B & C.
        </div>
      </div>
    `
  }

  handleCustomerSearch() {
    this.searchQuery = document.getElementById('search-query').value
    this.budget = document.getElementById('search-budget').value
    recordInteraction('perform_search', { query: this.searchQuery, budget: this.budget })
    this.navigateTo(7)
  }

  quickSearch(term) {
    this.searchQuery = term
    this.navigateTo(7)
  }

  renderClassSelectionScreen() {
    const classes = [
      { letter: 'A', title: 'Class A (Premium Quality)', desc: 'Top imported grade items, certification-ready, and premium service.', color: '#f59e0b' },
      { letter: 'B', title: 'Class B (Standard Grade)', desc: 'Excellent value performance, locally optimized pricing and reliability.', color: '#4f46e5' },
      { letter: 'C', title: 'Class C (Economy / Bulk)', desc: 'Wholesale and budget inventory for everyday needs and large orders.', color: '#10b981' },
    ]

    return `
      <div class="screen">
        <button class="back-button" data-action="handleBack">← Back</button>
        <h2>Choose Your Class</h2>
        <p class="screen-copy">
          Comparing values for "${this.searchQuery}"${this.budget ? ` with a budget of ${this.budget} TSh` : ''}.
        </p>
        ${classes.map(item => `
          <button class="quality-card" data-action="handleClassSelect" data-param="${item.letter}">
            <div class="quality-badge" style="background-color: ${item.color}">${item.letter}</div>
            <div>
              <strong>${item.title}</strong>
              <p>${item.desc}</p>
            </div>
          </button>
        `).join('')}
        <div class="info-box orange">
          In Kariakoo Market, pricing varies by quality tier. Choose the class that matches your preference.
        </div>
      </div>
    `
  }

  handleClassSelect(cls) {
    this.selectedClass = cls
    recordInteraction('class_selected', cls)
    this.navigateTo(8)
  }

  renderShopsListScreen() {
    const matchingShops = this.shops.filter((shop) => {
      const hasProduct = this.products.some((product) => {
        if (product.shopId !== shop.id) return false
        if (this.selectedClass && product.class !== this.selectedClass) return false
        if (this.searchQuery && !product.name.toLowerCase().includes(this.searchQuery.toLowerCase()) && 
            !product.description.toLowerCase().includes(this.searchQuery.toLowerCase())) return false
        if (this.budget && product.price > Number(this.budget)) return false
        return true
      })
      return hasProduct
    })

    const shopsHtml = matchingShops.map(shop => {
      const highlightProduct = this.products.find((product) => 
        product.shopId === shop.id && 
        (!this.selectedClass || product.class === this.selectedClass) && 
        (!this.searchQuery || product.name.toLowerCase().includes(this.searchQuery.toLowerCase()))
      )
      return `
        <button class="shop-card" data-action="handleShopSelect" data-param="${shop.id}">
          <img src="${shop.image}" alt="${shop.name}" />
          <div class="shop-content">
            <strong>${shop.name}</strong>
            <p>${shop.description}</p>
            <div class="chip-row">
              <span class="chip">Rating ${shop.rating}</span>
              <span class="chip">${shop.location}</span>
            </div>
            ${highlightProduct ? `<div class="highlight-line">Fair Price: ${highlightProduct.price} TSh</div>` : ''}
          </div>
        </button>        
      `
    }).join('')

    return `
      <div class="screen">
        <button class="back-button" data-action="handleBack">← Back</button>
        <h2>Retail Stores</h2>
        <p class="screen-copy">
          Showing shops stocking "${this.searchQuery}" in Class ${this.selectedClass || 'Any'}${this.budget ? ` with a budget of ${this.budget} TSh` : ''}.
        </p>
        <div class="cards-grid">
          ${shopsHtml || '<div class="empty-state">No shops matched this query.</div>'}
        </div>
      </div>
    `
  }

  handleShopSelect(shopId) {
    this.selectedShopId = shopId
    this.navigateTo(9)
  }

  renderProductDetailsScreen() {
    const selectedShop = this.shops.find((shop) => shop.id === this.selectedShopId) || this.shops[0]
    const selectedProductMatches = this.products.filter((product) => {
      if (!this.selectedShopId) return false
      if (product.shopId !== this.selectedShopId) return false
      if (this.selectedClass && product.class !== this.selectedClass) return false
      if (this.searchQuery && !product.name.toLowerCase().includes(this.searchQuery.toLowerCase()) && 
          !product.description.toLowerCase().includes(this.searchQuery.toLowerCase())) return false
      if (this.budget && product.price > Number(this.budget)) return false
      return true
    })

    const productsHtml = selectedProductMatches.map(product => {
      const withinBudget = this.budget ? product.price <= Number(this.budget) : true
      return `
        <div class="product-detail-card">
          <div class="detail-left">
            <img src="${product.image}" alt="${product.name}" />
          </div>
          <div class="detail-right">
            <strong>${product.name}</strong>
            <p>${product.description}</p>
            <div class="chip-row">
              <span class="chip">Class ${product.class}</span>
              <span class="chip">${product.availability}</span>
            </div>
            <div class="price-row">
              <span class="price-tag">${product.price} TSh</span>
              <span class="budget-pill ${withinBudget ? 'green' : 'red'}">
                ${withinBudget ? 'Within Budget' : 'Over Budget'}
              </span>
            </div>
          </div>
        </div>
      `
    }).join('')

    return `
      <div class="screen">
        <button class="back-button" data-action="handleBack">← Back</button>
        <h2>Availability Details</h2>
        <p class="screen-copy">Verified listings for "${this.searchQuery}" in Class ${this.selectedClass || 'Any'}.</p>
        <div class="detail-card">
          <div>
            <span class="detail-label">Selected Distributor</span>
            <h3>${selectedShop.name}</h3>
            <p>${selectedShop.description}</p>
          </div>
          <span class="rating-pill">★ ${selectedShop.rating}</span>
        </div>
        ${selectedProductMatches.length === 0 ? 
          '<div class="empty-state">No products match your exact filters.</div>' : 
          productsHtml}
        <div class="contact-card">
          <div>
            <span class="detail-label">Phone Contact</span>
            <strong>${selectedShop.phone}</strong>
          </div>
          <div>
            <span class="detail-label">Physical Location</span>
            <strong>${selectedShop.location}</strong>
          </div>
        </div>
        <button class="button-solid" data-action="navigateTo" data-param="10">Show Physical Map Location</button>
      </div>
    `
  }

  renderMapScreen() {
    const selectedShop = this.shops.find((shop) => shop.id === this.selectedShopId) || this.shops[0]
    return `
      <div class="screen">
        <button class="back-button" data-action="handleBack">← Back</button>
        <h2>Navigation Path</h2>
        <p class="screen-copy">Follow the map guidance from your current location to the selected stall.</p>
        <div class="map-shell">
          <div id="map-canvas" class="map-canvas"></div>
          <div id="map-overlay" class="map-overlay">Loading map…</div>
        </div>
        <div class="map-stats">
          <div>
            <span class="detail-label">Selected Stall</span>
            <strong>${selectedShop.name}</strong>
          </div>
          <div>
            <span class="detail-label">Distance</span>
            <strong id="distance-text">Fetching GPS...</strong>
          </div>
        </div>
        <button class="button-outline" data-action="openGoogleMaps">Open in Google Maps</button>
        <button class="button-solid" data-action="handleRestart">Back to Selection</button>
      </div>
    `
  }

  async renderMapScreenAfter() {
    const selectedShop = this.shops.find((shop) => shop.id === this.selectedShopId) || this.shops[0]
    const mapCanvas = document.getElementById('map-canvas')
    const mapOverlay = document.getElementById('map-overlay')

    if (!GOOGLE_MAPS_KEY) {
      mapOverlay.innerHTML = 'Google Maps API key not set.'
      return
    }

    try {
      if (!this.mapLoader) {
        this.mapLoader = new Loader({ apiKey: GOOGLE_MAPS_KEY, version: 'weekly' })
      }

      await this.mapLoader.load()

      const shopLatLng = new google.maps.LatLng(selectedShop.latitude, selectedShop.longitude)
      this.mapInstance = new google.maps.Map(mapCanvas, {
        center: shopLatLng,
        zoom: 14,
      })
      new google.maps.Marker({ position: shopLatLng, map: this.mapInstance, title: selectedShop.name })

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const userLatLng = { lat: position.coords.latitude, lng: position.coords.longitude }
            const distanceKm = calculateDistance(userLatLng.lat, userLatLng.lng, selectedShop.latitude, selectedShop.longitude)
            document.getElementById('distance-text').textContent = `${distanceKm.toFixed(2)} km`

            const path = [new google.maps.LatLng(userLatLng.lat, userLatLng.lng), shopLatLng]
            new google.maps.Polyline({
              path,
              strokeColor: getPathColor(distanceKm),
              strokeOpacity: 0.85,
              strokeWeight: 6,
              map: this.mapInstance,
            })

            new google.maps.Marker({ position: userLatLng, map: this.mapInstance, title: 'Your location' })
            const bounds = new google.maps.LatLngBounds()
            bounds.extend(shopLatLng)
            bounds.extend(userLatLng)
            this.mapInstance.fitBounds(bounds)
            mapOverlay.style.display = 'none'
          },
          () => {
            mapOverlay.style.display = 'none'
          },
          { enableHighAccuracy: true, timeout: 8000 }
        )
      } else {
        mapOverlay.style.display = 'none'
      }
    } catch (err) {
      console.error('Map failed:', err)
      mapOverlay.innerHTML = 'Failed to load Google Maps.'
    }
  }

  openGoogleMaps() {
    const selectedShop = this.shops.find((shop) => shop.id === this.selectedShopId) || this.shops[0]
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${selectedShop.latitude},${selectedShop.longitude}`,
      '_blank'
    )
  }

  handleRestart() {
    this.userType = null
    this.searchQuery = 'Charger'
    this.budget = ''
    this.selectedClass = 'B'
    this.selectedShopId = null
    this.navigateTo(1)
  }

  renderRegisteredShopsScreen() {
    const shopsHtml = this.shops.map(shop => `
      <button class="shop-card" data-action="handleShopSelect" data-param="${shop.id}">
        <img src="${shop.image}" alt="${shop.name}" />
        <div class="shop-content">
          <strong>${shop.name}</strong>
          <p>${shop.location}</p>
        </div>
      </button>
    `).join('')

    return `
      <div class="screen">
        <button class="back-button" data-action="handleBack">← Back</button>
        <h2>Registered Shops</h2>
        <p class="screen-copy">Browse the full store catalog and choose a shop to explore.</p>
        <div class="cards-grid">
          ${shopsHtml}
        </div>
      </div>
    `
  }

  renderAdminLoginScreen() {
    return `
      <div class="screen">
        <button class="back-button" data-action="handleBack">← Back</button>
        <h2>Admin Login</h2>
        <p class="screen-copy">Use the administrator credentials to manage vendor registrations.</p>
        <label class="field-group">
          <span>Admin Username</span>
          <input id="admin-username" />
        </label>
        <label class="field-group">
          <span>Password</span>
          <input type="password" id="admin-password" />
        </label>
        <div id="admin-error"></div>
        <button class="button-solid" data-action="handleAdminLogin">Verify & Enter</button>
      </div>
    `
  }

  handleAdminLogin() {
    const username = document.getElementById('admin-username').value
    const password = document.getElementById('admin-password').value
    const errorDiv = document.getElementById('admin-error')

    if (username.trim() === 'admin' && password === '1234') {
      this.navigateTo(13)
    } else {
      errorDiv.innerHTML = '<div class="alert-box">Invalid admin credentials.</div>'
    }
  }

  renderAdminDashboardScreen() {
    const vendorsHtml = this.shops.map(vendor => `
      <div class="vendor-card">
        <div>
          <strong>@${vendor.username}</strong>
          <p>${vendor.name}</p>
          <p>${vendor.phone}</p>
        </div>
        <button class="button-text red" data-action="handleVendorDelete" data-param="${vendor.id}">Delete</button>
      </div>
    `).join('')

    return `
      <div class="screen">
        <button class="back-button" data-action="handleBack">← Back</button>
        <h2>Admin Dashboard</h2>
        <p class="screen-copy">Manage the vendor registry and remove stalls from the catalog.</p>
        <div class="vendor-list">
          ${vendorsHtml}
        </div>
      </div>
    `
  }

  handleVendorDelete(vendorId) {
    deleteVendor(vendorId).then(success => {
      if (success) {
        showToast('Vendor removed from the system.')
        recordInteraction('vendor_deleted', { vendorId })
        this.render()
      } else {
        showToast('Unable to remove the vendor.')
      }
    })
  }
}

// ============================================================================
// INIT APP
// ============================================================================

let app = null

document.addEventListener('DOMContentLoaded', () => {
  app = new KariakooApp()
  
  // Setup event delegation for dynamic content
  document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]')
    if (!target || !app) return
    
    const action = target.getAttribute('data-action')
    const param = target.getAttribute('data-param')
    
    if (app[action]) {
      if (param) {
        app[action](param)
      } else {
        app[action]()
      }
    }
  })
  
  // Render map screen after DOM is ready if on screen 10
  setTimeout(() => {
    if (app.activeScreen === 10) {
      app.renderMapScreenAfter()
    }
  }, 100)
})

// Watch for screen changes
const originalNavigateTo = KariakooApp.prototype.navigateTo
KariakooApp.prototype.navigateTo = function(screen) {
  originalNavigateTo.call(this, screen)
  if (screen === 10) {
    setTimeout(() => this.renderMapScreenAfter(), 100)
  }
}

export { app }
