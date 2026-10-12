export const ACTIONS = [
  { id: 'forward', label: 'Move forward', group: 'Movement' },
  { id: 'back', label: 'Move back', group: 'Movement' },
  { id: 'left', label: 'Strafe left', group: 'Movement' },
  { id: 'right', label: 'Strafe right', group: 'Movement' },
  { id: 'jump', label: 'Jump', group: 'Movement' },
  { id: 'crouch', label: 'Crouch / slide', group: 'Movement' },
  { id: 'sprint', label: 'Sprint', group: 'Movement' },
  { id: 'fire', label: 'Fire / use', group: 'Combat' },
  { id: 'scope', label: 'Scope / aim', group: 'Combat' },
  { id: 'reload', label: 'Reload', group: 'Combat' },
  { id: 'inspect', label: 'Inspect weapon', group: 'Combat' },
  { id: 'slot1', label: 'Slot 1', group: 'Weapons' },
  { id: 'slot2', label: 'Slot 2', group: 'Weapons' },
  { id: 'slot3', label: 'Slot 3', group: 'Weapons' },
  { id: 'slot4', label: 'Slot 4', group: 'Weapons' },
] as const;

export type ActionId = (typeof ACTIONS)[number]['id'];

export const DEFAULT_BINDINGS: Record<ActionId, string> = {
  forward: 'KeyW',
  back: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  jump: 'Space',
  crouch: 'ControlLeft',
  sprint: 'ShiftLeft',
  fire: 'Mouse0',
  scope: 'Mouse2',
  reload: 'KeyR',
  inspect: 'KeyF',
  slot1: 'Digit1',
  slot2: 'Digit2',
  slot3: 'Digit3',
  slot4: 'Digit4',
};

export interface Settings {
  sensitivity: number; // multiplier on the base mouse speed, 0.2 .. 3
  invertY: boolean;
  fov: number; // vertical field of view in degrees, 60 .. 110
  aspectRatio: number; // width / height; 0 = fill the window
  /** Render at `aspectRatio` but stretch it over the whole window (CS-style stretched res). */
  stretchRes: boolean;
  toggleCrouch: boolean;
  /** Master volume, 0 .. 1. */
  volume: number;
  muted: boolean;
  /** Scope magnification in "×" on top of the normal FOV. 0 = scope with no zoom at all. */
  scopeZoom: number;
  /** Look-speed multiplier while scoped. */
  scopeSensitivity: number;
  /** Hold the scope key (false) or toggle it on each press (true). */
  toggleScope: boolean;
  /** Firing right after scoping in is nearly as accurate as a settled scope. */
  allowQuickScope: boolean;
  /** Automatically leave the scope after every scoped shot (classic quickscope flow). */
  autoUnscope: boolean;
  /** Time the scope needs to reach full accuracy, in ms. */
  scopeSettleMs: number;
  bindings: Record<ActionId, string>;
}

export const DEFAULT_SETTINGS: Settings = {
  sensitivity: 1,
  invertY: false,
  fov: 78,
  aspectRatio: 0,
  stretchRes: false,
  toggleCrouch: false,
  volume: 0.7,
  muted: false,
  scopeZoom: 3,
  scopeSensitivity: 1,
  toggleScope: false,
  allowQuickScope: true,
  autoUnscope: false,
  scopeSettleMs: 140,
  bindings: { ...DEFAULT_BINDINGS },
};

/** Radians of look per mouse pixel at sensitivity 1. */
export const BASE_LOOK_SPEED = 0.0022;

export const SENSITIVITY_RANGE = { min: 0.2, max: 3, step: 0.05 };
export const FOV_RANGE = { min: 60, max: 110, step: 1 };
export const VOLUME_RANGE = { min: 0, max: 1, step: 0.05 };
/** 0 means "no zoom": the scope overlay shows but the FOV is untouched. */
export const SCOPE_ZOOM_RANGE = { min: 0, max: 8, step: 0.25 };
export const SCOPE_SENSITIVITY_RANGE = { min: 0.2, max: 2, step: 0.05 };
export const SCOPE_SETTLE_RANGE = { min: 0, max: 400, step: 10 };

/** Effective magnification for a `scopeZoom` setting value. */
export function scopeMagnification(scopeZoom: number): number {
  return 1 + Math.max(0, scopeZoom);
}

/**
 * Vertical FOV while scoped. `blend` is how far the scope is up (0..1), so the
 * zoom animates instead of snapping. Because the zoom is applied to the vertical
 * FOV, it behaves identically in stretched resolution.
 *
 * scopeZoom = 0 gives magnification 1, i.e. the scope overlay with no zoom.
 */
export function scopedFov(fov: number, scopeZoom: number, blend: number): number {
  const b = Math.max(0, Math.min(1, blend));
  const zoom = 1 + (scopeMagnification(scopeZoom) - 1) * b;
  return fov / zoom;
}

/**
 * Look-speed multiplier while scoped. Aim gets slower as magnification rises so
 * the scope stays controllable; `scopeSensitivity` lets the player dial it back.
 * A scopeZoom of 0 leaves the feel of hip fire completely untouched.
 */
