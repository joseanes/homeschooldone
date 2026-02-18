# HomeschoolDone iOS/tvOS Setup Instructions

## Prerequisites
- Xcode 15.0 or later
- iOS 15.0+ / tvOS 15.0+ deployment targets
- Apple Developer Account (for App Store distribution)
- Firebase project with iOS app configured

## Step 1: Create Xcode Project

1. **Open Xcode** and create a new project
2. **Choose "App"** template
3. **Configure project**:
   - Product Name: `HomeschoolDone`
   - Bundle Identifier: `com.yourcompany.homeschooldone.ios`
   - Language: Swift
   - Interface: SwiftUI
   - Use Core Data: No

4. **Save project** in the `ios-tvos` folder

## Step 2: Add tvOS Target

1. **File > New > Target**
2. **Choose "App" under tvOS**
3. **Configure tvOS target**:
   - Product Name: `HomeschoolDone-tvOS`
   - Bundle Identifier: `com.yourcompany.homeschooldone.tvos`

## Step 3: Add Firebase Dependencies

1. **File > Add Package Dependencies**
2. **Enter URL**: `https://github.com/firebase/firebase-ios-sdk`
3. **Add to both targets**:
   - FirebaseAuth
   - FirebaseFirestore
   - FirebaseFirestoreSwift

## Step 4: Add Local Swift Packages

1. **File > Add Package Dependencies**
2. **Add Local Package**: Select the `ios-tvos` folder
3. **Add to both targets**:
   - SharedModels
   - FirebaseService

## Step 5: Configure Firebase

1. **Download `GoogleService-Info.plist`** from Firebase Console
   - iOS app configuration
2. **Add to both targets** (iOS and tvOS)
3. **Ensure "Add to Target" is checked** for both

## Step 6: Copy Source Files

1. **Replace iOS app files**:
   - Copy `HomeschoolDone-iOS/HomeschoolDoneApp.swift` to iOS target
   - Copy `HomeschoolDone-iOS/ContentView.swift` to iOS target

2. **Replace tvOS app files**:
   - Copy `HomeschoolDone-tvOS/HomeschoolDoneTVApp.swift` to tvOS target  
   - Copy `HomeschoolDone-tvOS/ContentView.swift` to tvOS target

## Step 7: Configure App Icons

### iOS App Icons (required sizes):
- 20x20 (@2x, @3x)
- 29x29 (@2x, @3x) 
- 40x40 (@2x, @3x)
- 60x60 (@2x, @3x)
- 76x76 (@1x, @2x)
- 83.5x83.5 (@2x)
- 1024x1024 (@1x)

### tvOS App Icons (required sizes):
- 400x240 (Top Shelf)
- 1920x720 (Top Shelf Wide)
- 1280x768 (App Icon Large)
- 400x240 (App Icon Small)

## Step 8: Configure Info.plist

### iOS Info.plist additions:
```xml
<key>UIUserInterfaceStyle</key>
<string>Dark</string>
<key>CFBundleDisplayName</key>
<string>HomeschoolDone</string>
```

### tvOS Info.plist additions:
```xml
<key>UIUserInterfaceStyle</key>
<string>Dark</string>
<key>CFBundleDisplayName</key>
<string>HomeschoolDone TV</string>
<key>TVTopShelfImage</key>
<dict>
    <key>TVTopShelfPrimaryImage</key>
    <string>TopShelf</string>
</dict>
```

## Step 9: Test Build

1. **Select iOS simulator** and build
2. **Select tvOS simulator** and build
3. **Fix any compilation errors**

## Step 10: App Store Configuration

### iOS App
1. **Archive** > **Distribute App**
2. **App Store Connect** > **Upload**

### tvOS App  
1. **Archive** > **Distribute App**
2. **App Store Connect** > **Upload**
3. **Submit for review**

## Bundle Identifiers

Make sure to use unique bundle identifiers:
- iOS: `com.yourcompany.homeschooldone.ios`
- tvOS: `com.yourcompany.homeschooldone.tvos`

## Firebase Security Rules

Your existing Firestore security rules should work with the iOS/tvOS apps since they use the same authentication system.

## Testing

1. **iOS app**: Sign in and verify dashboard settings display
2. **tvOS app**: Sign in and verify dashboard cycles through students
3. **Real-time updates**: Make changes in web app, verify they appear on TV
4. **Offline behavior**: Test with poor network connectivity

## Troubleshooting

### Firebase Configuration Issues
- Verify `GoogleService-Info.plist` is added to both targets
- Check bundle identifiers match Firebase project settings
- Ensure Firebase is configured before any Firebase calls

### Build Issues
- Clean build folder (Cmd+Shift+K)
- Reset package caches (File > Packages > Reset Package Caches)
- Verify all dependencies are added to correct targets

### Runtime Issues
- Check Firebase console for authentication errors
- Verify Firestore security rules allow access
- Enable debug logging for Firebase

## Next Steps

Once the basic app is working:

1. **Add app icons** for both platforms
2. **Test on physical devices** (especially Apple TV)
3. **Submit to App Store** for review
4. **Add advanced features**:
   - Siri integration
   - Focus engine optimization
   - Offline caching
   - Custom animations