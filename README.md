# HomeschoolDone

A comprehensive homeschool tracking and dashboard application with web, iOS, and Apple TV support.

## Platform Overview

### 🌐 Web Application (React)
- Complete homeschool management interface
- Student, activity, and goal tracking
- Real-time progress monitoring
- Reports and analytics
- User management and permissions

### 📱 iOS App
- Dashboard configuration and setup
- Quick access to homeschool data
- Apple TV companion app

### 📺 Apple TV App
- Large-screen dashboard display
- Auto-cycling through students
- Real-time progress updates
- Perfect for classroom or home display

## Quick Start

### Web Application
```bash
npm install
npm start
```
Open [http://localhost:3000](http://localhost:3000) to view the web app.

### iOS/Apple TV Apps
See [`ios-tvos/SETUP.md`](ios-tvos/SETUP.md) for detailed setup instructions.

## Architecture

### Frontend (Web)
- **React** with TypeScript
- **Firebase Authentication** for user management
- **Firestore** for real-time data sync
- **Material Design** components

### Mobile/TV (Native)
- **Swift** with SwiftUI
- **Firebase iOS SDK** for data access
- **Shared data models** between platforms
- **Real-time listeners** for live updates

### Backend
- **Firebase Firestore** database
- **Cloud Functions** for server-side logic
- **Firebase Authentication** for security
- **Real-time synchronization** across all platforms

## Features

### Student Management
- Add and track multiple students
- Individual progress monitoring
- Customizable goals and activities
- Time tracking with built-in timer

### Activity Tracking
- Create custom learning activities
- Set time-based goals
- Track completion and progress
- Generate detailed reports

### Dashboard Display
- Full-screen dashboard mode
- Auto-cycling through students
- Real-time progress updates
- Optimized for TV viewing

### User Roles
- **Parents**: Full management access
- **Tutors**: Goal assignment only
- **Observers**: Read-only access
- **Students**: Personal dashboard view

### Real-time Sync
- Changes sync instantly across all devices
- Web app updates appear on TV immediately
- Collaborative family tracking
- Offline resilience

## Deployment

### Web App
```bash
npm run build
firebase deploy --only hosting
```

### Mobile Apps
Follow standard iOS App Store submission process for both iOS and tvOS targets.

## Development

### Web Development
```bash
npm start          # Development server
npm test           # Run tests
npm run build      # Production build
```

### iOS/tvOS Development
1. Open Xcode project in `ios-tvos/` folder
2. Configure Firebase with `GoogleService-Info.plist`
3. Build and run on simulator or device

## Firebase Configuration

1. Create Firebase project
2. Enable Authentication and Firestore
3. Add web app configuration
4. Add iOS app configuration  
5. Download and add configuration files

## Security

- Firebase Authentication for all access
- Firestore security rules for data protection
- Role-based permissions
- No sensitive data in client code

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Submit pull request

## Platform-Specific Documentation

- **Web App**: Standard React development
- **iOS/tvOS**: See [`ios-tvos/README.md`](ios-tvos/README.md)
- **Firebase**: See [`functions/README.md`](functions/README.md)

## Learn More

- [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started)
- [Firebase documentation](https://firebase.google.com/docs)
- [iOS development guide](https://developer.apple.com/ios/)
- [tvOS development guide](https://developer.apple.com/tvos/)