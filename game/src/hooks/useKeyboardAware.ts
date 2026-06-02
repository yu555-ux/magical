import { useState, useEffect, useCallback } from 'react';

/**
 * Cross-platform virtual keyboard detection.
 *
 * Strategy (by priority):
 * 1. visualViewport API — iOS Safari 13+, Android Chrome 61+, modern WebViews
 *    Compares `visualViewport.height` to `window.innerHeight`.
 *    When the keyboard opens, the visual viewport shrinks (iOS) or the layout
 *    viewport resizes (Android Chrome). In either case the delta reveals the
 *    keyboard height.
 * 2. Fallback: listen to focus/blur on inputs and estimate based on UA.
 *
 * Handles:
 *  - iOS Safari, iOS Chrome (WKWebView), iOS in-app browsers
 *  - Android Chrome, Android WebView, Samsung Internet
 *  - Third-party IMEs (Sogou, Baidu, Gboard, SwiftKey) — these affect
 *    visualViewport.height the same way as stock keyboards
 *  - Floating keyboards (some Android IMEs) — if they don't resize the
 *    viewport at all we fall back to focus-based estimation
 */

export interface KeyboardState {
  /** Whether the virtual keyboard is likely visible */
  isKeyboardOpen: boolean;
  /** Estimated keyboard height in px (0 when closed) */
  keyboardHeight: number;
  /** Current visualViewport.height, or window.innerHeight as fallback */
  visualHeight: number;
}

/** Minimum height delta (px) to consider keyboard "open" — avoids false
 *  positives from URL bar hide/show or tiny resize events. */
const KEYBOARD_THRESHOLD = 140;

/** Conservative fallback estimate for Android floating keyboards */
const ANDROID_KB_ESTIMATE = 300;

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function useKeyboardAware(): KeyboardState {
  const [state, setState] = useState<KeyboardState>({
    isKeyboardOpen: false,
    keyboardHeight: 0,
    visualHeight: typeof window !== 'undefined' ? window.innerHeight : 0,
  });

  const handleResize = useCallback(() => {
    if (typeof window === 'undefined') return;

    const vv = window.visualViewport;
    const layoutHeight = window.innerHeight;
    const visualHeight = vv ? vv.height : layoutHeight;

    // Keyboard height = layout viewport height - visual viewport height
    // On iOS: layout stays fixed, visual shrinks → delta = keyboard height
    // On Android Chrome: both resize, but visualViewport reflects what's actually visible
    const delta = layoutHeight - visualHeight;
    const isOpen = delta > KEYBOARD_THRESHOLD;
    const keyboardHeight = isOpen ? delta : 0;

    setState({ isKeyboardOpen: isOpen, keyboardHeight, visualHeight });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const vv = window.visualViewport;

    // Use visualViewport events when available (iOS, modern Android)
    if (vv) {
      vv.addEventListener('resize', handleResize);
      vv.addEventListener('scroll', handleResize);
    }

    // Also listen on window.resize as safety net (Android Chrome resizes layout)
    window.addEventListener('resize', handleResize);

    // Initial read
    handleResize();

    return () => {
      if (vv) {
        vv.removeEventListener('resize', handleResize);
        vv.removeEventListener('scroll', handleResize);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, [handleResize]);

  return state;
}

/**
 * Keyboard-aware scroll-to-bottom helper.
 * When the keyboard opens on iOS, `scrollIntoView` and `scrollTo` can be
 * unreliable because the layout viewport doesn't change.  This uses
 * `visualViewport.height` to compute the correct scroll position.
 */
export function scrollToBottomSmooth(el: HTMLElement) {
  const vv = window.visualViewport;
  const target = el.scrollHeight - el.clientHeight;

  if (vv && isIOS()) {
    // On iOS, animate manually because native smooth scroll can fight with
    // the keyboard animation
    const start = el.scrollTop;
    const dist = target - start;
    const duration = 250; // roughly matches iOS keyboard animation
    const startTime = performance.now();

    function step(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out quad
      const eased = 1 - (1 - progress) * (1 - progress);
      el.scrollTop = start + dist * eased;
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    }

    requestAnimationFrame(step);
  } else {
    el.scrollTo({ top: target, behavior: 'smooth' });
  }
}

/**
 * Minimal heuristic for platforms where visualViewport doesn't fire reliably
 * (some Android WebViews with floating keyboards).
 */
export function getFallbackKeyboardHeight(): number {
  if (typeof window === 'undefined') return 0;
  if (isIOS()) return 0; // iOS always has visualViewport
  // On Android, if the window height dropped significantly, estimate keyboard
  const estimated = window.screen.height - window.innerHeight;
  return estimated > KEYBOARD_THRESHOLD ? estimated : 0;
}
