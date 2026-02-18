import SwiftUI
import FirebaseCore
import FirebaseAuth

@main
struct HomeschoolDoneTVApp: App {
    
    init() {
        // Configure Firebase
        if let path = Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") {
            if let plist = FirebaseApp.configure() {
                print("Firebase configured successfully")
            }
        } else {
            print("GoogleService-Info.plist not found - Firebase not configured")
        }
    }
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .preferredColorScheme(.dark)
        }
    }
}