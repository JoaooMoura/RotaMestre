package com.rotamestre

import android.view.WindowManager
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/** Mantém a tela acesa (FLAG_KEEP_SCREEN_ON) enquanto a navegação estiver ativa. */
class TelaAcesaModule(contexto: ReactApplicationContext) : ReactContextBaseJavaModule(contexto) {
  override fun getName() = "TelaAcesa"

  @ReactMethod
  fun manterAcesa(ligada: Boolean) {
    val atividade = reactApplicationContext.currentActivity ?: return
    atividade.runOnUiThread {
      if (ligada) {
        atividade.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
      } else {
        atividade.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
      }
    }
  }
}
