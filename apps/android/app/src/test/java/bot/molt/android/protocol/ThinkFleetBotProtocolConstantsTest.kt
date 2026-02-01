package bot.molt.android.protocol

import org.junit.Assert.assertEquals
import org.junit.Test

class ThinkFleetBotProtocolConstantsTest {
  @Test
  fun canvasCommandsUseStableStrings() {
    assertEquals("canvas.present", ThinkFleetBotCanvasCommand.Present.rawValue)
    assertEquals("canvas.hide", ThinkFleetBotCanvasCommand.Hide.rawValue)
    assertEquals("canvas.navigate", ThinkFleetBotCanvasCommand.Navigate.rawValue)
    assertEquals("canvas.eval", ThinkFleetBotCanvasCommand.Eval.rawValue)
    assertEquals("canvas.snapshot", ThinkFleetBotCanvasCommand.Snapshot.rawValue)
  }

  @Test
  fun a2uiCommandsUseStableStrings() {
    assertEquals("canvas.a2ui.push", ThinkFleetBotCanvasA2UICommand.Push.rawValue)
    assertEquals("canvas.a2ui.pushJSONL", ThinkFleetBotCanvasA2UICommand.PushJSONL.rawValue)
    assertEquals("canvas.a2ui.reset", ThinkFleetBotCanvasA2UICommand.Reset.rawValue)
  }

  @Test
  fun capabilitiesUseStableStrings() {
    assertEquals("canvas", ThinkFleetBotCapability.Canvas.rawValue)
    assertEquals("camera", ThinkFleetBotCapability.Camera.rawValue)
    assertEquals("screen", ThinkFleetBotCapability.Screen.rawValue)
    assertEquals("voiceWake", ThinkFleetBotCapability.VoiceWake.rawValue)
  }

  @Test
  fun screenCommandsUseStableStrings() {
    assertEquals("screen.record", ThinkFleetBotScreenCommand.Record.rawValue)
  }
}
