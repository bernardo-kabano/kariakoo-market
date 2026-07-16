package com.application.yes

import android.util.Log
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore

object FirebaseManager {
    private val auth: FirebaseAuth get() = FirebaseAuth.getInstance()
    private val db: FirebaseFirestore get() = FirebaseFirestore.getInstance()

    private fun getEmailFromUsername(username: String): String {
        val cleanUsername = username.trim().lowercase().replace("\\s+".toRegex(), "")
        val finalEmail = if (cleanUsername.isEmpty()) "user@kariakoo.com" else "$cleanUsername@kariakoo.com"
        Log.d("FirebaseManager", "Generated email for auth: $finalEmail")
        return finalEmail
    }

    fun signUpVendor(username: String, phone: String, password: String, onResult: (Boolean, String?) -> Unit) {
        if (username.isBlank() || password.length < 6) {
            onResult(false, "Username cannot be empty and password must be at least 6 characters")
            return
        }
        val email = getEmailFromUsername(username)
        auth.createUserWithEmailAndPassword(email, password)
            .addOnCompleteListener { task ->
                if (task.isSuccessful) {
                    onResult(true, null)
                } else {
                    onResult(false, task.exception?.localizedMessage ?: "Registration failed")
                }
            }
    }

    fun signInVendor(username: String, password: String, onResult: (Boolean, String?) -> Unit) {
        if (username.isBlank() || password.isBlank()) {
            onResult(false, "Username and password cannot be empty")
            return
        }
        val email = getEmailFromUsername(username)
        
        // Ensure we are signed out before trying a new login to avoid stale token issues
        try {
            auth.signOut()
        } catch (e: Exception) {
            Log.e("FirebaseManager", "Error signing out: ${e.message}")
        }

        auth.signInWithEmailAndPassword(email, password)
            .addOnCompleteListener { task ->
                if (task.isSuccessful) {
                    onResult(true, null)
                } else {
                    val errorMsg = task.exception?.localizedMessage ?: "Authentication failed"
                    Log.e("FirebaseManager", "Sign in error: $errorMsg")
                    onResult(false, errorMsg)
                }
            }
    }

    fun observeShops(onShopsChange: (List<Shop>) -> Unit) {
        try {
            db.collection("shops").addSnapshotListener { snapshot, error ->
                if (error != null) {
                    Log.e("FirebaseManager", "Error observing shops: ${error.message}")
                    return@addSnapshotListener
                }
                if (snapshot == null) return@addSnapshotListener
                
                val shops = try {
                    snapshot.toObjects(Shop::class.java)
                } catch (e: Exception) {
                    Log.e("FirebaseManager", "Error parsing shops: ${e.message}")
                    emptyList<Shop>()
                }
                onShopsChange(shops)
            }
        } catch (e: Exception) {
            Log.e("FirebaseManager", "Failed to setup shops listener: ${e.message}")
        }
    }

    fun observeProducts(onProductsChange: (List<Product>) -> Unit) {
        try {
            db.collection("products").addSnapshotListener { snapshot, error ->
                if (error != null) {
                    Log.e("FirebaseManager", "Error observing products: ${error.message}")
                    return@addSnapshotListener
                }
                if (snapshot == null) return@addSnapshotListener
                
                val products = try {
                    snapshot.toObjects(Product::class.java)
                } catch (e: Exception) {
                    Log.e("FirebaseManager", "Error parsing products: ${e.message}")
                    emptyList<Product>()
                }
                onProductsChange(products)
            }
        } catch (e: Exception) {
            Log.e("FirebaseManager", "Failed to setup products listener: ${e.message}")
        }
    }

    fun saveShop(shop: Shop, onResult: (Boolean) -> Unit = {}) {
        if (shop.id.isBlank()) {
            onResult(false)
            return
        }
        db.collection("shops").document(shop.id).set(shop)
            .addOnCompleteListener { onResult(it.isSuccessful) }
    }

    fun saveProduct(product: Product, onResult: (Boolean) -> Unit = {}) {
        if (product.id.isBlank()) {
            onResult(false)
            return
        }
        db.collection("products").document(product.id).set(product)
            .addOnCompleteListener { onResult(it.isSuccessful) }
    }

    fun deleteProduct(productId: String, onResult: (Boolean) -> Unit = {}) {
        db.collection("products").document(productId).delete()
            .addOnCompleteListener { onResult(it.isSuccessful) }
    }

    fun deleteVendor(vendorId: String, onResult: (Boolean) -> Unit = {}) {
        db.collection("shops").document(vendorId).delete()
            .addOnCompleteListener { success ->
                if (success.isSuccessful) {
                    db.collection("products").whereEqualTo("shopId", vendorId).get()
                        .addOnSuccessListener { snapshot ->
                            for (doc in snapshot.documents) {
                                doc.reference.delete()
                            }
                            onResult(true)
                        }
                        .addOnFailureListener {
                            onResult(true) // Shop deleted, but products cleanup failed
                        }
                } else {
                    onResult(false)
                }
            }
    }

    fun seedInitialDataIfEmpty() {
        try {
            db.collection("shops").get().addOnSuccessListener { snapshot ->
                if (snapshot.isEmpty) {
                    for (shop in initialShops) {
                        saveShop(shop)
                    }
                }
            }.addOnFailureListener {
                Log.e("FirebaseManager", "Failed to check shops for seeding: ${it.message}")
            }
            db.collection("products").get().addOnSuccessListener { snapshot ->
                if (snapshot.isEmpty) {
                    for (product in initialProducts) {
                        saveProduct(product)
                    }
                }
            }.addOnFailureListener {
                Log.e("FirebaseManager", "Failed to check products for seeding: ${it.message}")
            }
        } catch (e: Exception) {
            Log.e("FirebaseManager", "Error in seeding data: ${e.message}")
        }
    }
}
