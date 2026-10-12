import { useEffect, useState } from 'react';
import {
  ACTIONS,
  ASPECT_OPTIONS,
  DEFAULT_SETTINGS,
  FOV_RANGE,
  SENSITIVITY_RANGE,
  keyLabel,
  withBinding,
  type ActionId,
  type Settings,
} from '../data/settings';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-5">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-white/50">{title}</h2>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function SliderRow({
  label,
  hint,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <div>
          <div className="font-semibold">{label}</div>
          {hint && <div className="text-xs text-white/40">{hint}</div>}
        </div>
        <span className="font-mono text-sm text-amber-300">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-amber-500"
      />
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="font-semibold">{label}</div>
        {hint && <div className="text-xs text-white/40">{hint}</div>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-amber-500' : 'bg-white/20'}`}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
            checked ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  );
}

export default function SettingsPanel({
  settings,
  onChange,
  onBack,
}: {
  settings: Settings;
  onChange: (s: Settings) => void;
  onBack: () => void;
}) {
  const [capturing, setCapturing] = useState<ActionId | null>(null);

  // While rebinding, the next key or mouse button becomes the new binding.
  useEffect(() => {
    if (!capturing) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape') {
        setCapturing(null);
        return;
      }
      onChange(withBinding(settings, capturing, e.code));
      setCapturing(null);
    };
    const onMouse = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onChange(withBinding(settings, capturing, `Mouse${e.button}`));
      setCapturing(null);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onChange(withBinding(settings, capturing, e.deltaY > 0 ? 'ScrollDown' : 'ScrollUp'));
      setCapturing(null);
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('mousedown', onMouse, true);
    window.addEventListener('wheel', onWheel, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('mousedown', onMouse, true);
      window.removeEventListener('wheel', onWheel, true);
    };
  }, [capturing, settings, onChange]);

  const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch });
  const groups = Array.from(new Set(ACTIONS.map((a) => a.group)));

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-6 text-white md:p-10">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-white/60 hover:text-white">
          ← Back
        </button>
        <h1 className="text-2xl font-black">Settings</h1>
        <button
          onClick={() => onChange({ ...DEFAULT_SETTINGS, bindings: { ...DEFAULT_SETTINGS.bindings } })}
          className="text-sm text-white/60 hover:text-white"
        >
          Reset all
        </button>
      </div>

      <Section title="Mouse">
        <SliderRow
          label="Mouse sensitivity"
          hint="Multiplier on look speed"
          value={settings.sensitivity}
          display={`${settings.sensitivity.toFixed(2)}×`}
          min={SENSITIVITY_RANGE.min}
          max={SENSITIVITY_RANGE.max}
          step={SENSITIVITY_RANGE.step}
          onChange={(v) => set({ sensitivity: v })}
        />
        <ToggleRow
          label="Invert Y axis"
          hint="Mouse up looks down"
          checked={settings.invertY}
          onChange={(v) => set({ invertY: v })}
        />
      </Section>

      <Section title="Video">
        <SliderRow
          label="Field of view"
          hint="Vertical FOV in degrees"
          value={settings.fov}
          display={`${settings.fov}°`}
          min={FOV_RANGE.min}
          max={FOV_RANGE.max}
          step={FOV_RANGE.step}
          onChange={(v) => set({ fov: v })}
        />
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <div>
              <div className="font-semibold">Aspect ratio</div>
              <div className="text-xs text-white/40">Letterboxes the game view; the HUD stays full-window</div>
            </div>
          </div>
          <select
            value={settings.aspectRatio}
            onChange={(e) => set({ aspectRatio: Number(e.target.value) })}
            className="w-full rounded-lg border border-white/20 bg-slate-900 px-3 py-2 text-white outline-none focus:border-amber-400"
          >
            {ASPECT_OPTIONS.map((o) => (
              <option key={o.label} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </Section>

      <Section title="Movement">
        <ToggleRow
          label="Toggle crouch"
          hint="Press crouch once to crouch, again to stand (off = hold)"
          checked={settings.toggleCrouch}
          onChange={(v) => set({ toggleCrouch: v })}
        />
      </Section>

      <Section title="Controls">
        {groups.map((group) => (
          <div key={group} className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-amber-300/70">{group}</div>
            {ACTIONS.filter((a) => a.group === group).map((a) => {
              const isCapturing = capturing === a.id;
              return (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-black/20 px-3 py-2"
                >
                  <span className="text-sm">{a.label}</span>
                  <button
                    onClick={() => setCapturing(isCapturing ? null : a.id)}
                    className={`min-w-[9rem] rounded-md border px-3 py-1.5 font-mono text-sm transition ${
                      isCapturing
                        ? 'border-amber-400 bg-amber-400/20 text-amber-200'
                        : 'border-white/20 bg-white/5 text-white hover:bg-white/10'
                    }`}
                  >
                    {isCapturing ? 'Press a key… (Esc)' : keyLabel(settings.bindings[a.id])}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-white/40">Mouse buttons can be bound too. Binding a taken key swaps the two.</p>
          <button
            onClick={() => onChange({ ...settings, bindings: { ...DEFAULT_SETTINGS.bindings } })}
            className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/70 hover:bg-white/10"
          >
            Reset controls
          </button>
        </div>
      </Section>
    </div>
  );
}