export function scopeLookScale(scopeZoom: number, blend: number, scopeSensitivity: number): number {
  if (blend <= 0.02) return 1;
  const zoom = 1 + (scopeMagnification(scopeZoom) - 1) * blend;
  return scopeSensitivity / zoom;
}

export const ASPECT_OPTIONS: { label: string; value: number }[] = [
  { label: 'Fill window', value: 0 },
  { label: '16:9', value: 16 / 9 },
  { label: '16:10', value: 16 / 10 },
  { label: '4:3', value: 4 / 3 },
  { label: '5:4', value: 5 / 4 },
  { label: '21:9', value: 21 / 9 },
];

const STORAGE_KEY = 'duel-arena-settings-v1';

function clampNum(v: unknown, lo: number, hi: number, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS, bindings: { ...DEFAULT_BINDINGS } };
    const data = JSON.parse(raw) as Partial<Settings>;
    const bindings = { ...DEFAULT_BINDINGS };
    if (data.bindings && typeof data.bindings === 'object') {
      for (const a of ACTIONS) {
        const v = (data.bindings as Record<string, unknown>)[a.id];
        if (typeof v === 'string' && v.length > 0 && v.length < 32) bindings[a.id] = v;
      }
    }
    const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
    return {
      sensitivity: clampNum(data.sensitivity, SENSITIVITY_RANGE.min, SENSITIVITY_RANGE.max, DEFAULT_SETTINGS.sensitivity),
      invertY: bool(data.invertY, DEFAULT_SETTINGS.invertY),
      fov: clampNum(data.fov, FOV_RANGE.min, FOV_RANGE.max, DEFAULT_SETTINGS.fov),
      aspectRatio: ASPECT_OPTIONS.some((o) => o.value === data.aspectRatio)
        ? (data.aspectRatio as number)
        : DEFAULT_SETTINGS.aspectRatio,
      stretchRes: bool(data.stretchRes, DEFAULT_SETTINGS.stretchRes),
      toggleCrouch: bool(data.toggleCrouch, DEFAULT_SETTINGS.toggleCrouch),
      volume: clampNum(data.volume, VOLUME_RANGE.min, VOLUME_RANGE.max, DEFAULT_SETTINGS.volume),
      muted: bool(data.muted, DEFAULT_SETTINGS.muted),
      scopeZoom: clampNum(data.scopeZoom, SCOPE_ZOOM_RANGE.min, SCOPE_ZOOM_RANGE.max, DEFAULT_SETTINGS.scopeZoom),
      scopeSensitivity: clampNum(
        data.scopeSensitivity,
        SCOPE_SENSITIVITY_RANGE.min,
        SCOPE_SENSITIVITY_RANGE.max,
        DEFAULT_SETTINGS.scopeSensitivity,
      ),
      toggleScope: bool(data.toggleScope, DEFAULT_SETTINGS.toggleScope),
      allowQuickScope: bool(data.allowQuickScope, DEFAULT_SETTINGS.allowQuickScope),
      autoUnscope: bool(data.autoUnscope, DEFAULT_SETTINGS.autoUnscope),
      scopeSettleMs: clampNum(
        data.scopeSettleMs,
        SCOPE_SETTLE_RANGE.min,
        SCOPE_SETTLE_RANGE.max,
        DEFAULT_SETTINGS.scopeSettleMs,
      ),
      bindings,
    };
  } catch {
    return { ...DEFAULT_SETTINGS, bindings: { ...DEFAULT_BINDINGS } };
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable (private mode etc.) - settings just won't persist */
  }
}

/**
 * Assign `code` to `action`. If another action already uses that input, the two
 * swap so no input ever triggers two actions.
 */
export function withBinding(s: Settings, action: ActionId, code: string): Settings {
  const bindings = { ...s.bindings };
  const previous = bindings[action];
  for (const a of ACTIONS) {
    if (a.id !== action && bindings[a.id] === code) bindings[a.id] = previous;
  }
  bindings[action] = code;
  return { ...s, bindings };
}

const KEY_NAMES: Record<string, string> = {
  Space: 'Space',
  ControlLeft: 'Left Ctrl',
  ControlRight: 'Right Ctrl',
  ShiftLeft: 'Left Shift',
  ShiftRight: 'Right Shift',
  AltLeft: 'Left Alt',
  AltRight: 'Right Alt',
  Tab: 'Tab',
  CapsLock: 'Caps Lock',
  Backspace: 'Backspace',
  Enter: 'Enter',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Mouse0: 'Left Mouse',
  Mouse1: 'Middle Mouse',
  Mouse2: 'Right Mouse',
  Mouse3: 'Mouse 4',
  Mouse4: 'Mouse 5',
  ScrollDown: 'Scroll ↓',
  ScrollUp: 'Scroll ↑',
};

export function keyLabel(code: string): string {
  if (KEY_NAMES[code]) return KEY_NAMES[code];
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^Numpad/.test(code)) return 'Num ' + code.slice(6);
  return code;
}
