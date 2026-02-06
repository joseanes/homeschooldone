# Uncomment the next line to define a global platform for your project
platform :ios, '15.0'
# Or for macOS:
# platform :osx, '12.0'

target 'HomeschoolDone' do
  # Comment the next line if you don't want to use dynamic frameworks
  use_frameworks!

  # Firebase pods
  pod 'Firebase/Auth'
  pod 'Firebase/Firestore'
  
  # If you have a tvOS target
  # target 'HomeschoolDone_tvOS' do
  #   inherit! :search_paths
  # end
  
end

post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.0'
    end
  end
end
