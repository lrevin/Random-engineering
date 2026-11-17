package expo.modules.themelauncher

import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * 테마에 맞춰 휴대폰 홈 화면 앱 아이콘 · 시작 화면을 바꿈.
 * - 아이콘: 앱 설정 플러그인(plugins/with-theme-launcher.js)이 테마마다 만든 실행 별칭(.Launcher_<id>) 중 하나만 켬
 * - 시작 화면: 안드로이드 13 이상은 다음 실행부터 테마별 시작 화면 스타일(ThemeLauncherSplash_<id>)을 씀
 */
class ThemeLauncherModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("no context")

  private fun ids(ctx: Context): List<String> {
    val res = ctx.resources.getIdentifier("theme_launcher_ids", "array", ctx.packageName)
    return if (res == 0) emptyList() else ctx.resources.getStringArray(res).toList()
  }

  private fun alias(ctx: Context, id: String) = ComponentName(ctx.packageName, "${ctx.packageName}.Launcher_$id")

  override fun definition() = ModuleDefinition {
    Name("ThemeLauncher")

    /** 지금 켜진 아이콘 테마 id (모르면 classic) */
    Function("current") {
      val ctx = context
      val pm = ctx.packageManager
      ids(ctx).firstOrNull { id ->
        val state = pm.getComponentEnabledSetting(alias(ctx, id))
        state == PackageManager.COMPONENT_ENABLED_STATE_ENABLED ||
          (state == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT && id == "classic")
      } ?: "classic"
    }

    /** 아이콘 · 시작 화면을 이 테마로. 바뀐 게 있으면 true */
    Function("apply") { theme: String ->
      val ctx = context
      val all = ids(ctx)
      if (all.isEmpty()) return@Function false
      val target = if (all.contains(theme)) theme else "classic"
      val pm = ctx.packageManager
      var changed = false
      // 새 아이콘을 먼저 켜고 나머지를 꺼야 잠깐이라도 아이콘이 없는 순간이 생기지 않음
      for (id in listOf(target) + all.filter { it != target }) {
        val want = if (id == target) PackageManager.COMPONENT_ENABLED_STATE_ENABLED else PackageManager.COMPONENT_ENABLED_STATE_DISABLED
        val now = pm.getComponentEnabledSetting(alias(ctx, id))
        val effective = if (now == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT) {
          if (id == "classic") PackageManager.COMPONENT_ENABLED_STATE_ENABLED else PackageManager.COMPONENT_ENABLED_STATE_DISABLED
        } else now
        if (effective != want) {
          pm.setComponentEnabledSetting(alias(ctx, id), want, PackageManager.DONT_KILL_APP)
          changed = true
        }
      }
      // 안드로이드 13+: 다음에 앱을 켤 때 나오는 시작 화면도 테마 색으로 (클래식은 기본 시작 화면)
      if (Build.VERSION.SDK_INT >= 33) {
        appContext.currentActivity?.let { activity ->
          val style = if (target == "classic") 0 else ctx.resources.getIdentifier("ThemeLauncherSplash_$target", "style", ctx.packageName)
          activity.splashScreen.setSplashScreenTheme(style)
        }
      }
      changed
    }
  }
}
