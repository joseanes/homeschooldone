import SwiftUI
import FirebaseCore

@main
struct HomeschoolDoneApp: App {
    
    init() {
        // Configure Firebase
        if let path = Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") {
            FirebaseApp.configure()
            print("Firebase configured successfully")
        } else {
            print("GoogleService-Info.plist not found - Firebase not configured")
        }
    }
    
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}