package com.application.yes

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import android.widget.Toast
import androidx.compose.runtime.LaunchedEffect
import com.application.yes.screens.*
import com.google.firebase.FirebaseApp

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        try {
            FirebaseApp.initializeApp(this)
        } catch (e: Exception) {
            android.util.Log.e("MainActivity", "Firebase init error: ${e.message}")
        }
        enableEdgeToEdge()
        setContent {
            MaterialTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    KariakooApp(onExit = { finish() })
                }
            }
        }
    }
}

@Composable
fun KariakooApp(onExit: () -> Unit) {
    val context = LocalContext.current
    
    var activeScreen by remember { mutableIntStateOf(1) }
    var userType by remember { mutableStateOf<String?>(null) }
    var vendorUsername by remember { mutableStateOf("") }
    var vendorPhone by remember { mutableStateOf("") }
    var vendorPassword by remember { mutableStateOf("") }
    var vendorLocation by remember { mutableStateOf("") }
    var vendorLat by remember { mutableStateOf(-6.8235) }
    var vendorLng by remember { mutableStateOf(39.2790) }
    var vendorShopName by remember { mutableStateOf("") }
    var vendorShopImage by remember { mutableStateOf("") }
    var vendorIsRegistered by remember { mutableStateOf(false) }
    var searchQuery by remember { mutableStateOf("") }
    var budget by remember { mutableStateOf("") }
    var selectedClass by remember { mutableStateOf<String?>(null) }
    var selectedShopId by remember { mutableStateOf<String?>(null) }
    
    // Firestore state
    var shops by remember { mutableStateOf<List<Shop>>(emptyList()) }
    var products by remember { mutableStateOf<List<Product>>(emptyList()) }
    
    // Load data from Firebase
    LaunchedEffect(Unit) {
        FirebaseManager.seedInitialDataIfEmpty()
        FirebaseManager.observeShops { shops = it }
        FirebaseManager.observeProducts { products = it }
    }

    val navigateTo: (Int) -> Unit = { activeScreen = it }

    val goBack: () -> Unit = {
        when (activeScreen) {
            2 -> navigateTo(1)
            3 -> navigateTo(2)
            4 -> navigateTo(3)
            5 -> navigateTo(4)
            6 -> navigateTo(1)
            7 -> navigateTo(6)
            8 -> navigateTo(7)
            9 -> navigateTo(8)
            10 -> navigateTo(9)
            11 -> navigateTo(6)
            12 -> navigateTo(1)
            13 -> navigateTo(12)
            else -> onExit()
        }
    }

    BackHandler(enabled = activeScreen != 1) {
        goBack()
    }

    when (activeScreen) {
        1 -> SelectionScreen(
            userType = userType,
            onUserTypeSelect = { userType = it },
            onNext = {
                if (userType == "vendor") navigateTo(2)
                else navigateTo(6)
            },
            onLogout = onExit,
            onAdminClick = { navigateTo(12) }
        )
        2 -> VendorAuthScreen(
            onBack = { navigateTo(1) },
            onLogin = { username, password ->
                FirebaseManager.signInVendor(username, password) { success, error ->
                    if (success) {
                        val existingShop = shops.find { it.username == username }
                        if (existingShop != null) {
                            vendorUsername = username
                            vendorPhone = existingShop.phone
                            vendorPassword = password
                            vendorLocation = existingShop.location
                            vendorLat = existingShop.latitude
                            vendorLng = existingShop.longitude
                            vendorShopName = existingShop.name
                            vendorShopImage = existingShop.image
                            vendorIsRegistered = true
                            navigateTo(4) // Directly to preview
                        } else {
                            // Account exists but no shop profile? 
                            // This shouldn't happen usually with the new flow, 
                            // but let's send to registration just in case.
                            vendorUsername = username
                            vendorPassword = password
                            navigateTo(3)
                        }
                    } else {
                        Toast.makeText(context, error ?: "Login failed", Toast.LENGTH_SHORT).show()
                    }
                }
            },
            onRegister = { username, phone, password, location, lat, lng ->
                FirebaseManager.signUpVendor(username, phone, password) { success, error ->
                    if (success) {
                        vendorUsername = username
                        vendorPhone = phone
                        vendorPassword = password
                        vendorLocation = location
                        vendorLat = lat
                        vendorLng = lng
                        vendorIsRegistered = true
                        navigateTo(3) // Go to shop registration
                    } else {
                        Toast.makeText(context, error ?: "Registration failed", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        )
        3 -> ShopRegistrationScreen(
            onBack = { navigateTo(2) },
            onNext = { name, image ->
                vendorShopName = name
                vendorShopImage = image
                
                val newShop = Shop(
                    id = "shop_${vendorUsername}",
                    name = name,
                    username = vendorUsername,
                    phone = vendorPhone,
                    password = vendorPassword,
                    image = image,
                    description = "Verified Kariakoo Merchant",
                    location = if (vendorLocation.isNotEmpty()) vendorLocation else "Kariakoo Market Center",
                    category = "General",
                    rating = 5.0,
                    latitude = vendorLat,
                    longitude = vendorLng,
                    tags = listOf("New")
                )
                FirebaseManager.saveShop(newShop)
                navigateTo(4)
            }
        )
        4 -> ShopPreviewScreen(
            shopName = vendorShopName,
            shopImage = vendorShopImage,
            phone = vendorPhone,
            username = vendorUsername,
            onBack = { navigateTo(3) },
            onNext = { navigateTo(5) }
        )
        5 -> ProductManagementScreen(
            shopId = "shop_$vendorUsername",
            shopName = vendorShopName,
            products = products,
            onBack = { navigateTo(4) },
            onAddProduct = { newProduct ->
                FirebaseManager.saveProduct(newProduct)
            },
            onDeleteProduct = { productId ->
                FirebaseManager.deleteProduct(productId)
            },
            onCloseShop = {
                userType = null
                activeScreen = 1
            }
        )
        6 -> CustomerSearchScreen(
            searchQuery = searchQuery,
            onSearchQueryChange = { searchQuery = it },
            budget = budget,
            onBudgetChange = { budget = it },
            onBack = { navigateTo(1) },
            onNext = { navigateTo(7) },
            onViewShops = { navigateTo(11) }
        )
        7 -> ClassSelectionScreen(
            searchQuery = searchQuery,
            budget = budget,
            onBack = { navigateTo(6) },
            onClassSelect = {
                selectedClass = it
                navigateTo(8)
            }
        )
        8 -> ShopsListScreen(
            searchQuery = searchQuery,
            budget = budget,
            selectedClass = selectedClass,
            shops = shops,
            products = products,
            onBack = { navigateTo(7) },
            onShopSelect = {
                selectedShopId = it
                navigateTo(9)
            }
        )
        9 -> ProductDetailsScreen(
            shopId = selectedShopId,
            shops = shops,
            products = products,
            searchQuery = searchQuery,
            budget = budget,
            selectedClass = selectedClass,
            onBack = { navigateTo(8) },
            onNext = { navigateTo(10) }
        )
        10 -> MapScreen(
            shopId = selectedShopId,
            shops = shops,
            onBack = { navigateTo(9) },
            onRestart = {
                userType = null
                searchQuery = ""
                budget = ""
                selectedClass = null
                selectedShopId = null
                activeScreen = 1
            }
        )
        11 -> RegisteredShopsScreen(
            shops = shops,
            onBack = { navigateTo(6) },
            onShopSelect = {
                selectedShopId = it
                navigateTo(9)
            }
        )
        12 -> AdminLoginScreen(
            onBack = { navigateTo(1) },
            onLoginSuccess = { navigateTo(13) }
        )
        13 -> AdminDashboardScreen(
            registeredVendors = shops,
            onBack = { navigateTo(12) },
            onDeleteVendor = { vendorId ->
                FirebaseManager.deleteVendor(vendorId)
            }
        )
    }
}
