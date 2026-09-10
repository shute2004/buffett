let context: AudioContext | null = null;
let muted = false;

function audio(): AudioContext {
  context ??= new AudioContext();
  if (context.state === "suspended") void context.resume();
  return context;
}

function tone(
  frequency: number,
  durationMs: number,
  type: OscillatorType = "sine",
  volume = 0.04,
  delaySeconds = 0,
): void {
  if (muted) return;
  const ctx = audio();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  const start = ctx.currentTime + delaySeconds;
  const end = start + durationMs / 1000;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(end + 0.02);
}

export const audioService = {
  unlock(): void { if (!muted) audio(); },
  setMuted(value: boolean): void { muted = value; },
  toggleMuted(): boolean { muted = !muted; return muted; },
  isMuted(): boolean { return muted; },
  click(): void { tone(520, 55, "triangle", 0.025); },
  rouletteTick(): void { tone(980, 34, "square", 0.014); },
  rouletteStop(): void {
    tone(430, 90, "triangle", 0.04); tone(660, 130, "triangle", 0.045, 0.07); tone(900, 190, "triangle", 0.04, 0.15);
  },
  step(): void { tone(270, 65, "triangle", 0.035); tone(345, 75, "triangle", 0.025, 0.04); },
  cashUp(): void { tone(560, 80, "sine", 0.04); tone(840, 150, "sine", 0.045, 0.08); },
  cashDown(): void { tone(260, 105, "sawtooth", 0.03); tone(170, 160, "sawtooth", 0.035, 0.08); },
  investUp(): void { tone(470, 70, "triangle", 0.04); tone(700, 100, "triangle", 0.04, 0.07); tone(1040, 170, "triangle", 0.04, 0.15); },
  investDown(): void { tone(390, 75, "sawtooth", 0.032); tone(260, 105, "sawtooth", 0.034, 0.07); tone(165, 165, "sawtooth", 0.034, 0.15); },
  neutral(): void { tone(370, 90, "sine", 0.025); },
  battle(): void { tone(180, 75, "square", 0.03); tone(250, 75, "square", 0.03, 0.075); tone(320, 95, "square", 0.028, 0.15); },
  turn(): void { tone(520, 65, "triangle", 0.03); tone(650, 80, "triangle", 0.03, 0.07); },
};
