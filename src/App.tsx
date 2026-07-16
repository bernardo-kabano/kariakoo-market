import { useEffect, useMemo, useRef, useState, ChangeEvent } from 'react'
import { Loader } from '@googlemaps/js-api-loader'
import {
  deleteProduct,
  deleteVendor,
  observeProducts,
  observeShops,
  recordInteraction,
  saveProduct,
  saveShop,
  seedInitialDataIfEmpty,
  signInVendor,
  signUpVendor,
} from './firebase'
import { initialProducts, initialShops } from './data'
import type { Product, Shop } from './types'
import './App.css'

const initialVendorImage =
  'https://images.unsplash.com/photo-1488459711435-07859c07a58b?auto=format&fit=crop&q=80&w=400'

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? ''

function App() {
  const [activeScreen, setActiveScreen] = useState(1)
  const [userType, setUserType] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('Charger')
  const [budget, setBudget] = useState('')
  const [selectedClass, setSelectedClass] = useState<string | null>('B')
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null)
  const [vendorUsername, setVendorUsername] = useState('')
  const [vendorPhone, setVendorPhone] = useState('')
  const [vendorPassword, setVendorPassword] = useState('')
  const [vendorLocation, setVendorLocation] = useState('')
  const [vendorLat, setVendorLat] = useState(-6.8235)
  const [vendorLng, setVendorLng] = useState(39.2790)
  const [vendorShopName, setVendorShopName] = useState('')
  const [vendorShopImage, setVendorShopImage] = useState(initialVendorImage)
  const [vendorIsRegistered, setVendorIsRegistered] = useState(false)
  const [shops, setShops] = useState<Shop[]>(initialShops)
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  useEffect(() => {
    seedInitialDataIfEmpty()
    const unsubscribeShops = observeShops(setShops)
    const unsubscribeProducts = observeProducts(setProducts)
    return () => {
      unsubscribeShops()
      unsubscribeProducts()
    }
  }, [])

  useEffect(() => {
    if (!toastMessage) return
    const timer = window.setTimeout(() => setToastMessage(null), 3500)
    return () => window.clearTimeout(timer)
  }, [toastMessage])

  const selectedShop = useMemo(
    () => shops.find((shop) => shop.id === selectedShopId) ?? shops[0],
    [shops, selectedShopId],
  )

  function navigateTo(screen: number) {
    setActiveScreen(screen)
  }

  function handleBack() {
    switch (activeScreen) {
      case 2:
      case 6:
      case 12:
        setActiveScreen(1)
        break
      case 3:
        setActiveScreen(2)
        break
      case 4:
        setActiveScreen(3)
        break
      case 5:
        setActiveScreen(4)
        break
      case 7:
        setActiveScreen(6)
        break
      case 8:
        setActiveScreen(7)
        break
      case 9:
        setActiveScreen(8)
        break
      case 10:
        setActiveScreen(9)
        break
      case 11:
        setActiveScreen(6)
        break
      case 13:
        setActiveScreen(12)
        break
      default:
        setActiveScreen(1)
    }
  }

  const handleSelectRole = (role: string) => {
    setUserType(role)
    recordInteraction('select_role', role)
  }

  const handleSelectionNext = () => {
    if (!userType) {
      setToastMessage('Please select a role before continuing.')
      return
    }
    recordInteraction('navigate_next', { from: 'selection', role: userType })
    if (userType === 'vendor') {
      navigateTo(2)
    } else {
      navigateTo(6)
    }
  }

  const handleVendorLogin = async (username: string, password: string) => {
    const result = await signInVendor(username, password)
    if (!result.success) {
      setToastMessage(result.message || 'Login failed')
      return
    }

    const existingShop = shops.find((shop) => shop.username === username)
    if (existingShop) {
      setVendorUsername(username)
      setVendorPhone(existingShop.phone)
      setVendorPassword(password)
      setVendorLocation(existingShop.location)
      setVendorLat(existingShop.latitude)
      setVendorLng(existingShop.longitude)
      setVendorShopName(existingShop.name)
      setVendorShopImage(existingShop.image)
      setVendorIsRegistered(true)
      navigateTo(4)
    } else {
      setVendorUsername(username)
      setVendorPassword(password)
      navigateTo(3)
    }
  }

  const handleVendorRegister = async (
    username: string,
    phone: string,
    password: string,
    location: string,
    latitude: number,
    longitude: number,
  ) => {
    const result = await signUpVendor(username, password)
    if (!result.success) {
      setToastMessage(result.message || 'Registration failed')
      return
    }

    setVendorUsername(username)
    setVendorPhone(phone)
    setVendorPassword(password)
    setVendorLocation(location)
    setVendorLat(latitude)
    setVendorLng(longitude)
    setVendorShopImage(initialVendorImage)
    setVendorIsRegistered(false)
    navigateTo(3)
  }

  const handleShopSave = async (shopName: string, shopImage: string) => {
    if (!vendorUsername || !vendorPhone || !vendorPassword) {
      setToastMessage('Complete vendor credentials before saving the shop.')
      return
    }

    const newShop: Shop = {
      id: `shop_${vendorUsername}`,
      name: shopName || 'Kariakoo Stall',
      username: vendorUsername,
      phone: vendorPhone,
      password: vendorPassword,
      image: shopImage || initialVendorImage,
      description: 'Verified Kariakoo Merchant',
      location: vendorLocation || 'Kariakoo Market Center',
      category: 'General',
      rating: 5.0,
      latitude: vendorLat,
      longitude: vendorLng,
      tags: ['New'],
    }

    const saved = await saveShop(newShop)
    if (!saved) {
      setToastMessage('Unable to register the shop. Try again.')
      return
    }

    setVendorShopName(newShop.name)
    setVendorShopImage(newShop.image)
    setVendorIsRegistered(true)
    recordInteraction('vendor_registered', { vendor: vendorUsername, shop: newShop.id })
    navigateTo(4)
  }

  const handleAddProduct = async (product: Product) => {
    const success = await saveProduct(product)
    if (success) {
      setToastMessage('Product catalog updated successfully.')
      recordInteraction('product_added', { shopId: product.shopId, productId: product.id })
    } else {
      setToastMessage('Failed to save the product. Please try again.')
    }
  }

  const handleDeleteProduct = async (productId: string) => {
    const success = await deleteProduct(productId)
    if (success) {
      setToastMessage('Product removed successfully.')
      recordInteraction('product_deleted', { productId })
    } else {
      setToastMessage('Failed to delete the product.')
    }
  }

  const handleVendorDelete = async (vendorId: string) => {
    const success = await deleteVendor(vendorId)
    if (success) {
      setToastMessage('Vendor removed from the system.')
      recordInteraction('vendor_deleted', { vendorId })
    } else {
      setToastMessage('Unable to remove the vendor.')
    }
  }

  const handleCustomerSearch = () => {
    recordInteraction('perform_search', { query: searchQuery, budget })
    navigateTo(7)
  }

  const handleClassSelect = (value: string) => {
    setSelectedClass(value)
    recordInteraction('class_selected', value)
    navigateTo(8)
  }

  const matchingShops = useMemo(() => {
    return shops.filter((shop) => {
      const hasProduct = products.some((product) => {
        if (product.shopId !== shop.id) return false
        if (selectedClass && product.class !== selectedClass) return false
        if (searchQuery && !product.name.toLowerCase().includes(searchQuery.toLowerCase()) && !product.description.toLowerCase().includes(searchQuery.toLowerCase())) return false
        if (budget && product.price > Number(budget)) return false
        return true
      })
      return hasProduct
    })
  }, [shops, products, searchQuery, selectedClass, budget])

  const selectedProductMatches = useMemo(() => {
    return products.filter((product) => {
      if (!selectedShopId) return false
      if (product.shopId !== selectedShopId) return false
      if (selectedClass && product.class !== selectedClass) return false
      if (searchQuery && !product.name.toLowerCase().includes(searchQuery.toLowerCase()) && !product.description.toLowerCase().includes(searchQuery.toLowerCase())) return false
      if (budget && product.price > Number(budget)) return false
      return true
    })
  }, [products, selectedShopId, selectedClass, searchQuery, budget])

  return (
    <div className="app-shell">
      <div className="app-frame">
        <div className="hero-bar">
          <div>
            <div className="brand">Kariakoo Market</div>
            <div className="brand-subtitle">Web marketplace with vendor cataloging, customer search, and map navigation.</div>
          </div>
          <div className="hero-actions">
            {activeScreen === 1 && (
              <button className="button-text admin-button" onClick={() => navigateTo(12)}>
                Admin Access
              </button>
            )}
            <div className="status-pill">Version 1.0</div>
          </div>
        </div>

        <div className="screen-container">
          {activeScreen === 1 && (
            <SelectionScreen
              userType={userType}
              onUserTypeSelect={handleSelectRole}
              onNext={handleSelectionNext}
              onAdminClick={() => navigateTo(12)}
            />
          )}

          {activeScreen === 2 && (
            <VendorAuthScreen
              onBack={handleBack}
              onLogin={handleVendorLogin}
              onRegister={handleVendorRegister}
            />
          )}

          {activeScreen === 3 && (
            <ShopRegistrationScreen
              onBack={handleBack}
              onNext={handleShopSave}
              vendorLocation={vendorLocation}
              vendorLat={vendorLat}
              vendorLng={vendorLng}
              setVendorLocation={setVendorLocation}
              setVendorLat={setVendorLat}
              setVendorLng={setVendorLng}
            />
          )}

          {activeScreen === 4 && (
            <ShopPreviewScreen
              shopName={vendorShopName}
              shopImage={vendorShopImage}
              phone={vendorPhone}
              username={vendorUsername}
              onBack={handleBack}
              onNext={() => navigateTo(5)}
            />
          )}

          {activeScreen === 5 && (
            <ProductManagementScreen
              shopId={`shop_${vendorUsername}`}
              shopName={vendorShopName}
              products={products}
              onBack={handleBack}
              onAddProduct={handleAddProduct}
              onDeleteProduct={handleDeleteProduct}
              onCloseShop={() => {
                setUserType(null)
                setVendorUsername('')
                setVendorPhone('')
                setVendorPassword('')
                setVendorLocation('')
                setVendorShopName('')
                setVendorShopImage(initialVendorImage)
                setVendorIsRegistered(false)
                navigateTo(1)
              }}
            />
          )}

          {activeScreen === 6 && (
            <CustomerSearchScreen
              searchQuery={searchQuery}
              budget={budget}
              onSearchQueryChange={setSearchQuery}
              onBudgetChange={setBudget}
              onBack={handleBack}
              onNext={handleCustomerSearch}
              onViewShops={() => navigateTo(11)}
            />
          )}

          {activeScreen === 7 && (
            <ClassSelectionScreen
              searchQuery={searchQuery}
              budget={budget}
              onBack={handleBack}
              onClassSelect={handleClassSelect}
            />
          )}

          {activeScreen === 8 && (
            <ShopsListScreen
              searchQuery={searchQuery}
              budget={budget}
              selectedClass={selectedClass}
              shops={matchingShops}
              products={products}
              onBack={handleBack}
              onShopSelect={(shopId) => {
                setSelectedShopId(shopId)
                navigateTo(9)
              }}
            />
          )}

          {activeScreen === 9 && (
            <ProductDetailsScreen
              shop={selectedShop}
              products={selectedProductMatches}
              searchQuery={searchQuery}
              budget={budget}
              selectedClass={selectedClass}
              onBack={handleBack}
              onNext={() => navigateTo(10)}
            />
          )}

          {activeScreen === 10 && (
            <MapScreen
              shop={selectedShop}
              onBack={handleBack}
              onRestart={() => {
                setUserType(null)
                setSearchQuery('Charger')
                setBudget('')
                setSelectedClass('B')
                setSelectedShopId(null)
                navigateTo(1)
              }}
            />
          )}

          {activeScreen === 11 && (
            <RegisteredShopsScreen
              shops={shops}
              onBack={handleBack}
              onShopSelect={(shopId) => {
                setSelectedShopId(shopId)
                navigateTo(9)
              }}
            />
          )}

          {activeScreen === 12 && (
            <AdminLoginScreen onBack={handleBack} onLoginSuccess={() => navigateTo(13)} />
          )}

          {activeScreen === 13 && (
            <AdminDashboardScreen registeredVendors={shops} onBack={handleBack} onDeleteVendor={handleVendorDelete} />
          )}
        </div>
      </div>

      {toastMessage && <div className="toast-message">{toastMessage}</div>}
    </div>
  )
}

