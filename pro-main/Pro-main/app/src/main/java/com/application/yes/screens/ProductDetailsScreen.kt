package com.application.yes.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.application.yes.Product
import com.application.yes.Shop
import com.application.yes.initialProducts
import com.application.yes.initialShops

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProductDetailsScreen(
    shopId: String?,
    shops: List<Shop>,
    products: List<Product>,
    searchQuery: String,
    budget: String,
    selectedClass: String?,
    onBack: () -> Unit,
    onNext: () -> Unit
) {
    val shop = shops.find { it.id == shopId } ?: shops[0]
    val matchingProducts = products.filter { p ->
        p.shopId == shop.id &&
        (selectedClass == null || p.`class` == selectedClass) &&
        (p.name.contains(searchQuery, ignoreCase = true) || p.description.contains(searchQuery, ignoreCase = true)) &&
        (budget.isEmpty() || p.price <= (budget.toIntOrNull() ?: Int.MAX_VALUE))
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Availability Details", fontSize = 16.sp, fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .padding(padding)
                .padding(horizontal = 24.dp)
                .fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            contentPadding = PaddingValues(top = 24.dp, bottom = 24.dp)
        ) {
            item {
                Surface(
                    color = Color(0xFFECFDF5),
                    shape = RoundedCornerShape(8.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF10B981))
                ) {
                    Row(modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(modifier = Modifier.size(6.dp).background(Color(0xFF10B981), RoundedCornerShape(3.dp)))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(if (matchingProducts.isNotEmpty()) "Matching Products Found" else "No Perfect Match Found", 
                             fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color(0xFF065F46))
                    }
                }
            }

            item {
                Column {
                    Text(
                        "Shop & Stock Metrics",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.ExtraBold
                    )
                    Text(
                        "Verified listings for \"$searchQuery\" Class ${selectedClass ?: "Any"}.",
                        fontSize = 12.sp,
                        color = Color(0xFF64748B),
                        modifier = Modifier.padding(top = 4.dp)
                    )
                }
            }

            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Brush.horizontalGradient(listOf(Color(0xFF1E1B4B), Color(0xFF0F172A))))
                            .padding(16.dp)
                    ) {
                        Column {
                            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                                Text("Selected Distributor", fontSize = 8.sp, color = Color(0xFFC7D2FE), fontWeight = FontWeight.Bold)
                                Surface(color = Color.White.copy(alpha = 0.1f), shape = RoundedCornerShape(4.dp)) {
                                    Text("★ ${shop.rating} Rating", modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp), color = Color.White, fontSize = 9.sp)
                                }
                            }
                            Text(shop.name, fontSize = 16.sp, fontWeight = FontWeight.ExtraBold, color = Color.White)
                            Text(shop.description, fontSize = 10.sp, color = Color(0xFFE2E8F0), maxLines = 2, lineHeight = 14.sp)
                        }
                    }
                }
            }

            if (matchingProducts.isEmpty()) {
                item {
                    Text("No products match your specific class and budget in this shop.", 
                         fontSize = 12.sp, color = Color(0xFFEF4444), fontWeight = FontWeight.Medium)
                }
            }

            items(matchingProducts) { product ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFF8FAFC)),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFF1F5F9))
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            AsyncImage(
                                model = product.image,
                                contentDescription = null,
                                modifier = Modifier.size(48.dp).clip(RoundedCornerShape(8.dp)),
                                contentScale = ContentScale.Crop
                            )
                            Spacer(modifier = Modifier.width(12.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(product.name, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                                Text(product.description, fontSize = 10.sp, color = Color(0xFF64748B), maxLines = 1)
                            }
                            Surface(
                                color = when(product.`class`) {
                                    "A" -> Color(0xFFFFF7ED)
                                    "B" -> Color(0xFFEEF2FF)
                                    else -> Color(0xFFECFDF5)
                                },
                                shape = RoundedCornerShape(4.dp)
                            ) {
                                Text(
                                    "Class ${product.`class`}",
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                    fontSize = 8.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = when(product.`class`) {
                                        "A" -> Color(0xFFC2410C)
                                        "B" -> Color(0xFF4338CA)
                                        else -> Color(0xFF047857)
                                    }
                                )
                            }
                        }
                        
                        Divider(modifier = Modifier.padding(vertical = 12.dp), color = Color(0xFFE2E8F0))

                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Column {
                                Text("Standard Price (TZS)", fontSize = 9.sp, color = Color(0xFF94A3B8), fontWeight = FontWeight.Bold)
                                Text("${product.price} TSh", fontSize = 18.sp, fontWeight = FontWeight.ExtraBold, color = Color(0xFF4F46E5))
                                
                                val budgetValue = budget.toIntOrNull()
                                if (budgetValue != null) {
                                    val isWithinBudget = product.price <= budgetValue
                                    Text(
                                        text = if (isWithinBudget) "Within Budget" else "Over Budget",
                                        fontSize = 9.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = if (isWithinBudget) Color(0xFF047857) else Color(0xFFEF4444)
                                    )
                                }
                            }
                            Column(horizontalAlignment = Alignment.End) {
                                Text("In-Stall Status", fontSize = 9.sp, color = Color(0xFF94A3B8), fontWeight = FontWeight.Bold)
                                Surface(color = Color(0xFFECFDF5), shape = RoundedCornerShape(4.dp)) {
                                    Text("${product.stock} units available", modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp), color = Color(0xFF065F46), fontWeight = FontWeight.Bold, fontSize = 10.sp)
                                }
                            }
                        }
                    }
                }
            }

            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFF1F5F9))
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        ContactItem(icon = Icons.Default.Phone, label = "Phone Contact", value = shop.phone)
                        Spacer(modifier = Modifier.height(12.dp))
                        ContactItem(icon = Icons.Default.LocationOn, label = "Physical Location", value = shop.location)
                    }
                }
            }

            item {
                Button(
                    onClick = onNext,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4F46E5))
                ) {
                    Icon(Icons.Default.Navigation, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Show Physical Map Location", fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
fun ContactItem(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, value: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(modifier = Modifier.size(32.dp).background(Color(0xFFF8FAFC), RoundedCornerShape(8.dp)), contentAlignment = Alignment.Center) {
            Icon(icon, contentDescription = null, tint = Color(0xFF64748B), modifier = Modifier.size(16.dp))
        }
        Spacer(modifier = Modifier.width(12.dp))
        Column {
            Text(label, fontSize = 8.sp, color = Color(0xFF94A3B8), fontWeight = FontWeight.Bold)
            Text(value, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFF1E293B))
        }
    }
}

@Preview(showBackground = true)
@Composable
fun ProductDetailsScreenPreview() {
    MaterialTheme {
        ProductDetailsScreen(
            shopId = "shop_1",
            shops = initialShops,
            products = initialProducts,
            searchQuery = "Charger",
            budget = "20000",
            selectedClass = "B",
            onBack = {},
            onNext = {}
        )
    }
}
