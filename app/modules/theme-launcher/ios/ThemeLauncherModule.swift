import ExpoModulesCore

/// 아이폰은 아직 테마별 아이콘을 넣지 않음 (대체 아이콘 그림 · Info.plist 설정이 필요). 호출해도 아무것도 바꾸지 않음
public class ThemeLauncherModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ThemeLauncher")
    Function("current") { () -> String in "classic" }
    Function("apply") { (_: String) -> Bool in false }
  }
}
