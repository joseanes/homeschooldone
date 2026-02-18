# HomeschoolDone iOS/tvOS App

Native iOS and tvOS applications for HomeschoolDone.

## Project Structure

- **HomeschoolDone** - iOS app target (for managing dashboard settings)
- **HomeschoolDone-tvOS** - tvOS app target (for displaying dashboard on Apple TV)
- **Shared** - Shared code between iOS and tvOS targets

## Setup Instructions

1. Open `HomeschoolDone.xcodeproj` in Xcode
2. Select your development team in project settings
3. Update bundle identifiers if needed
4. Add Firebase configuration files (see below)

## Firebase Setup

1. Copy `GoogleService-Info.plist` from your Firebase Console
2. Add it to both iOS and tvOS targets
3. Ensure Firebase is configured for iOS in your project settings

## Development

### iOS Target
- Dashboard management and settings
- Full CRUD operations
- User authentication

### tvOS Target
- Read-only dashboard display
- Auto-cycling through students
- Large fonts optimized for TV viewing
- Remote control navigation

## Building and Running

### iOS Simulator
```bash
xcodebuild -project HomeschoolDone.xcodeproj -scheme HomeschoolDone-iOS -sdk iphonesimulator
```

### tvOS Simulator
```bash
xcodebuild -project HomeschoolDone.xcodeproj -scheme HomeschoolDone-tvOS -sdk appletvsimulator
```

## App Store Deployment

### iOS App
- Bundle ID: `com.yourcompany.homeschooldone.ios`
- Target: iOS 15.0+

### tvOS App
- Bundle ID: `com.yourcompany.homeschooldone.tvos` 
- Target: tvOS 15.0+

## Firebase Integration

Uses the same Firestore database as the web application:
- `homeschools` collection
- `people` collection (students)
- `activities` collection
- `goals` collection
- `activity-instances` collection

Real-time updates via Firebase listeners ensure dashboard stays current with web app changes.