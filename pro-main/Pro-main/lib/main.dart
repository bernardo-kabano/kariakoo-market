import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Note: You must add your own google-services.json to the android/app/ folder
  // and configure the Firebase project in the Firebase Console.
  try {
    await Firebase.initializeApp();
  } catch (e) {
    print("Firebase initialization failed: $e");
  }
  runApp(const KariakooApp());
}

class KariakooApp extends StatelessWidget {
  const KariakooApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Kariakoo Market',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF4F46E5)),
        useMaterial3: true,
      ),
      home: const MainNavigation(),
    );
  }
}

class MainNavigation extends StatefulWidget {
  const MainNavigation({super.key});

  @override
  State<MainNavigation> createState() => _MainNavigationState();
}

class _MainNavigationState extends State<MainNavigation> {
  int activeScreen = 1;
  String? userType;
  String searchQuery = "Charger";
  String? selectedClass = "B";

  void navigateTo(int screen) {
    setState(() {
      activeScreen = screen;
    });
  }

  Future<void> _recordInteraction(String action, dynamic data) async {
    try {
      await FirebaseFirestore.instance.collection('interactions').add({
        'action': action,
        'data': data,
        'timestamp': FieldValue.serverTimestamp(),
      });
    } catch (e) {
      print("Error recording interaction: $e");
    }
  }

  @override
  Widget build(BuildContext context) {
    switch (activeScreen) {
      case 1:
        return SelectionScreen(
          userType: userType,
          onUserTypeSelect: (type) {
            setState(() => userType = type);
            _recordInteraction('select_role', type);
          },
          onNext: () {
            _recordInteraction('navigate_next', {'from': 'selection', 'role': userType});
            if (userType == "vendor") {
              navigateTo(2);
            } else {
              navigateTo(6);
            }
          },
        );
      case 6:
        return CustomerSearchScreen(
          searchQuery: searchQuery,
          onSearchQueryChange: (val) => setState(() => searchQuery = val),
          onBack: () => navigateTo(1),
          onNext: () {
            _recordInteraction('perform_search', searchQuery);
            navigateTo(7);
          },
        );
      default:
        return Scaffold(
          body: Center(
            child: Text("Screen $activeScreen not implemented yet"),
          ),
        );
    }
  }
}

class SelectionScreen extends StatelessWidget {
  final String? userType;
  final Function(String) onUserTypeSelect;
  final VoidCallback onNext;

  const SelectionScreen({
    super.key,
    this.userType,
    required this.onUserTypeSelect,
    required this.onNext,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              const SizedBox(height: 40),
              const Text(
                "Who are you?",
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF0F172A),
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                "Identify your role to access specialized Kariakoo Market tools & fair-price indexing.",
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 16, color: Color(0xFF64748B)),
              ),
              const SizedBox(height: 40),
              _buildRoleCard(
                context,
                "Customer",
                "Search for items standardized across Class A, B, C and find optimal stalls with fair prices.",
                Icons.person,
                userType == "customer",
                () => onUserTypeSelect("customer"),
              ),
              const SizedBox(height: 16),
              _buildRoleCard(
                context,
                "Vendor / Merchant",
                "Register your physical stall credentials, catalog inventory grades, and advertise spot availability.",
                Icons.store,
                userType == "vendor",
                () => onUserTypeSelect("vendor"),
              ),
              const Spacer(),
              SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton(
                  onPressed: userType != null ? onNext : null,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF4F46E5),
                    foregroundColor: Colors.white,
                    shape: RoundedCornerShape(12),
                  ),
                  child: const Text("Send Identification", style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildRoleCard(
    BuildContext context,
    String title,
    String description,
    IconData icon,
    bool isSelected,
    VoidCallback onTap,
  ) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected ? const Color(0xFF4F46E5) : const Color(0xFFE2E8F0),
            width: 2,
          ),
          boxShadow: [
            if (isSelected)
              BoxShadow(
                color: const Color(0xFF4F46E5).withOpacity(0.1),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
          ],
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: const Color(0xFF64748B)),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF1E293B),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    description,
                    style: const TextStyle(fontSize: 14, color: Color(0xFF64748B)),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  OutlinedBorder RoundedCornerShape(double radius) {
    return RoundedRectangleBorder(borderRadius: BorderRadius.circular(radius));
  }
}

class CustomerSearchScreen extends StatelessWidget {
  final String searchQuery;
  final Function(String) onSearchQueryChange;
  final VoidCallback onBack;
  final VoidCallback onNext;

  const CustomerSearchScreen({
    super.key,
    required this.searchQuery,
    required this.onSearchQueryChange,
    required this.onBack,
    required this.onNext,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Kariakoo Smart Search", style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: onBack),
      ),
      body: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.horizontal(8, 2),
              decoration: BoxDecoration(
                color: const Color(0xFFEEF2FF),
                borderRadius: BorderRadius.circular(4),
              ),
              child: const Text(
                "Customer Hub",
                style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF4F46E5)),
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              "Customer Portal",
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
            const Text(
              "Search Your Product",
              style: TextStyle(fontSize: 14, color: Color(0xFF64748B)),
            ),
            const SizedBox(height: 24),
            TextField(
              onChanged: onSearchQueryChange,
              decoration: InputDecoration(
                hintText: "What are you buying today? e.g. Charger",
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                suffixIcon: Padding(
                  padding: const EdgeInsets.all(8.0),
                  child: Container(
                    decoration: BoxDecoration(
                      color: const Color(0xFF4F46E5),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: IconButton(
                      icon: const Icon(Icons.search, color: Colors.white),
                      onPressed: onNext,
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 24),
            const Text("Kariakoo Hot Keywords", style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF94A3B8))),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: ["Charger", "Kitenge", "Cloves", "Sandal", "Rice"].map((term) {
                return ActionChip(
                  label: Text(term),
                  onPressed: () {
                    onSearchQueryChange(term);
                    onNext();
                  },
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  backgroundColor: Colors.white,
                  side: const BorderSide(color: Color(0xFFE2E8F0)),
                );
              }).toList(),
            ),
            const SizedBox(height: 24),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFFEEF2FF),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.info, size: 16, color: Color(0xFF4F46E5)),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      "Search indexes allow comparison across three standardized marketplace quality classification indexes (A, B & C) immediately.",
                      style: TextStyle(fontSize: 11, color: Color(0xFF1E293B)),
                    ),
                  ),
                ],
              ),
            ),
            const Spacer(),
            SizedBox(
              width: double.infinity,
              height: 56,
              child: ElevatedButton(
                onPressed: onNext,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF4F46E5),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text("Proceed to Price Grades", style: TextStyle(fontWeight: FontWeight.bold)),
                    SizedBox(width: 8),
                    Icon(Icons.arrow_forward, size: 16),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
