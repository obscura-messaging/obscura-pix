import UIKit

/// Blocks screenshots, screen recording, and mirroring of the app's UI.
///
/// iOS has no API to forbid capture, but content rendered inside a secure text field's layer is
/// excluded from every capture path (screenshots, recordings, AirPlay) and shows as black. Moving the
/// window's layer into that secure container applies the same protection to the whole UI. Only the
/// layer tree changes; the view hierarchy and touch handling are untouched.
enum ScreenSecurity {
  /// Holds the secure field alive. It is deliberately NOT a subview of the window: the window's
  /// layer is moved inside the field's layer, so a field that was also the window's subview would
  /// make each the other's ancestor, and UIKit's inherited-tint lookup recurses until the stack
  /// overflows.
  private static var secureField: UITextField?

  /// Call once, after the window is visible (its layer must already have a superlayer).
  static func protect(_ window: UIWindow) {
    let field = UITextField()
    field.isSecureTextEntry = true
    field.isUserInteractionEnabled = false
    field.layoutIfNeeded()
    secureField = field

    // The secure canvas is the field's first sublayer before iOS 17 and its last from iOS 17 on.
    let canvas: CALayer?
    if #available(iOS 17.0, *) {
      canvas = field.layer.sublayers?.last
    } else {
      canvas = field.layer.sublayers?.first
    }
    guard let superlayer = window.layer.superlayer, let canvas else {
      NSLog("[ScreenSecurity] secure layer unavailable; capture is NOT blocked")
      return
    }
    superlayer.addSublayer(field.layer)
    canvas.addSublayer(window.layer)
  }
}
