#!/bin/bash

# HomeschoolDone iOS/tvOS Project Creation Script
# This script automates the file organization after creating the Xcode project

echo "🎯 HomeschoolDone iOS/tvOS Project Setup"
echo "========================================"

# Check if we're in the right directory
if [[ ! -f "SETUP.md" ]]; then
    echo "❌ Please run this script from the ios-tvos directory"
    exit 1
fi

# Check if Xcode project exists (could be in subdirectory)
if [[ ! -f "HomeschoolDone.xcodeproj/project.pbxproj" && ! -f "HomeschoolDone/HomeschoolDone.xcodeproj/project.pbxproj" ]]; then
    echo ""
    echo "📋 STEP 1: Create Xcode Project"
    echo "--------------------------------"
    echo "1. Open Xcode"
    echo "2. File > New > Project"
    echo "3. Choose 'App' under iOS"
    echo "4. Configure:"
    echo "   - Product Name: HomeschoolDone"
    echo "   - Bundle ID: com.yourcompany.homeschooldone.ios"
    echo "   - Language: Swift"
    echo "   - Interface: SwiftUI"
    echo "5. Save in: $(pwd)"
    echo ""
    echo "Then re-run this script to continue setup!"
    exit 1
fi

echo "✅ Found Xcode project"

# Find the project file location
PROJECT_FILE=""
if [[ -f "HomeschoolDone.xcodeproj/project.pbxproj" ]]; then
    PROJECT_FILE="HomeschoolDone.xcodeproj/project.pbxproj"
elif [[ -f "HomeschoolDone/HomeschoolDone.xcodeproj/project.pbxproj" ]]; then
    PROJECT_FILE="HomeschoolDone/HomeschoolDone.xcodeproj/project.pbxproj"
fi

# Check if tvOS target exists
if ! grep -q "HomeschoolDone-tvOS" "$PROJECT_FILE" 2>/dev/null; then
    echo ""
    echo "📋 STEP 2: Add tvOS Target"
    echo "---------------------------"
    echo "1. In Xcode, select your project"
    echo "2. Click '+' to add new target"
    echo "3. Choose 'App' under tvOS"
    echo "4. Configure:"
    echo "   - Product Name: HomeschoolDone-tvOS"
    echo "   - Bundle ID: com.yourcompany.homeschooldone.tvos"
    echo ""
    echo "Then re-run this script to continue setup!"
    exit 1
fi

echo "✅ Found tvOS target"

echo ""
echo "📦 Setting up project structure..."

# Create proper directory structure if it doesn't exist
mkdir -p HomeschoolDone/iOS
mkdir -p HomeschoolDone/tvOS
mkdir -p HomeschoolDone/Shared

# Move iOS source files to proper location
if [[ -f "HomeschoolDone-iOS/HomeschoolDoneApp.swift" ]]; then
    echo "📱 Setting up iOS app files..."
    cp "HomeschoolDone-iOS/HomeschoolDoneApp.swift" "HomeschoolDone/iOS/"
    cp "HomeschoolDone-iOS/ContentView.swift" "HomeschoolDone/iOS/"
    echo "✅ iOS files ready"
fi

# Move tvOS source files to proper location  
if [[ -f "HomeschoolDone-tvOS/HomeschoolDoneTVApp.swift" ]]; then
    echo "📺 Setting up tvOS app files..."
    cp "HomeschoolDone-tvOS/HomeschoolDoneTVApp.swift" "HomeschoolDone/tvOS/"
    cp "HomeschoolDone-tvOS/ContentView.swift" "HomeschoolDone/tvOS/"
    echo "✅ tvOS files ready"
fi

# Check for Firebase configuration
echo ""
echo "🔥 Firebase Configuration Check"
echo "--------------------------------"

if [[ ! -f "GoogleService-Info.plist" ]]; then
    echo "⚠️  GoogleService-Info.plist not found"
    echo ""
    echo "📋 Firebase Setup Steps:"
    echo "1. Go to Firebase Console: https://console.firebase.google.com"
    echo "2. Select your HomeschoolDone project"
    echo "3. Add iOS app:"
    echo "   - iOS bundle ID: com.yourcompany.homeschooldone.ios"
    echo "4. Download GoogleService-Info.plist"
    echo "5. Add to both iOS and tvOS targets in Xcode"
    echo ""
else
    echo "✅ GoogleService-Info.plist found"
fi

# Package.swift check
echo ""
echo "📦 Swift Package Configuration"
echo "------------------------------"

if [[ -f "Package.swift" ]]; then
    echo "✅ Package.swift ready"
    echo ""
    echo "📋 Add Swift Package to Xcode:"
    echo "1. File > Add Package Dependencies"
    echo "2. Add Local: $(pwd)"
    echo "3. Add to both iOS and tvOS targets:"
    echo "   - SharedModels" 
    echo "   - FirebaseService"
else
    echo "❌ Package.swift not found"
fi

echo ""
echo "🚀 Next Steps"
echo "============="
echo "1. Open HomeschoolDone.xcodeproj in Xcode"
echo "2. Add Firebase iOS SDK:"
echo "   - File > Add Package Dependencies"
echo "   - URL: https://github.com/firebase/firebase-ios-sdk"
echo "   - Add FirebaseAuth, FirebaseFirestore, FirebaseFirestoreSwift"
echo "3. Add local Swift packages (if not done)"
echo "4. Replace default app files with prepared versions"
echo "5. Add GoogleService-Info.plist to both targets"
echo "6. Build and test!"
echo ""
echo "📖 See SETUP.md for detailed instructions"

echo ""
echo "✨ Setup script complete!"