import {
  initFirebase,
  signInVendor,
  signUpVendor,
  observeProducts,
  observeShops,
  recordInteraction,
  saveProduct,
  saveShop,
  deleteProduct,
  deleteVendor,
  seedInitialDataIfEmpty,
} from './firebase.js'
import { initialProducts, initialShops } from './src/data.js'

function loadGoogleMapsApi(apiKey) {
  if (window.google?.maps) {
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-google-maps]')
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Google Maps script failed to load.')))
      return
    }

    const script = document.createElement('script')
    script.setAttribute('data-google-maps', 'true')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`
    script.async = true
    script.defer = true
    script.onload = () => {
      if (window.google?.maps) {
        resolve()
      } else {
        reject(new Error('Google Maps loaded but google.maps is not available.'))
      }
    }
    script.onerror = () => reject(new Error('Google Maps script failed to load.'))
    document.head.appendChild(script)
  })
}

async function uploadProductImage(file) {
  const formData = new FormData()
  formData.append('image', file)

  const response = await fetch('/api/upload.php', {
    method: 'POST',
    body: formData,
  })

  const result = await response.json().catch(() => null)
  if (!response.ok || !result || !result.success || !result.url) {
    throw new Error(result?.message || 'Image upload failed.')
  }

  return result.url
}

class KariakooApp {
  constructor(googleMapsKey) {
    this.googleMapsKey = googleMapsKey
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
    this.vendorShopImage = 'https://images.unsplash.com/photo-1488459711435-07859c07a58b?auto=format&fit=crop&q=80&w=400'
    this.vendorIsRegistered = false
    this.vendorAuthMode = 'login'
    this.productQuality = 'B'
    this.productImage = ''
    this.productImageFile = null
    this.productImagePreview = ''
    this.shops = initialShops
    this.products = initialProducts
    this.feedbackEntries = []
    this.toastTimeout = null
    this.mapLoader = null
    this.mapInstance = null
    this.userStartLocation = null
    this.userLocationRequestPending = false
    this.vendorLocationAutoCaptured = false
    this.vendorLocationCapturePending = false
    this.rootElement = document.getElementById('root')
  }

  async init() {
    await seedInitialDataIfEmpty()
    this.captureUserStartLocation()

    observeShops((shops) => {
      this.shops = shops
      this.render()
    })

    observeProducts((products) => {
      this.products = products
      this.render()
    })

    document.addEventListener('click', (event) => {
      const target = event.target.closest('[data-action]')
      if (!target) {
        return
      }
      event.preventDefault()
      const action = target.dataset.action
      const param = target.dataset.param
      if (!action || typeof this[action] !== 'function') {
        return
      }

      const parsedParam = param !== undefined && !Number.isNaN(Number(param)) ? Number(param) : param
      if (action === 'navigateTo') {
        this.navigateTo(parsedParam)
      } else if (action === 'selectQuality') {
        this.selectQuality(parsedParam, target)
      } else if (param !== undefined) {
        this[action](parsedParam)
      } else {
        this[action]()
      }
    })

    this.render()
  }

  showToast(message) {
    const existing = document.querySelector('.toast-message')
    if (existing) {
      existing.remove()
    }

    const toast = document.createElement('div')
    toast.className = 'toast-message'
    toast.textContent = message
    document.body.appendChild(toast)

    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout)
    }

    this.toastTimeout = window.setTimeout(() => {
      toast.remove()
      this.toastTimeout = null
    }, 3500)
  }

  navigateTo(screen) {
    this.activeScreen = Number(screen)
    this.render()
  }

  async captureUserStartLocation() {
    if (this.userStartLocation || this.userLocationRequestPending || typeof navigator === 'undefined' || !navigator.geolocation) {
      return this.userStartLocation
    }

    this.userLocationRequestPending = true
    try {
      const location = await new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 8000 },
        )
      })

      this.userStartLocation = location
      return this.userStartLocation
    } finally {
      this.userLocationRequestPending = false
    }
  }

  async captureVendorRegistrationLocation() {
    if (this.vendorLocationAutoCaptured || this.vendorLocationCapturePending || typeof navigator === 'undefined' || !navigator.geolocation) {
      return null
    }

    this.vendorLocationCapturePending = true
    try {
      const location = await new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 8000 },
        )
      })

      if (location) {
        this.vendorLat = location.lat
        this.vendorLng = location.lng
        this.vendorLocationAutoCaptured = true
        this.render()
      }

      return location
    } finally {
      this.vendorLocationCapturePending = false
    }
  }

  handleBack() {
    switch (this.activeScreen) {
      case 2:
      case 6:
      case 12:
      case 14:
        this.activeScreen = 1
        break
      case 3:
        this.activeScreen = 2
        break
      case 4:
        this.activeScreen = 3
        break
      case 5:
        this.activeScreen = 4
        break
      case 7:
        this.activeScreen = 6
        break
      case 8:
        this.activeScreen = 7
        break
      case 9:
        this.activeScreen = 8
        break
      case 10:
        this.activeScreen = 9
        break
      case 11:
        this.activeScreen = 6
        break
      case 13:
        this.activeScreen = 12
        break
      default:
        this.activeScreen = 1
    }
    this.render()
  }

  handleSelectionNext() {
    if (!this.userType) {
      this.showToast('Please select a role before continuing.')
      return
    }
    recordInteraction('navigate_next', { from: 'selection', role: this.userType })
    this.activeScreen = this.userType === 'vendor' ? 2 : 6
    this.render()
  }

  async handleVendorLogin() {
    const username = document.getElementById('vendor-username')?.value || ''
    const password = document.getElementById('vendor-password')?.value || ''

    if (this.vendorAuthMode === 'register') {
      await this.handleVendorRegister(username, password)
      return
    }

    const result = await signInVendor(username, password)
    if (!result.success) {
      this.showToast(result.message || 'Login failed')
      return
    }

    const existingShop = this.shops.find((shop) => shop.username === username)
    this.vendorUsername = username
    this.vendorPassword = password

    if (existingShop) {
      this.vendorPhone = existingShop.phone
      this.vendorLocation = existingShop.location
      this.vendorLat = existingShop.latitude
      this.vendorLng = existingShop.longitude
      this.vendorShopName = existingShop.name
      this.vendorShopImage = existingShop.image
      this.vendorIsRegistered = true
      this.activeScreen = 4
    } else {
      this.vendorIsRegistered = false
      this.activeScreen = 3
    }

    this.render()
  }

  async handleVendorRegister(username, password) {
    const phone = document.getElementById('vendor-phone')?.value || ''
    const location = document.getElementById('vendor-location')?.value || ''
    const latitude = parseFloat(document.getElementById('vendor-lat')?.value) || -6.8235
    const longitude = parseFloat(document.getElementById('vendor-lng')?.value) || 39.2790

    const result = await signUpVendor(username, password)
    if (!result.success) {
      this.showToast(result.message || 'Registration failed')
      return
    }

    this.vendorUsername = username
    this.vendorPassword = password
    this.vendorPhone = phone
    this.vendorLocation = location
    this.vendorLat = latitude
    this.vendorLng = longitude
    this.vendorShopImage = 'https://images.unsplash.com/photo-1488459711435-07859c07a58b?auto=format&fit=crop&q=80&w=400'
    this.vendorIsRegistered = false
    this.activeScreen = 3
    this.render()
  }

  handleUserType(role) {
    this.userType = role
    recordInteraction('select_role', role)
    this.render()
  }

  showImageInfo() {
    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.accept = 'image/*'
    fileInput.style.display = 'none'
    fileInput.addEventListener('change', (event) => {
      const files = event.target.files
      if (!files || files.length === 0) {
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          this.vendorShopImage = reader.result
          this.render()
        }
      }
      reader.readAsDataURL(files[0])
    })
    document.body.appendChild(fileInput)
    fileInput.click()
    fileInput.remove()
  }

  toggleVendorMode() {
    this.vendorAuthMode = this.vendorAuthMode === 'login' ? 'register' : 'login'
    this.render()
  }

  async handleSaveProduct() {
    const name = document.getElementById('product-name')?.value || ''
    const price = Number(document.getElementById('product-price')?.value) || 0
    const stock = Number(document.getElementById('product-stock')?.value) || 0
    const description = document.getElementById('product-desc')?.value || ''
    const shopId = `shop_${this.vendorUsername}`
    let image = 'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?auto=format&fit=crop&q=80&w=300'

    if (this.productImageFile) {
      try {
        image = await uploadProductImage(this.productImageFile)
      } catch (error) {
        this.showToast(error?.message || 'Image upload failed.')
        return
      }
    } else if (this.productImage) {
      image = this.productImage
    }

    const product = {
      id: `prod_${Date.now()}`,
      name: name || 'New Item',
      description: description || 'No description provided.',
      price,
      image,
      category: 'General',
      class: this.productQuality || 'B',
      shopId,
      availability: 'Immediate Stock',
      stock,
    }

    const success = await saveProduct(product)
    if (success) {
      this.showToast('Product catalog updated successfully.')
      recordInteraction('product_added', { shopId, productId: product.id })
      this.dismissProductModal()
      this.render()
    } else {
      this.showToast('Failed to save the product. Please try again.')
    }
  }

  async handleShopSave() {
    const shopName = document.getElementById('shop-name')?.value || ''
    const shopLocation = document.getElementById('shop-location')?.value || ''
    const shopLat = parseFloat(document.getElementById('shop-lat')?.value) || -6.8235
    const shopLng = parseFloat(document.getElementById('shop-lng')?.value) || 39.2790

    const newShop = {
      id: `shop_${this.vendorUsername}`,
      name: shopName || 'Kariakoo Stall',
      username: this.vendorUsername,
      phone: this.vendorPhone,
      password: this.vendorPassword,
      image: this.vendorShopImage,
      description: 'Verified Kariakoo Merchant',
      location: shopLocation || 'Kariakoo Market Center',
      category: 'General',
      rating: 5.0,
      latitude: shopLat,
      longitude: shopLng,
      tags: ['New'],
    }

    const saved = await saveShop(newShop)
    if (!saved) {
      this.showToast('Unable to register the shop. Try again.')
      return
    }

    this.vendorShopName = newShop.name
    this.vendorLocation = newShop.location
    this.vendorLat = newShop.latitude
    this.vendorLng = newShop.longitude
    this.vendorIsRegistered = true
    recordInteraction('vendor_registered', { vendor: this.vendorUsername, shop: newShop.id })
    this.activeScreen = 4
    this.render()
  }

  async handleAddProduct(product) {
    const success = await saveProduct(product)
    if (success) {
      this.showToast('Product catalog updated successfully.')
      recordInteraction('product_added', { shopId: product.shopId, productId: product.id })
      this.productImage = ''
      this.render()
    } else {
      this.showToast('Failed to save the product. Please try again.')
    }
  }

  async handleDeleteProduct(productId) {
    const success = await deleteProduct(productId)
    if (success) {
      this.showToast('Product removed successfully.')
      recordInteraction('product_deleted', { productId })
      this.render()
    } else {
      this.showToast('Failed to delete the product.')
    }
  }

  handleCloseShop() {
    this.userType = null
    this.vendorUsername = ''
    this.vendorPhone = ''
    this.vendorPassword = ''
    this.vendorLocation = ''
    this.vendorLat = -6.8235
    this.vendorLng = 39.2790
    this.vendorShopName = ''
    this.vendorShopImage = 'https://images.unsplash.com/photo-1488459711435-07859c07a58b?auto=format&fit=crop&q=80&w=400'
    this.vendorIsRegistered = false
    this.activeScreen = 1
    this.render()
  }

  async handleVendorDelete(vendorId) {
    const success = await deleteVendor(vendorId)
    if (success) {
      this.showToast('Vendor removed from the system.')
      recordInteraction('vendor_deleted', { vendorId })
      this.render()
    } else {
      this.showToast('Unable to remove the vendor.')
    }
  }

  handleCustomerSearch() {
    const query = document.getElementById('search-query')?.value || ''
    const budget = document.getElementById('search-budget')?.value || ''
    this.searchQuery = query
    this.budget = budget
    recordInteraction('perform_search', { query: this.searchQuery, budget: this.budget })
    this.activeScreen = 7
    this.render()
  }

  quickSearch(term) {
    this.searchQuery = term
    this.budget = ''
    recordInteraction('perform_search', { query: term, budget: '' })
    this.activeScreen = 7
    this.render()
  }

  handleClassSelect(value) {
    this.selectedClass = value
    recordInteraction('class_selected', value)
    this.activeScreen = 8
    this.render()
  }

  handleShopSelect(shopId) {
    this.selectedShopId = shopId
    this.activeScreen = 9
    this.render()
  }

  handleAdminLogin() {
    const username = document.getElementById('admin-username')?.value || ''
    const password = document.getElementById('admin-password')?.value || ''
    const errorBox = document.getElementById('admin-error')

    if (username.trim() === 'admin' && password === '1234') {
      this.activeScreen = 13
    } else {
      if (errorBox) {
        errorBox.innerHTML = '<div class="alert-box">Invalid admin credentials.</div>'
      }
    }
    this.render()
  }

  handleRestart() {
    this.userType = null
    this.searchQuery = 'Charger'
    this.budget = ''
    this.selectedClass = 'B'
    this.selectedShopId = null
    this.activeScreen = 1
    this.render()
  }

  getProductFamilyKey(product) {
    const name = (product?.name || '').toLowerCase()
    const cleaned = name
      .replace(/[^\w\s]/g, ' ')
      .replace(/\b(premium|standard|basic|economy|class|grade|item|product)\b/g, ' ')
      .trim()
    const words = cleaned.split(/\s+/).filter(Boolean)
    const meaningfulWords = words.filter((word) => word.length > 2 && !['the', 'and', 'for', 'with', 'from'].includes(word))
    return meaningfulWords.join(' ') || name
  }

  getProductPriceRange(product) {
    const familyKey = this.getProductFamilyKey(product)
    const comparableProducts = this.products.filter((candidate) => {
      if (!candidate || candidate.id === product.id) {
        return false
      }

      const candidateKey = this.getProductFamilyKey(candidate)
      if (!candidateKey || !familyKey) {
        return false
      }

      return candidateKey === familyKey || (candidate.category === product.category && (candidateKey.includes(familyKey) || familyKey.includes(candidateKey)))
    })

    const prices = [product, ...comparableProducts].map((entry) => Number(entry.price) || 0)
    if (prices.length === 0) {
      return { minPrice: 0, maxPrice: 0, meanPrice: 0 }
    }

    const meanPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length
    const spread = Math.max(1000, Math.round(meanPrice * 0.15))

    return {
      minPrice: Math.max(0, Math.round(meanPrice - spread)),
      maxPrice: Math.round(meanPrice + spread),
      meanPrice: Math.round(meanPrice),
    }
  }

  getFeedbackEntries() {
    if (typeof window === 'undefined' || !window.localStorage) {
      return []
    }

    try {
      const raw = window.localStorage.getItem('kariakoo-feedback-entries')
      if (!raw) {
        return []
      }

      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch (error) {
      console.error('Unable to load feedback entries', error)
      return []
    }
  }

  handleSubmitFeedback() {
    const title = document.getElementById('feedback-title')?.value?.trim() || ''
    const name = document.getElementById('feedback-name')?.value?.trim() || 'Anonymous'
    const category = document.getElementById('feedback-category')?.value || 'Report'
    const message = document.getElementById('feedback-message')?.value?.trim() || ''

    if (!title || !message) {
      this.showToast('Please add a title and your feedback details.')
      return
    }

    const entry = {
      id: `feedback_${Date.now()}`,
      title,
      name,
      category,
      message,
      createdAt: new Date().toISOString(),
    }

    const nextEntries = [entry, ...this.getFeedbackEntries()].slice(0, 12)
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('kariakoo-feedback-entries', JSON.stringify(nextEntries))
    }

    this.showToast('Your feedback has been published.')
    this.render()
  }

  getSelectedShop() {
    return this.shops.find((shop) => shop.id === this.selectedShopId) ?? this.shops[0]
  }

  getMatchingShops() {
    return this.shops.filter((shop) => {
      return this.products.some((product) => {
        if (product.shopId !== shop.id) return false
        if (this.selectedClass && product.class !== this.selectedClass) return false
        if (this.searchQuery && !product.name.toLowerCase().includes(this.searchQuery.toLowerCase()) && !product.description.toLowerCase().includes(this.searchQuery.toLowerCase())) return false
        if (this.budget && product.price > Number(this.budget)) return false
        return true
      })
    })
  }

  render() {
    if (!this.rootElement) {
      return
    }

    if (this.activeScreen === 3 && !this.vendorLocationAutoCaptured && !this.vendorLocationCapturePending) {
      this.captureVendorRegistrationLocation()
    }

    if (this.activeScreen === 10 && !this.userStartLocation && !this.userLocationRequestPending) {
      this.captureUserStartLocation()
    }

    this.rootElement.innerHTML = `
      <div class="app-shell">
        <div class="app-frame">
          <div class="hero-bar">
            <div>
              <div class="brand">Kariakoo Market</div>
              <div class="brand-subtitle">Web marketplace with vendor cataloging, customer search, and map navigation.</div>
             
            </div>
            
            <div class="hero-actions">
              ${this.activeScreen === 1 ? `
                <button class="button-text admin-button" data-action="navigateTo" data-param="14">Feedback & Blog</button>
                <button class="button-text admin-button" data-action="navigateTo" data-param="12">Admin Access</button>
              ` : ''}
            </div>
          </div>
          <div class="screen-container">
            ${this.renderCurrentScreen()}
          </div>
        </div>
      </div>
    `

    if (this.activeScreen === 10) {
      setTimeout(() => this.renderMapScreenAfter(), 100)
    }
  }

  renderCurrentScreen() {
    switch (this.activeScreen) {
      case 1:
        return this.renderSelectionScreen()
      case 2:
        return this.renderVendorAuthScreen()
      case 3:
        return this.renderShopRegistrationScreen()
      case 4:
        return this.renderShopPreviewScreen()
      case 5:
        return this.renderProductManagementScreen()
      case 6:
        return this.renderCustomerSearchScreen()
      case 7:
        return this.renderClassSelectionScreen()
      case 8:
        return this.renderShopsListScreen()
      case 9:
        return this.renderProductDetailsScreen()
      case 10:
        return this.renderMapScreen()
      case 11:
        return this.renderRegisteredShopsScreen()
      case 12:
        return this.renderAdminLoginScreen()
      case 13:
        return this.renderAdminDashboardScreen()
      case 14:
        return this.renderFeedbackScreen()
      default:
        return this.renderSelectionScreen()
    }
  }

  renderSelectionScreen() {
    return `
      <div class="screen">
        <h2>Who are you?</h2>
        <p class="screen-copy">Identify your role to access specialized Kariakoo Market tools and fair-price indexing.</p>
        <div class="role-grid">
          <button class="role-card ${this.userType === 'customer' ? 'role-card-selected' : ''}" data-action="handleUserType" data-param="customer">
            <div class="role-symbol">C</div>
            <div>
              <strong>Customer</strong>
              <p>Search items across Class A, B, C and find the best vendor with fair prices.</p>
            </div>
          </button>
          <button class="role-card ${this.userType === 'vendor' ? 'role-card-selected' : ''}" data-action="handleUserType" data-param="vendor">
            <div class="role-symbol">V</div>
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

  renderVendorAuthScreen() {
    return `
      <div class="screen">
        <button class="back-button" data-action="handleBack">← Back</button>
        <h2>${this.vendorAuthMode === 'login' ? 'Vendor Sign In' : 'Vendor Registration'}</h2>
        <p class="screen-copy">
          ${this.vendorAuthMode === 'login'
            ? 'Sign in to manage your shop listing and product catalog.'
            : 'Create a vendor account to register your stall and start selling.'}
        </p>
        ${this.vendorAuthMode === 'register' ? `
          <label class="field-group">
            <span>Phone Number</span>
            <input id="vendor-phone" value="${this.vendorPhone}" placeholder="+255 700 000 000" />
          </label>
        ` : ''}
        <label class="field-group">
          <span>Username / Business Code</span>
          <input id="vendor-username" value="${this.vendorUsername}" placeholder="e.g. msimbazi_digital" />
        </label>
        <label class="field-group">
          <span>Password</span>
          <input type="password" id="vendor-password" value="${this.vendorPassword}" placeholder="At least 6 characters" />
        </label>
        ${this.vendorAuthMode === 'register' ? `
          <label class="field-group">
            <span>Physical Stall Location</span>
            <input id="vendor-location" value="${this.vendorLocation}" placeholder="Msimbazi Street, Block E" />
          </label>
          <div class="field-row">
            <label class="field-group half-width">
              <span>Latitude</span>
              <input id="vendor-lat" value="${this.vendorLat}" placeholder="-6.8235" />
            </label>
            <label class="field-group half-width">
              <span>Longitude</span>
              <input id="vendor-lng" value="${this.vendorLng}" placeholder="39.2790" />
            </label>
          </div>
        ` : ''}
        <button class="button-solid" data-action="handleVendorLogin">
          ${this.vendorAuthMode === 'login' ? 'Submit & Sign In' : 'Submit Registration'}
        </button>
        <button class="button-outline" data-action="toggleVendorMode">
          ${this.vendorAuthMode === 'login' ? 'New vendor? Register here' : 'Already registered? Sign in'}
        </button>
      </div>
    `
  }

  renderShopRegistrationScreen() {
    return `
      <div class="screen">
        <button class="back-button" data-action="handleBack">← Back</button>
        <h2>Shop Registration</h2>
        <p class="screen-copy">Provide a shop name, image, and physical stall details.</p>
        <div class="image-picker" data-action="showImageInfo">
          <img src="${this.vendorShopImage}" alt="Shop preview" />
          <span>Click to choose a shop image</span>
        </div>
        <label class="field-group">
          <span>Shop / Stall Name</span>
          <input id="shop-name" value="${this.vendorShopName}" placeholder="Kariakoo Stall Name" />
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
    const shopProducts = this.products.filter((product) => product.shopId === shopId)
    const productsHtml = shopProducts
      .map((product) => `
        <div class="product-card">
          <img src="${product.image}" alt="${product.name}" />
          <div class="product-content">
            <div class="product-header">
              <strong>${product.name}</strong>
              <span class="price-tag">${product.price} TSh</span>
            </div>
            <div class="price-range">Market range: ${this.getProductPriceRange(product).minPrice.toLocaleString()}–${this.getProductPriceRange(product).maxPrice.toLocaleString()} TSh</div>
            <p>${product.description}</p>
            <div class="chip-row">
              <span class="chip">Class ${product.class}</span>
              <span class="chip">${product.availability}</span>
            </div>
            <div class="product-actions">
              <button class="button-text red" data-action="handleDeleteProduct" data-param="${product.id}">Delete</button>
            </div>
          </div>
        </div>
      `)
      .join('')

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
        <div id="product-modal"></div>
      </div>
    `
  }

  showAddProductModal() {
    this.productQuality = 'B'
    this.productImage = ''
    this.productImageFile = null
    this.productImagePreview = ''
    const modal = document.getElementById('product-modal')
    if (!modal) {
      return
    }

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
            <small id="product-image-note" style="display: block; margin-top: 8px; color: #666;">No image selected</small>
            <img id="product-image-preview" src="" alt="Product preview" style="display:none; width:100%; max-width:260px; border-radius:12px; margin-top:12px; object-fit:cover;" />
          </label>
          <div class="field-row quality-row">
            <button class="chip-button selected" data-action="selectQuality" data-param="A">Class A</button>
            <button class="chip-button" data-action="selectQuality" data-param="B">Class B</button>
            <button class="chip-button" data-action="selectQuality" data-param="C">Class C</button>
          </div>
          <div class="modal-actions">
            <button class="button-outline" data-action="dismissProductModal">Cancel</button>
            <button class="button-solid" data-action="handleSaveProduct">Save</button>
          </div>
        </div>
      </div>
    `

    const fileInput = document.getElementById('product-image')
    const imageNote = document.getElementById('product-image-note')
    const imagePreview = document.getElementById('product-image-preview')
    if (fileInput && imageNote && imagePreview) {
      fileInput.addEventListener('change', (event) => {
        const files = event.target.files
        if (!files || files.length === 0) {
          imageNote.textContent = 'No image selected'
          imagePreview.style.display = 'none'
          this.productImage = ''
          this.productImageFile = null
          this.productImagePreview = ''
          return
        }

        const file = files[0]
        this.productImageFile = file

        const reader = new FileReader()
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            this.productImagePreview = reader.result
            this.productImage = reader.result
            imageNote.textContent = file.name
            imagePreview.src = reader.result
            imagePreview.style.display = 'block'
          }
        }
        reader.readAsDataURL(file)
      })
    }
  }

  dismissProductModal() {
    const modal = document.getElementById('product-modal')
    if (modal) {
      modal.innerHTML = ''
    }
    this.productImageFile = null
    this.productImagePreview = ''
    this.productImage = ''
  }

  selectQuality(quality, target) {
    this.productQuality = quality
    document.querySelectorAll('.quality-row .chip-button').forEach((button) => {
      button.classList.toggle('selected', button.dataset.param === quality)
    })
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
          ${['Charger', 'Kitenge', 'Cloves', 'Sandal', 'Rice']
            .map((term) => `
              <button class="chip-button" data-action="quickSearch" data-param="${term}">${term}</button>
            `)
            .join('')}
        </div>
        <div class="info-box">
          Search indexes allow comparison across three standardized marketplace quality classes A, B & C.
        </div>
      </div>
    `
  }

  renderClassSelectionScreen() {
    const classes = [
      {
        letter: 'A',
        title: 'Class A (Premium Quality)',
        description: 'Top imported grade items, certification-ready, and premium service.',
        color: '#f59e0b',
      },
      {
        letter: 'B',
        title: 'Class B (Standard Grade)',
        description: 'Excellent value performance, locally optimized pricing and reliability.',
        color: '#4f46e5',
      },
      {
        letter: 'C',
        title: 'Class C (Economy / Bulk)',
        description: 'Wholesale and budget inventory for everyday needs and large orders.',
        color: '#10b981',
      },
    ]

    return `
      <div class="screen">
        <button class="back-button" data-action="handleBack">← Back</button>
        <h2>Choose Your Class</h2>
        <p class="screen-copy">Comparing values for "${this.searchQuery}"${this.budget ? ` with a budget of ${this.budget} TSh` : ''}.</p>
        ${classes
          .map(
            (item) => `
          <button class="quality-card" data-action="handleClassSelect" data-param="${item.letter}">
            <div class="quality-badge" style="background-color: ${item.color}">${item.letter}</div>
            <div>
              <strong>${item.title}</strong>
              <p>${item.description}</p>
            </div>
          </button>
        `,
          )
          .join('')}
        <div class="info-box orange">
          In Kariakoo Market, pricing varies by quality tier. Choose the class that matches your preference.
        </div>
      </div>
    `
  }

  renderShopsListScreen() {
    const shops = this.getMatchingShops()
    const shopsHtml = shops
      .map((shop) => {
        const highlightProduct = this.products.find(
          (product) =>
            product.shopId === shop.id &&
            (!this.selectedClass || product.class === this.selectedClass) &&
            (!this.searchQuery || product.name.toLowerCase().includes(this.searchQuery.toLowerCase())),
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
      })
      .join('')

    return `
      <div class="screen">
        <button class="back-button" data-action="handleBack">← Back</button>
        <h2>Retail Stores</h2>
        <p class="screen-copy">Showing shops stocking "${this.searchQuery}" in Class ${this.selectedClass || 'Any'}${this.budget ? ` with a budget of ${this.budget} TSh` : ''}.</p>
        <div class="cards-grid">
          ${shopsHtml || '<div class="empty-state">No shops matched this query.</div>'}
        </div>
      </div>
    `
  }

  renderProductDetailsScreen() {
    const shop = this.getSelectedShop()
    const selectedProductMatches = this.products.filter((product) => {
      if (!this.selectedShopId) return false
      if (product.shopId !== this.selectedShopId) return false
      if (this.selectedClass && product.class !== this.selectedClass) return false
      if (this.searchQuery && !product.name.toLowerCase().includes(this.searchQuery.toLowerCase()) && !product.description.toLowerCase().includes(this.searchQuery.toLowerCase())) return false
      if (this.budget && product.price > Number(this.budget)) return false
      return true
    })

    const productsHtml = selectedProductMatches
      .map((product) => {
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
                <span class="budget-pill ${withinBudget ? 'green' : 'red'}">${withinBudget ? 'Within Budget' : 'Over Budget'}</span>
              </div>
              <div class="price-range">Estimated range: ${this.getProductPriceRange(product).minPrice.toLocaleString()}–${this.getProductPriceRange(product).maxPrice.toLocaleString()} TSh</div>
            </div>
          </div>
        `
      })
      .join('')

    return `
      <div class="screen">
        <button class="back-button" data-action="handleBack">← Back</button>
        <h2>Availability Details</h2>
        <p class="screen-copy">Verified listings for "${this.searchQuery}" in Class ${this.selectedClass || 'Any'}.</p>
        <div class="detail-card">
          <div>
            <span class="detail-label">Selected Distributor</span>
            <h3>${shop.name}</h3>
            <p>${shop.description}</p>
          </div>
          <span class="rating-pill">★ ${shop.rating}</span>
        </div>
        ${selectedProductMatches.length === 0 ? '<div class="empty-state">No products match your exact filters.</div>' : productsHtml}
        <div class="contact-card">
          <div>
            <span class="detail-label">Phone Contact</span>
            <strong>${shop.phone}</strong>
          </div>
          <div>
            <span class="detail-label">Physical Location</span>
            <strong>${shop.location}</strong>
          </div>
        </div>
        <button class="button-solid" data-action="navigateTo" data-param="10">Show Physical Map Location</button>
      </div>
    `
  }

  renderMapScreen() {
    const shop = this.getSelectedShop()
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
            <strong>${shop.name}</strong>
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
    const shop = this.getSelectedShop()
    const mapCanvas = document.getElementById('map-canvas')
    const mapOverlay = document.getElementById('map-overlay')
    if (!mapCanvas || !mapOverlay) {
      return
    }

    const startPoint = this.userStartLocation || (await this.captureUserStartLocation())

    if (!this.googleMapsKey) {
      mapOverlay.textContent = 'Google Maps API key not set. Add VITE_GOOGLE_MAPS_API_KEY to .env.'
      return
    }

    try {
      await loadGoogleMapsApi(this.googleMapsKey)
      const shopLatLng = new google.maps.LatLng(shop.latitude, shop.longitude)
      this.mapInstance = new google.maps.Map(mapCanvas, {
        center: shopLatLng,
        zoom: 14,
      })
      new google.maps.Marker({ position: shopLatLng, map: this.mapInstance, title: shop.name })

      if (startPoint) {
        const userLatLng = { lat: startPoint.lat, lng: startPoint.lng }
        const distanceKm = this.calculateDistance(userLatLng.lat, userLatLng.lng, shop.latitude, shop.longitude)
        const distanceLabel = document.getElementById('distance-text')
        if (distanceLabel) {
          distanceLabel.textContent = `${distanceKm.toFixed(2)} km`
        }

        const path = [new google.maps.LatLng(userLatLng.lat, userLatLng.lng), shopLatLng]
        new google.maps.Polyline({
          path,
          strokeColor: this.getPathColor(distanceKm),
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
      } else {
        mapOverlay.textContent = 'Location access was not available. Enable location permissions to see the route.'
      }
    } catch (error) {
      console.error('Google Maps failed to load', error)
      mapOverlay.textContent = 'Failed to load Google Maps. Check your API key and network.'
    }
  }

  openGoogleMaps() {
    const shop = this.getSelectedShop()
    const origin = this.userStartLocation ? `&origin=${this.userStartLocation.lat},${this.userStartLocation.lng}` : ''
    window.open(`https://www.google.com/maps/dir/?api=1${origin}&destination=${shop.latitude},${shop.longitude}`, '_blank')
  }

  renderRegisteredShopsScreen() {
    const shopsHtml = this.shops
      .map(
        (shop) => `
        <button class="shop-card" data-action="handleShopSelect" data-param="${shop.id}">
          <img src="${shop.image}" alt="${shop.name}" />
          <div class="shop-content">
            <strong>${shop.name}</strong>
            <p>${shop.location}</p>
          </div>
        </button>
      `,
      )
      .join('')

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

  renderFeedbackScreen() {
    const feedbackEntries = this.getFeedbackEntries()

    return `
      <div class="screen">
        <button class="back-button" data-action="handleBack">← Back</button>
        <h2>Feedback & Community Reports</h2>
        <p class="screen-copy">Share a concern, market note, or suggestion so the Kariakoo community can respond quickly.</p>
        <div class="feedback-form-card">
          <label class="field-group">
            <span>Your Name</span>
            <input id="feedback-name" placeholder="Optional" />
          </label>
          <label class="field-group">
            <span>Title</span>
            <input id="feedback-title" placeholder="Price inconsistency, delivery concern, or update" />
          </label>
          <label class="field-group">
            <span>Category</span>
            <select id="feedback-category">
              <option value="Report">Report</option>
              <option value="Suggestion">Suggestion</option>
              <option value="Market Note">Market Note</option>
            </select>
          </label>
          <label class="field-group">
            <span>Details</span>
            <textarea id="feedback-message" placeholder="Describe the issue or community update..."></textarea>
          </label>
          <button class="button-solid" data-action="handleSubmitFeedback">Publish Feedback</button>
        </div>
        <div class="feedback-list">
          ${feedbackEntries.length
            ? feedbackEntries
                .map(
                  (entry) => `
                  <div class="feedback-card">
                    <div class="feedback-meta">
                      <strong>${entry.title}</strong>
                      <span>${entry.category}</span>
                    </div>
                    <p>${entry.message}</p>
                    <div class="feedback-footer">
                      <span>By ${entry.name}</span>
                      <span>${new Date(entry.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                `,
                )
                .join('')
            : '<div class="empty-state">No community notes yet. Be the first to share.</div>'}
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

  renderAdminDashboardScreen() {
    const vendorsHtml = this.shops
      .map(
        (vendor) => `
        <div class="vendor-card">
          <div>
            <strong>@${vendor.username}</strong>
            <p>${vendor.name}</p>
            <p>${vendor.phone}</p>
          </div>
          <button class="button-text red" data-action="handleVendorDelete" data-param="${vendor.id}">Delete</button>
        </div>
      `,
      )
      .join('')

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

  calculateDistance(lat1, lng1, lat2, lng2) {
    const toRadians = (value) => (value * Math.PI) / 180
    const dLat = toRadians(lat2 - lat1)
    const dLng = toRadians(lng2 - lng1)
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return 6371 * c
  }

  getPathColor(distanceKm) {
    if (distanceKm <= 0.1) return '#2563eb'
    if (distanceKm <= 5.0) return '#22c55e'
    if (distanceKm <= 10.0) return '#ec4899'
    return '#ef4444'
  }
}

async function startApp() {
  try {
    const response = await fetch('/api/config.php')
    if (!response.ok) {
      throw new Error('Unable to fetch /api/config.php from the PHP backend.')
    }

    const config = await response.json()
    initFirebase(config.firebaseConfig)
    const app = new KariakooApp(config.googleMapsKey)
    window.app = app
    await app.init()
  } catch (error) {
    console.error('Unable to initialize Kariakoo Market app', error)
    const root = document.getElementById('root')
    if (root) {
      root.innerHTML = `
        <div style="padding: 2rem; font-family: Inter, system-ui, sans-serif;">
          <h1>Unable to start application</h1>
          <p>${error?.message || 'Please check the PHP backend and ensure api/config.php is accessible.'}</p>
        </div>
      `
    }
  }
}

startApp()
