Pod::Spec.new do |s|
  s.name           = 'ThemeLauncher'
  s.version        = '0.1.0'
  s.summary        = 'Theme-matched launcher icon (Android only for now)'
  s.description    = 'Switches the home screen icon and splash to match the app theme.'
  s.author         = ''
  s.homepage       = 'https://github.com/'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = "**/*.{h,m,swift}"
end
