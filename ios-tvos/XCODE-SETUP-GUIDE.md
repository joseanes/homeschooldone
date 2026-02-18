# 📱 Xcode Project Creation Guide

This visual guide walks you through creating the Xcode project step-by-step.

## ⏱️ Time Required: 15 minutes

## 🚀 Quick Start

1. **Run the setup script** to check your progress:
   ```bash
   cd /Users/anes/dev/homeschooldone/ios-tvos
   ./create-xcode-project.sh
   ```

2. **Follow the steps below** when the script prompts you

## 📋 Step-by-Step Instructions

### Step 1: Create iOS Project (5 minutes)

1. **Open Xcode**
2. **File > New > Project**
3. **Select "App" under iOS**
4. **Click "Next"**
5. **Fill in project details:**
   ```
   Product Name: HomeschoolDone
   Team: [Select your Apple Developer team]
   Organization Identifier: com.yourcompany.homeschooldone
   Bundle Identifier: com.yourcompany.homeschooldone.ios
   Language: Swift
   Interface: SwiftUI
   Use Core Data: [UNCHECKED]
   Include Tests: [UNCHECKED for now]
   ```
6. **Click "Next"**
7. **Save Location:** Navigate to and select the `ios-tvos` folder
8. **Click "Create"**

### Step 2: Add tvOS Target (3 minutes)

1. **In Xcode, click on project name** (top of file navigator)
2. **Click the "+" button** at bottom of targets list
3. **Select "App" under tvOS**
4. **Fill in tvOS target details:**
   ```
   Product Name: HomeschoolDone-tvOS
   Team: [Same as iOS]
   Organization Identifier: com.yourcompany.homeschooldone
   Bundle Identifier: com.yourcompany.homeschooldone.tvos
   Language: Swift
   Interface: SwiftUI
   ```
5. **Click "Finish"**

### Step 3: Add Firebase Dependencies (5 minutes)

1. **File > Add Package Dependencies**
2. **Enter URL:** `https://github.com/firebase/firebase-ios-sdk`
3. **Click "Add Package"**
4. **Select packages:**
   - ✅ FirebaseAuth
   - ✅ FirebaseFirestore  
   - ✅ FirebaseFirestoreSwift
5. **Add to targets:**
   - ✅ HomeschoolDone (iOS)
   - ✅ HomeschoolDone-tvOS
6. **Click "Add Package"**

### Step 4: Add Local Swift Packages (2 minutes)

1. **File > Add Package Dependencies**
2. **Click "Add Local"**
3. **Navigate to and select** the `ios-tvos` folder (same folder as Package.swift)
4. **Click "Add Package"**
5. **Select packages:**
   - ✅ SharedModels
   - ✅ FirebaseService
6. **Add to both targets**
7. **Click "Add Package"**

## 🔧 After Project Creation

Run the setup script again to verify everything is configured:
```bash
./create-xcode-project.sh
```

The script will guide you through:
- ✅ Copying app source files to correct locations
- ✅ Adding Firebase configuration
- ✅ Final build verification

## 🎯 Expected Project Structure

After completion, your project should look like:

```
HomeschoolDone.xcodeproj/
├── HomeschoolDone/           # iOS target
│   ├── iOS/
│   │   ├── HomeschoolDoneApp.swift
│   │   └── ContentView.swift
│   ├── tvOS/  
│   │   ├── HomeschoolDoneTVApp.swift
│   │   └── ContentView.swift
│   └── GoogleService-Info.plist
└── HomeschoolDone-tvOS/      # tvOS target (references same files)
```

## ❓ Troubleshooting

### "Package not found"
- Ensure you're selecting the `ios-tvos` folder (where Package.swift is located)
- Try "File > Packages > Reset Package Caches"

### "Bundle identifier already exists"
- Change `com.yourcompany` to your actual domain
- Or use `com.yourname.homeschooldone.ios` and `.tvos`

### "No development team"
- Sign in to Xcode with your Apple ID
- Or select "Add Account" in Team dropdown

## ✅ Success Indicators

You'll know it's working when:
- ✅ Both iOS and tvOS targets build without errors
- ✅ Firebase packages are listed in Package Dependencies
- ✅ Local packages (SharedModels, FirebaseService) are listed
- ✅ GoogleService-Info.plist is added to both targets

## 🚀 Next Steps

Once Xcode project is created:
1. **Add GoogleService-Info.plist** from Firebase Console
2. **Replace default app files** with the prepared Swift code
3. **Build and test** on simulators
4. **Deploy to App Store** when ready!

## 💡 Tips

- **Use Xcode 15+** for best Swift 5.9 support
- **Enable automatic signing** for easier development
- **Test on Apple TV simulator** before submitting
- **Keep bundle IDs consistent** with Firebase project