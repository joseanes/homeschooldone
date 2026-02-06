import SwiftUI
import FirebaseCore
import FirebaseAuth

@main
struct HomeschoolDoneTVApp: App {
    
    init() {
        // Configure Firebase
        FirebaseApp.configure()
        print("🚀 HomeschoolDone tvOS App Starting - Firebase configured")
    }
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .preferredColorScheme(.dark)
        }
    }
}