/**
 * Where the 3D view goes inside the browser window.
 *
 * A fixed aspect ratio always changes the *render* resolution — that is what
 * makes the view genuinely lower-resolution, like playing at 1280x960. What
 * differs is how that buffer is presented:
 *
 *  - letterboxed: centred in the window with black bars either side,
 *  - stretched: scaled over the whole window, so a 4:3 buffer is pulled wide.
 *    This is the CS-style "stretched resolution" look: models appear wider and
 *    seem to cross the screen faster, while the vertical FOV (and therefore
 *    aim) is untouched.
 */
export interface ViewLayout {
  /** Drawing-buffer size, in CSS pixels. */
  renderWidth: number;
  renderHeight: number;
  /** Canvas offset within the window. */
  left: number;
  top: number;
  /** Size the canvas is displayed at. */
  cssWidth: number;
  cssHeight: number;
  /** True when the buffer is being scaled to cover the window. */
  stretched: boolean;
}

export function computeViewLayout(
  windowWidth: number,
  windowHeight: number,
  aspectRatio: number,
  stretch: boolean,
): ViewLayout {
  let w = windowWidth;
  let h = windowHeight;
  if (aspectRatio > 0) {
    if (windowWidth / windowHeight > aspectRatio) w = Math.round(windowHeight * aspectRatio);
    else h = Math.round(windowWidth / aspectRatio);
  }
  const stretched = aspectRatio > 0 && stretch;
  return {
    renderWidth: w,
    renderHeight: h,
    left: stretched ? 0 : Math.round((windowWidth - w) / 2),
    top: stretched ? 0 : Math.round((windowHeight - h) / 2),
    cssWidth: stretched ? windowWidth : w,
    cssHeight: stretched ? windowHeight : h,
    stretched,
  };
}
