package com.application.yes

data class Shop(
    val id: String = "",
    val name: String = "",
    val username: String = "",
    val phone: String = "",
    val password: String = "123456",
    val image: String = "",
    val description: String = "",
    val location: String = "",
    val category: String = "",
    val rating: Double = 0.0,
    val latitude: Double = -6.8235, // Default Kariakoo lat
    val longitude: Double = 39.2790, // Default Kariakoo lng
    val tags: List<String> = emptyList()
)

data class Product(
    val id: String = "",
    val name: String = "",
    val description: String = "",
    val price: Int = 0,
    val image: String = "",
    val category: String = "",
    val `class`: String = "",
    val shopId: String = "",
    val availability: String = "",
    val stock: Int = 0
)
