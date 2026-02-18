import SwiftUI
import FirebaseCore
import FirebaseAuth

@main
struct HomeschoolDoneTVApp: App {

    init() {
        // Configure Firebase with web API key to avoid iOS bundle ID restrictions on tvOS
        let options = FirebaseOptions(
            googleAppID: "1:597375552014:ios:96d10fee863a6ec0620a5f",
            gcmSenderID: "597375552014"
        )
        options.apiKey = "AIzaSyDxRPh5cYPqU1LTmirK3-P_vKK-2bqmzLg"
        options.projectID = "homeschooldone"
        options.storageBucket = "homeschooldone.firebasestorage.app"
        FirebaseApp.configure(options: options)
        print("🚀 HomeschoolDone tvOS App Starting - Firebase configured")
    }
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .preferredColorScheme(.dark)
        }
    }
}