function SelectionScreen({
  userType,
  onUserTypeSelect,
  onNext,
  onAdminClick,
}: {
  userType: string | null
  onUserTypeSelect: (role: string) => void
  onNext: () => void
  onAdminClick: () => void
}) {
  return (
    <div className="screen">
      <h2>Who are you?</h2>
      <p className="screen-copy">
        Identify your role to access specialized Kariakoo Market tools and fair-price indexing.
      </p>
      <div className="role-grid">
        <RoleCard
          title="Customer"
          description="Search items across Class A, B, C and find the best vendor with fair prices."
          isSelected={userType === 'customer'}
          onClick={() => onUserTypeSelect('customer')}
        />
        <RoleCard
          title="Vendor / Merchant"
          description="Register stall credentials, catalog inventory grades, and advertise availability."
          isSelected={userType === 'vendor'}
          onClick={() => onUserTypeSelect('vendor')}
        />
      </div>
      <div className="button-row">
        <button className="button-solid" onClick={onNext}>
          Send Identification
        </button>
      </div>
    </div>
  )
}

function RoleCard({
  title,
  description,
  isSelected,
  onClick,
}: {
  title: string
  description: string
  isSelected: boolean
  onClick: () => void
}) {
  return (
    <button className={`role-card ${isSelected ? 'role-card-selected' : ''}`} onClick={onClick}>
      <div className="role-symbol">{title === 'Customer' ? '👤' : '🏪'}</div>
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
    </button>
  )
}

