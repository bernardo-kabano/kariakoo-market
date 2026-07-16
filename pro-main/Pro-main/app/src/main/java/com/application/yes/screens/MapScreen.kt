package com.application.yes.screens

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.net.Uri
import android.os.Looper
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Navigation
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.application.yes.Shop
import com.google.android.gms.location.*
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.compose.*

@SuppressLint("MissingPermission")
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MapScreen(
    shopId: String?,
    shops: List<Shop>,
    onBack: () -> Unit,
    onRestart: () -> Unit
) {
    val context = LocalContext.current
    val shop = shops.find { it.id == shopId } ?: shops[0]
    val shopLatLng = LatLng(shop.latitude, shop.longitude)

    var userLocation by remember { mutableStateOf<LatLng?>(null) }
    var hasLocationPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED
        )
    }

    val launcher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions(),
        onResult = { permissions ->
            hasLocationPermission = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
                    permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        }
    )

    // Continuous Location Updates
    DisposableEffect(hasLocationPermission) {
        val fusedLocationClient = LocationServices.getFusedLocationProviderClient(context)
        val locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                for (location in result.locations) {
                    userLocation = LatLng(location.latitude, location.longitude)
                }
            }
        }

        if (hasLocationPermission) {
            val locationRequest = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 3000)
                .setMinUpdateIntervalMillis(1000)
                .build()
            
            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationCallback,
                Looper.getMainLooper()
            )
        } else {
            launcher.launch(
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                )
            )
        }

        onDispose {
            fusedLocationClient.removeLocationUpdates(locationCallback)
        }
    }

    // Distance Calculation
    val distanceKm = remember(userLocation) {
        if (userLocation == null) return@remember null
        val results = FloatArray(1)
        Location.distanceBetween(
            userLocation!!.latitude, userLocation!!.longitude,
            shop.latitude, shop.longitude,
            results
        )
        results[0] / 1000.0
    }

    // Explicit Color Logic for the Polyline
    val pathColor = when {
        distanceKm == null -> Color.Gray
        distanceKm <= 0.1 -> Color.Blue            // <= 100m -> BLUE
        distanceKm <= 5.0 -> Color.Green           // <= 5km -> GREEN
        distanceKm <= 10.0 -> Color(0xFFFF1493)    // <= 10km -> DEEP PINK
        else -> Color.Red                          // > 10km -> RED
    }

    val cameraPositionState = rememberCameraPositionState {
        position = CameraPosition.fromLatLngZoom(shopLatLng, 14f)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Navigation Path", fontSize = 16.sp, fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
        ) {
            Box(modifier = Modifier.weight(1f)) {
                GoogleMap(
                    modifier = Modifier.fillMaxSize(),
                    cameraPositionState = cameraPositionState,
                    uiSettings = MapUiSettings(zoomControlsEnabled = true, myLocationButtonEnabled = true),
                    properties = MapProperties(isMyLocationEnabled = hasLocationPermission)
                ) {
                    Marker(
                        state = MarkerState(position = shopLatLng),
                        title = shop.name,
                        snippet = shop.location
                    )

                    // DRAWING THE DYNAMIC POLYLINE
                    userLocation?.let { userPos ->
                        Polyline(
                            points = listOf(userPos, shopLatLng),
                            color = pathColor,
                            width = 20f, // Increased thickness
                            geodesic = true
                        )
                    }
                }

                // Distance Info HUD
                Card(
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .padding(24.dp)
                        .fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.95f)),
                    shape = RoundedCornerShape(16.dp),
                    elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text("Distance to Stall", fontSize = 10.sp, color = Color(0xFF64748B), fontWeight = FontWeight.Bold)
                                Text(
                                    text = if (distanceKm != null) "%.2f km away".format(distanceKm) else "Fetching GPS...",
                                    fontSize = 22.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = pathColor
                                )
                            }
                            Button(
                                onClick = {
                                    val gmmIntentUri = Uri.parse("google.navigation:q=${shop.latitude},${shop.longitude}")
                                    val mapIntent = Intent(Intent.ACTION_VIEW, gmmIntentUri)
                                    mapIntent.setPackage("com.google.android.apps.maps")
                                    context.startActivity(mapIntent)
                                },
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Icon(Icons.Default.Navigation, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Navigate", fontWeight = FontWeight.Bold)
                            }
                        }
                        
                        Text(
                            text = when {
                                distanceKm == null -> "Please enable GPS"
                                distanceKm <= 0.1 -> "Status: ARRIVED (Blue Line)"
                                distanceKm <= 5.0 -> "Status: VERY CLOSE (Green Line)"
                                distanceKm <= 10.0 -> "Status: APPROACHING (Pink Line)"
                                else -> "Status: LONG DISTANCE (Red Line)"
                            },
                            modifier = Modifier.padding(top = 8.dp),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = pathColor
                        )
                        
                        Text(
                            "Note: Inside the Google Maps App, colors are managed by Google and will remain blue.",
                            fontSize = 8.sp,
                            color = Color.Gray,
                            modifier = Modifier.padding(top = 4.dp)
                        )
                    }
                }
            }

            Button(
                onClick = onRestart,
                modifier = Modifier
                    .padding(16.dp)
                    .fillMaxWidth()
                    .height(56.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0F172A))
            ) {
                Text("Back to Selection", fontWeight = FontWeight.Bold)
            }
        }
    }
}