function VendorAuthScreen({
  onBack,
  onLogin,
  onRegister,
}: {
  onBack: () => void
  onLogin: (username: string, password: string) => void
  onRegister: (username: string, phone: string, password: string, location: string, latitude: number, longitude: number) => void
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [location, setLocation] = useState('')
  const [latitude, setLatitude] = useState('-6.8235')
  const [longitude, setLongitude] = useState('39.2790')

  return (
    <div className="screen">
      <button className="back-button" onClick={onBack}>
        ← Back
      </button>
      <h2>{mode === 'login' ? 'Vendor Sign In' : 'Vendor Registration'}</h2>
      <p className="screen-copy">
        {mode === 'login'
          ? 'Sign in to manage your shop listing and product catalog.'
          : 'Create a vendor account to register your stall and start selling.'}
      </p>
      {mode === 'register' && (
        <label className="field-group">
          <span>Phone Number</span>
          <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+255 700 000 000" />
        </label>
      )}
      <label className="field-group">
        <span>Username / Business Code</span>
        <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="e.g. msimbazi_digital" />
      </label>
      <label className="field-group">
        <span>Password</span>
        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" />
      </label>
      {mode === 'register' && (
        <>
          <label className="field-group">
            <span>Physical Stall Location</span>
            <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Msimbazi Street, Block E" />
          </label>
          <div className="field-row">
            <label className="field-group half-width">
              <span>Latitude</span>
              <input value={latitude} onChange={(event) => setLatitude(event.target.value)} placeholder="-6.8235" />
            </label>
            <label className="field-group half-width">
              <span>Longitude</span>
              <input value={longitude} onChange={(event) => setLongitude(event.target.value)} placeholder="39.2790" />
            </label>
          </div>
        </>
      )}
      <button
        className="button-solid"
        onClick={() => {
          if (mode === 'login') {
            onLogin(username.trim(), password)
          } else {
            onRegister(username.trim(), phone.trim(), password, location.trim(), Number(latitude) || -6.8235, Number(longitude) || 39.2790)
          }
        }}
      >
        {mode === 'login' ? 'Submit & Sign In' : 'Submit Registration'}
      </button>
      <button className="button-outline" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
        {mode === 'login' ? 'New vendor? Register here' : 'Already registered? Sign in'}
      </button>
    </div>
  )
}

function ShopRegistrationScreen({
  onBack,
  onNext,
  vendorLocation,
  vendorLat,
  vendorLng,
  setVendorLocation,
  setVendorLat,
  setVendorLng,
}: {
  onBack: () => void
  onNext: (shopName: string, shopImage: string) => void
  vendorLocation: string
  vendorLat: number
  vendorLng: number
  setVendorLocation: (value: string) => void
  setVendorLat: (value: number) => void
  setVendorLng: (value: number) => void
}) {
  const [shopName, setShopName] = useState('')
  const [shopImage, setShopImage] = useState(initialVendorImage)

  return (
    <div className="screen">
      <button className="back-button" onClick={onBack}>
        ← Back
      </button>
      <h2>Shop Registration</h2>
      <p className="screen-copy">Provide a shop name, image, and physical stall details.</p>
      <div className="image-picker" onClick={() => window.alert('Image uploads are simulated in this web version.')}> 
        <img src={shopImage} alt="Shop preview" />
        <span>Click to choose a shop image</span>
      </div>
      <label className="field-group">
        <span>Shop / Stall Name</span>
        <input value={shopName} onChange={(event) => setShopName(event.target.value)} placeholder="Kariakoo Stall Name" />
      </label>
      <label className="field-group">
        <span>Shop Location</span>
        <input value={vendorLocation} onChange={(event) => setVendorLocation(event.target.value)} placeholder="Congo Street, Block 4" />
      </label>
      <div className="field-row">
        <label className="field-group half-width">
          <span>Latitude</span>
          <input value={vendorLat} onChange={(event) => setVendorLat(Number(event.target.value))} placeholder="-6.8235" />
        </label>
        <label className="field-group half-width">
          <span>Longitude</span>
          <input value={vendorLng} onChange={(event) => setVendorLng(Number(event.target.value))} placeholder="39.2790" />
        </label>
      </div>
      <button className="button-solid" onClick={() => onNext(shopName, shopImage)}>
        Save & Preview Stall
      </button>
    </div>
  )
}

function ShopPreviewScreen({
  shopName,
  shopImage,
  phone,
  username,
  onBack,
  onNext,
}: {
  shopName: string
  shopImage: string
  phone: string
  username: string
  onBack: () => void
  onNext: () => void
}) {
  return (
    <div className="screen">
      <button className="back-button" onClick={onBack}>
        ← Back
      </button>
      <h2>Shop Preview</h2>
      <p className="screen-copy">Review the shop listing before opening your product catalog.</p>
      <div className="preview-card">
        <div className="preview-image" style={{ backgroundImage: `url(${shopImage})` }}>
          <span className="verification-tag">Verified Retailer</span>
        </div>
        <div className="preview-details">
          <strong>{shopName || 'Kariakoo Merchant'}</strong>
          <p>Phone: {phone}</p>
          <p>Username: @{username}</p>
          <p>All catalogs uploaded through this profile are audited for fair pricing.</p>
        </div>
      </div>
      <button className="button-solid" onClick={onNext}>
        Go into Catalog
      </button>
    </div>
  )
}

function ProductManagementScreen({
  shopId,
  shopName,
  products,
  onBack,
  onAddProduct,
  onDeleteProduct,
  onCloseShop,
}: {
  shopId: string
  shopName: string
  products: Product[]
  onBack: () => void
  onAddProduct: (product: Product) => void
  onDeleteProduct: (productId: string) => void
  onCloseShop: () => void
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="screen">
      <button className="back-button" onClick={onBack}>
        ← Back
      </button>
      <div className="screen-heading-row">
        <div>
          <h2>Products</h2>
          <p className="screen-copy">Catalog items for {shopName}</p>
        </div>
        <button className="button-outline" onClick={() => setIsOpen(true)}>
          + Add Product
        </button>
      </div>

      <div className="products-list">
        {products.filter((product) => product.shopId === shopId).map((product) => (
          <div key={product.id} className="product-card">
            <img src={product.image} alt={product.name} />
            <div className="product-content">
              <strong>{product.name}</strong>
              <p>{product.description}</p>
              <div className="chip-row">
                <span className="chip">Class {product.class}</span>
                <span className="chip">{product.availability}</span>
              </div>
            </div>
            <div className="product-actions">
              <span className="price-tag">{product.price} TSh</span>
              <button className="button-text" onClick={() => onDeleteProduct(product.id)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <button className="button-outline red" onClick={onCloseShop}>
        Close My Shop
      </button>

      {isOpen && <AddProductModal onSave={(product) => { onAddProduct(product); setIsOpen(false) }} onDismiss={() => setIsOpen(false)} shopId={shopId} />}
    </div>
  )
}

function AddProductModal({
  onDismiss,
  onSave,
  shopId,
}: {
  onDismiss: () => void
  onSave: (product: Product) => void
  shopId: string
}) {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [quality, setQuality] = useState('B')
  const [description, setDescription] = useState('')
  const [stock, setStock] = useState('')
  const [image, setImage] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files && event.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') setImage(reader.result)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <h3>New Product</h3>
        <label className="field-group">
          <span>Name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Product title" />
        </label>
        <label className="field-group">
          <span>Price (TSh)</span>
          <input value={price} onChange={(event) => setPrice(event.target.value)} placeholder="18000" />
        </label>
        <label className="field-group">
          <span>Stock Quantity</span>
          <input value={stock} onChange={(event) => setStock(event.target.value)} placeholder="45" />
        </label>
        <label className="field-group">
          <span>Description</span>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Short description" />
        </label>
        <label className="field-group">
          <span>Product Image</span>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} />
          {image ? (
            <div style={{ marginTop: 8 }}>
              <img src={image} alt="Preview" style={{ width: '100%', maxHeight: 200, objectFit: 'cover' }} />
            </div>
          ) : (
            <small style={{ display: 'block', marginTop: 8, color: '#666' }}>No image selected</small>
          )}
        </label>
        <div className="field-row quality-row">
          {['A', 'B', 'C'].map((option) => (
            <button key={option} className={`chip-button ${quality === option ? 'selected' : ''}`} onClick={() => setQuality(option)}>
              Class {option}
            </button>
          ))}
        </div>
        <div className="modal-actions">
          <button className="button-outline" onClick={onDismiss}>
            Cancel
          </button>
          <button
            className="button-solid"
            onClick={() =>
              onSave({
                id: `prod_${Date.now()}`,
                name: name || 'New Item',
                description: description || 'No description provided.',
                price: Number(price) || 0,
                image: image || 'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?auto=format&fit=crop&q=80&w=300',
                category: 'General',
                class: quality,
                shopId,
                availability: 'Immediate Stock',
                stock: Number(stock) || 0,
              })
            }
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

function CustomerSearchScreen({
  searchQuery,
  budget,
  onSearchQueryChange,
  onBudgetChange,
  onBack,
  onNext,
  onViewShops,
}: {
  searchQuery: string
  budget: string
  onSearchQueryChange: (value: string) => void
  onBudgetChange: (value: string) => void
  onBack: () => void
  onNext: () => void
  onViewShops: () => void
}) {
  return (
    <div className="screen">
      <button className="back-button" onClick={onBack}>
        ← Back
      </button>
      <h2>Customer Search</h2>
      <p className="screen-copy">Search your product, set a budget, and compare across quality classes.</p>
      <label className="field-group">
        <span>What are you buying today?</span>
        <input value={searchQuery} onChange={(event) => onSearchQueryChange(event.target.value)} placeholder="Charger" />
      </label>
      <label className="field-group">
        <span>Budget (TSh)</span>
        <input value={budget} onChange={(event) => onBudgetChange(event.target.value)} placeholder="15000" />
      </label>
      <div className="action-row">
        <button className="button-solid" onClick={onNext}>
          Proceed to Price Grades
        </button>
        <button className="button-outline" onClick={onViewShops}>
          Browse Registered Shops
        </button>
      </div>
      <div className="chip-row">
        {['Charger', 'Kitenge', 'Cloves', 'Sandal', 'Rice'].map((term) => (
          <button key={term} className="chip-button" onClick={() => { onSearchQueryChange(term); onNext() }}>
            {term}
          </button>
        ))}
      </div>
      <div className="info-box">
        Search indexes allow comparison across three standardized marketplace quality classes A, B & C.
      </div>
    </div>
  )
}

function ClassSelectionScreen({
  searchQuery,
  budget,
  onBack,
  onClassSelect,
}: {
  searchQuery: string
  budget: string
  onBack: () => void
  onClassSelect: (value: string) => void
}) {
  return (
    <div className="screen">
      <button className="back-button" onClick={onBack}>
        ← Back
      </button>
      <h2>Choose Your Class</h2>
      <p className="screen-copy">
        Comparing values for "{searchQuery}"{budget ? ` with a budget of ${budget} TSh` : ''}.
      </p>
      {[
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
      ].map((item) => (
        <button key={item.letter} className="quality-card" onClick={() => onClassSelect(item.letter)}>
          <div className="quality-badge" style={{ backgroundColor: item.color }}>{item.letter}</div>
          <div>
            <strong>{item.title}</strong>
            <p>{item.description}</p>
          </div>
        </button>
      ))}
      <div className="info-box orange">
        In Kariakoo Market, pricing varies by quality tier. Choose the class that matches your preference.
      </div>
    </div>
  )
}

function ShopsListScreen({
  searchQuery,
  budget,
  selectedClass,
  shops,
  products,
  onBack,
  onShopSelect,
}: {
  searchQuery: string
  budget: string
  selectedClass: string | null
  shops: Shop[]
  products: Product[]
  onBack: () => void
  onShopSelect: (shopId: string) => void
}) {
  return (
    <div className="screen">
      <button className="back-button" onClick={onBack}>
        ← Back
      </button>
      <h2>Retail Stores</h2>
      <p className="screen-copy">
        Showing shops stocking "{searchQuery}" in Class {selectedClass || 'Any'}{budget ? ` with a budget of ${budget} TSh` : ''}.
      </p>
      <div className="cards-grid">
        {shops.length === 0 ? (
          <div className="empty-state">No shops matched this query.</div>
        ) : (
          shops.map((shop) => {
            const highlightProduct = products.find((product) => product.shopId === shop.id && (!selectedClass || product.class === selectedClass) && (!searchQuery || product.name.toLowerCase().includes(searchQuery.toLowerCase())))
            return (
              <button key={shop.id} className="shop-card" onClick={() => onShopSelect(shop.id)}>
                <img src={shop.image} alt={shop.name} />
                <div className="shop-content">
                  <strong>{shop.name}</strong>
                  <p>{shop.description}</p>
                  <div className="chip-row">
                    <span className="chip">Rating {shop.rating}</span>
                    <span className="chip">{shop.location}</span>
                  </div>
                  {highlightProduct && <div className="highlight-line">Fair Price: {highlightProduct.price} TSh</div>}
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

function ProductDetailsScreen({
  shop,
  products,
  searchQuery,
  budget,
  selectedClass,
  onBack,
  onNext,
}: {
  shop: Shop
  products: Product[]
  searchQuery: string
  budget: string
  selectedClass: string | null
  onBack: () => void
  onNext: () => void
}) {
  return (
    <div className="screen">
      <button className="back-button" onClick={onBack}>
        ← Back
      </button>
      <h2>Availability Details</h2>
      <p className="screen-copy">Verified listings for "{searchQuery}" in Class {selectedClass || 'Any'}.</p>
      <div className="detail-card">
        <div>
          <span className="detail-label">Selected Distributor</span>
          <h3>{shop.name}</h3>
          <p>{shop.description}</p>
        </div>
        <span className="rating-pill">★ {shop.rating}</span>
      </div>

      {products.length === 0 ? (
        <div className="empty-state">No products match your exact filters.</div>
      ) : (
        products.map((product) => {
          const withinBudget = budget ? product.price <= Number(budget) : true
          return (
            <div key={product.id} className="product-detail-card">
              <div className="detail-left">
                <img src={product.image} alt={product.name} />
              </div>
              <div className="detail-right">
                <strong>{product.name}</strong>
                <p>{product.description}</p>
                <div className="chip-row">
                  <span className="chip">Class {product.class}</span>
                  <span className="chip">{product.availability}</span>
                </div>
                <div className="price-row">
                  <span className="price-tag">{product.price} TSh</span>
                  <span className={`budget-pill ${withinBudget ? 'green' : 'red'}`}>{withinBudget ? 'Within Budget' : 'Over Budget'}</span>
                </div>
              </div>
            </div>
          )
        })
      )}

      <div className="contact-card">
        <div>
          <span className="detail-label">Phone Contact</span>
          <strong>{shop.phone}</strong>
        </div>
        <div>
          <span className="detail-label">Physical Location</span>
          <strong>{shop.location}</strong>
        </div>
      </div>

      <button className="button-solid" onClick={onNext}>
        Show Physical Map Location
      </button>
    </div>
  )
}

function MapScreen({
  shop,
  onBack,
  onRestart,
}: {
  shop: Shop
  onBack: () => void
  onRestart: () => void
}) {
  const mapRef = useRef<HTMLDivElement | null>(null)
  const [distance, setDistance] = useState<number | null>(null)
  const [userPosition, setUserPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [loadingMap, setLoadingMap] = useState(true)
  const [mapError, setMapError] = useState<string | null>(null)

  useEffect(() => {
    if (!mapRef.current) return

    if (!GOOGLE_MAPS_KEY) {
      setMapError('Google Maps API key not set. Add VITE_GOOGLE_MAPS_API_KEY to your .env')
      setLoadingMap(false)
      return
    }

    const loader = new Loader({ apiKey: GOOGLE_MAPS_KEY, version: 'weekly' })
    let map: google.maps.Map
    let polyline: google.maps.Polyline | null = null

    loader
      .load()
      .then(() => {
        const shopLatLng = new google.maps.LatLng(shop.latitude, shop.longitude)
        map = new google.maps.Map(mapRef.current!, {
          center: shopLatLng,
          zoom: 14,
        })
        new google.maps.Marker({ position: shopLatLng, map, title: shop.name })

        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const userLatLng = { lat: position.coords.latitude, lng: position.coords.longitude }
              setUserPosition(userLatLng)
              const distanceKm = calculateDistance(userLatLng.lat, userLatLng.lng, shop.latitude, shop.longitude)
              setDistance(distanceKm)
              const path = [new google.maps.LatLng(userLatLng.lat, userLatLng.lng), shopLatLng]
              polyline = new google.maps.Polyline({
                path,
                strokeColor: getPathColor(distanceKm),
                strokeOpacity: 0.85,
                strokeWeight: 6,
                map,
              })
              new google.maps.Marker({ position: userLatLng, map, title: 'Your location' })
              const bounds = new google.maps.LatLngBounds()
              bounds.extend(shopLatLng)
              bounds.extend(userLatLng)
              map.fitBounds(bounds)
              setLoadingMap(false)
            },
            () => {
              setLoadingMap(false)
            },
            { enableHighAccuracy: true, timeout: 8000 },
          )
        } else {
          setLoadingMap(false)
        }
      })
      .catch((err) => {
        console.error('Google Maps failed to load', err)
        setMapError('Failed to load Google Maps. Check your API key and network.')
        setLoadingMap(false)
      })

    return () => {
      if (polyline) {
        polyline.setMap(null)
      }
    }
  }, [shop])

  return (
    <div className="screen">
      <button className="back-button" onClick={onBack}>
        ← Back
      </button>
      <h2>Navigation Path</h2>
      <p className="screen-copy">Follow the map guidance from your current location to the selected stall.</p>
      <div className="map-shell">
        <div ref={mapRef} className="map-canvas" />
        {mapError ? (
          <div className="map-overlay" style={{ color: '#fff', background: 'rgba(220,38,38,0.9)' }}>{mapError}</div>
        ) : (
          loadingMap && <div className="map-overlay">Loading map…</div>
        )}
      </div>
      <div className="map-stats">
        <div>
          <span className="detail-label">Selected Stall</span>
          <strong>{shop.name}</strong>
        </div>
        <div>
          <span className="detail-label">Distance</span>
          <strong>{distance !== null ? `${distance.toFixed(2)} km` : 'Fetching GPS...'}</strong>
        </div>
      </div>
      <button
        className="button-outline"
        onClick={() =>
          window.open(
            `https://www.google.com/maps/dir/?api=1&destination=${shop.latitude},${shop.longitude}`,
            '_blank',
          )
        }
      >
        Open in Google Maps
      </button>
      <button className="button-solid" onClick={onRestart}>
        Back to Selection
      </button>
    </div>
  )
}

function RegisteredShopsScreen({
  shops,
  onBack,
  onShopSelect,
}: {
  shops: Shop[]
  onBack: () => void
  onShopSelect: (shopId: string) => void
}) {
  return (
    <div className="screen">
      <button className="back-button" onClick={onBack}>
        ← Back
      </button>
      <h2>Registered Shops</h2>
      <p className="screen-copy">Browse the full store catalog and choose a shop to explore.</p>
      <div className="cards-grid">
        {shops.map((shop) => (
          <button key={shop.id} className="shop-card" onClick={() => onShopSelect(shop.id)}>
            <img src={shop.image} alt={shop.name} />
            <div className="shop-content">
              <strong>{shop.name}</strong>
              <p>{shop.location}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function AdminLoginScreen({
  onBack,
  onLoginSuccess,
}: {
  onBack: () => void
  onLoginSuccess: () => void
}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="screen">
      <button className="back-button" onClick={onBack}>
        ← Back
      </button>
      <h2>Admin Login</h2>
      <p className="screen-copy">Use the administrator credentials to manage vendor registrations.</p>
      <label className="field-group">
        <span>Admin Username</span>
        <input value={username} onChange={(event) => setUsername(event.target.value)} />
      </label>
      <label className="field-group">
        <span>Password</span>
        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
      </label>
      {error && <div className="alert-box">{error}</div>}
      <button
        className="button-solid"
        onClick={() => {
          if (username.trim() === 'admin' && password === '1234') {
            onLoginSuccess()
          } else {
            setError('Invalid admin credentials.')
          }
        }}
      >
        Verify & Enter
      </button>
    </div>
  )
}

function AdminDashboardScreen({
  registeredVendors,
  onBack,
  onDeleteVendor,
}: {
  registeredVendors: Shop[]
  onBack: () => void
  onDeleteVendor: (vendorId: string) => void
}) {
  return (
    <div className="screen">
      <button className="back-button" onClick={onBack}>
        ← Back
      </button>
      <h2>Admin Dashboard</h2>
      <p className="screen-copy">Manage the vendor registry and remove stalls from the catalog.</p>
      <div className="vendor-list">
        {registeredVendors.map((vendor) => (
          <div key={vendor.id} className="vendor-card">
            <div>
              <strong>@{vendor.username}</strong>
              <p>{vendor.name}</p>
              <p>{vendor.phone}</p>
            </div>
            <button className="button-text red" onClick={() => onDeleteVendor(vendor.id)}>
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRadians = (value: number) => (value * Math.PI) / 180
  const dLat = toRadians(lat2 - lat1)
  const dLng = toRadians(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return (6371 * c)
}

function getPathColor(distanceKm: number) {
  if (distanceKm <= 0.1) return '#2563eb'
  if (distanceKm <= 5.0) return '#22c55e'
  if (distanceKm <= 10.0) return '#ec4899'
  return '#ef4444'
}

export default App
