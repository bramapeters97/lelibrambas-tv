import { writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SAMPLE_RATE = 48_000;
const requestedDuration = Number.parseFloat(process.argv[2] ?? '4.8');

if (!Number.isFinite(requestedDuration) || requestedDuration < 2 || requestedDuration > 8) {
  throw new Error('Duration must be a number between 2 and 8 seconds.');
}

const DURATION = requestedDuration;
const FRAME_COUNT = Math.round(SAMPLE_RATE * DURATION);
const OUTPUT_DIR = fileURLToPath(new URL('.', import.meta.url));
const BASENAME = 'lelibrambas-plus-magical-app-launch';
const left = new Float64Array(FRAME_COUNT);
const right = new Float64Array(FRAME_COUNT);

let randomState = 0x4c454c49;
function random() {
  randomState ^= randomState << 13;
  randomState ^= randomState >>> 17;
  randomState ^= randomState << 5;
  return (randomState >>> 0) / 0x1_0000_0000;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function secondsToFrame(seconds) {
  return Math.max(0, Math.round(seconds * SAMPLE_RATE));
}

function equalPowerPan(pan) {
  const angle = ((clamp(pan, -1, 1) + 1) * Math.PI) / 4;
  return [Math.cos(angle), Math.sin(angle)];
}

function smoothstep(value) {
  const x = clamp(value, 0, 1);
  return x * x * (3 - 2 * x);
}

function addRoundedPulse({ start, frequency, duration, gain, pan = 0 }) {
  const startFrame = secondsToFrame(start);
  const endFrame = Math.min(FRAME_COUNT, secondsToFrame(start + duration));
  const [leftGain, rightGain] = equalPowerPan(pan);
  let phase = 0;

  for (let frame = startFrame; frame < endFrame; frame += 1) {
    const age = (frame - startFrame) / SAMPLE_RATE;
    const progress = age / duration;
    const attack = smoothstep(age / 0.025);
    const release = Math.exp(-7.2 * progress);
    const pitch = frequency * (1 + 0.025 * Math.exp(-18 * age));
    phase += (2 * Math.PI * pitch) / SAMPLE_RATE;
    const body = Math.sin(phase) + 0.18 * Math.sin(phase * 2.002);
    const sample = body * attack * release * gain;
    left[frame] += sample * leftGain;
    right[frame] += sample * rightGain;
  }
}

function addGlassTone({ start, frequency, duration, gain, pan = 0, brightness = 1 }) {
  const startFrame = secondsToFrame(start);
  const endFrame = Math.min(FRAME_COUNT, secondsToFrame(start + duration));
  const [leftGain, rightGain] = equalPowerPan(pan);
  const partials = [
    [1, 1, 2.55],
    [2.01, 0.17 * brightness, 4.1],
    [3.98, 0.065 * brightness, 5.7],
    [6.04, 0.022 * brightness, 7.6],
  ];
  const phases = partials.map((_, index) => 0.31 + index * 0.77);

  for (let frame = startFrame; frame < endFrame; frame += 1) {
    const age = (frame - startFrame) / SAMPLE_RATE;
    const progress = age / duration;
    const attack = smoothstep(age / 0.008);
    const tail = smoothstep((duration - age) / Math.min(0.28, duration * 0.3));
    const microPitch = 1 + 0.0018 * Math.exp(-10 * age);
    let sample = 0;

    for (let partialIndex = 0; partialIndex < partials.length; partialIndex += 1) {
      const [ratio, level, decay] = partials[partialIndex];
      phases[partialIndex] +=
        (2 * Math.PI * frequency * ratio * microPitch) / SAMPLE_RATE;
      sample +=
        Math.sin(phases[partialIndex]) * level * Math.exp(-decay * progress);
    }

    const envelope = attack * tail * (0.84 + 0.16 * Math.exp(-30 * age));
    const value = sample * envelope * gain;
    left[frame] += value * leftGain;
    right[frame] += value * rightGain;
  }
}

function addWarmBed({ start, duration, frequencies, gain }) {
  const startFrame = secondsToFrame(start);
  const endFrame = Math.min(FRAME_COUNT, secondsToFrame(start + duration));
  const phases = frequencies.map((_, index) => 0.4 + index * 1.1);

  for (let frame = startFrame; frame < endFrame; frame += 1) {
    const age = (frame - startFrame) / SAMPLE_RATE;
    const attack = smoothstep(age / 0.18);
    const release = smoothstep((duration - age) / 0.62);
    let center = 0;
    let side = 0;

    for (let index = 0; index < frequencies.length; index += 1) {
      const slowDrift = 1 + 0.0007 * Math.sin(2 * Math.PI * (0.11 + index * 0.03) * age);
      phases[index] += (2 * Math.PI * frequencies[index] * slowDrift) / SAMPLE_RATE;
      center += Math.sin(phases[index]) * (index === 0 ? 0.7 : 0.32);
      side += Math.sin(phases[index] + (index - 1) * 0.018) * 0.11;
    }

    const envelope = attack * release * gain;
    left[frame] += (center + side) * envelope;
    right[frame] += (center - side) * envelope;
  }
}

function addAir({ start, duration, gain, pan = 0 }) {
  const startFrame = secondsToFrame(start);
  const endFrame = Math.min(FRAME_COUNT, secondsToFrame(start + duration));
  const [leftGain, rightGain] = equalPowerPan(pan);
  let previousNoise = 0;
  let previousHigh = 0;

  for (let frame = startFrame; frame < endFrame; frame += 1) {
    const age = (frame - startFrame) / SAMPLE_RATE;
    const white = random() * 2 - 1;
    const high = 0.83 * (previousHigh + white - previousNoise);
    previousNoise = white;
    previousHigh = high;
    const attack = smoothstep(age / 0.055);
    const release = smoothstep((duration - age) / 0.3);
    const value = high * attack * release * Math.exp(-1.3 * age) * gain;
    left[frame] += value * leftGain;
    right[frame] += value * rightGain;
  }
}

function addCinematicBlast({ start, duration, frequencies, gain }) {
  const startFrame = secondsToFrame(start);
  const endFrame = Math.min(FRAME_COUNT, secondsToFrame(start + duration));
  const harmonicRatios = [0.5, 1, 2, 3, 4, 5];
  const harmonicLevels = [0.2, 1, 0.52, 0.28, 0.15, 0.08];
  const phases = frequencies.map((_, noteIndex) =>
    harmonicRatios.map((__, harmonicIndex) => 0.37 + noteIndex * 0.81 + harmonicIndex * 0.29),
  );
  const sidePhases = frequencies.map((_, noteIndex) => 0.9 + noteIndex * 1.23);

  for (let frame = startFrame; frame < endFrame; frame += 1) {
    const age = (frame - startFrame) / SAMPLE_RATE;
    const progress = age / duration;
    const attack = smoothstep(age / 0.014);
    const release = smoothstep((duration - age) / Math.min(0.9, duration * 0.35));
    const impact = 0.72 + 0.28 * Math.exp(-8.5 * age);
    let center = 0;
    let side = 0;

    for (let noteIndex = 0; noteIndex < frequencies.length; noteIndex += 1) {
      const noteLevel = [1, 0.46, 0.26][noteIndex] ?? 0.18;
      const pitchDrop = 1 + 0.075 * Math.exp(-7.5 * age) - 0.013 * progress;
      for (let harmonicIndex = 0; harmonicIndex < harmonicRatios.length; harmonicIndex += 1) {
        const ratio = harmonicRatios[harmonicIndex];
        phases[noteIndex][harmonicIndex] +=
          (2 * Math.PI * frequencies[noteIndex] * ratio * pitchDrop) / SAMPLE_RATE;
        const harmonicDecay = Math.exp(-(0.58 + harmonicIndex * 0.22) * progress);
        center +=
          Math.sin(phases[noteIndex][harmonicIndex]) *
          harmonicLevels[harmonicIndex] *
          noteLevel *
          harmonicDecay;
      }

      sidePhases[noteIndex] +=
        (2 * Math.PI * frequencies[noteIndex] * 3.004 * pitchDrop) / SAMPLE_RATE;
      side += Math.sin(sidePhases[noteIndex]) * noteLevel * 0.075 * Math.exp(-1.2 * progress);
    }

    const envelope = attack * release * impact * gain;
    const saturatedCenter = Math.tanh(center * 1.12) / Math.tanh(1.12);
    left[frame] += (saturatedCenter + side) * envelope;
    right[frame] += (saturatedCenter - side) * envelope;
  }
}

function addAnticipationRiser({ start, duration, gain }) {
  const startFrame = secondsToFrame(start);
  const endFrame = Math.min(FRAME_COUNT, secondsToFrame(start + duration));
  let tonalPhase = 0;
  let leftLowPass = 0;
  let rightLowPass = 0;
  let previousLeft = 0;
  let previousRight = 0;

  for (let frame = startFrame; frame < endFrame; frame += 1) {
    const age = (frame - startFrame) / SAMPLE_RATE;
    const progress = clamp(age / duration, 0, 1);
    const rise = smoothstep(progress) ** 1.4;
    const release = smoothstep((duration - age) / 0.085);
    const frequency = 92 * (348 / 92) ** progress;
    tonalPhase += (2 * Math.PI * frequency) / SAMPLE_RATE;

    const cutoff = 260 * (5_800 / 260) ** progress;
    const coefficient = 1 - Math.exp((-2 * Math.PI * cutoff) / SAMPLE_RATE);
    const leftNoise = random() * 2 - 1;
    const rightNoise = random() * 2 - 1;
    leftLowPass += coefficient * (leftNoise - leftLowPass);
    rightLowPass += coefficient * (rightNoise - rightLowPass);
    const leftHigh = leftLowPass - previousLeft;
    const rightHigh = rightLowPass - previousRight;
    previousLeft = leftLowPass;
    previousRight = rightLowPass;

    const tonal = Math.sin(tonalPhase) * (0.15 + 0.2 * progress);
    const envelope = rise * release * gain;
    left[frame] += (tonal + leftHigh * 3.2) * envelope;
    right[frame] += (tonal + rightHigh * 3.2) * envelope;
  }
}

function addOrchestralBloom({ start, duration, frequencies, gain, attack = 0.18, release = 0.65 }) {
  const startFrame = secondsToFrame(start);
  const endFrame = Math.min(FRAME_COUNT, secondsToFrame(start + duration));
  const harmonicLevels = [1, 0.34, 0.17, 0.09, 0.045, 0.022];
  const centerPhases = frequencies.map((_, noteIndex) =>
    harmonicLevels.map((__, harmonicIndex) => 0.23 + noteIndex * 0.91 + harmonicIndex * 0.47),
  );
  const leftPhases = frequencies.map((_, index) => 0.7 + index * 0.61);
  const rightPhases = frequencies.map((_, index) => 1.2 + index * 0.73);
  const leftDetune = 2 ** (-3 / 1200);
  const rightDetune = 2 ** (3 / 1200);

  for (let frame = startFrame; frame < endFrame; frame += 1) {
    const age = (frame - startFrame) / SAMPLE_RATE;
    const progress = age / duration;
    const envelope =
      smoothstep(age / attack) *
      smoothstep((duration - age) / release) *
      (0.86 + 0.14 * Math.exp(-1.4 * progress));
    const bow = 0.985 + 0.015 * Math.sin(2 * Math.PI * 5.1 * age);
    let center = 0;
    let leftSide = 0;
    let rightSide = 0;

    for (let noteIndex = 0; noteIndex < frequencies.length; noteIndex += 1) {
      const noteLevel = [1, 0.72, 0.54, 0.42][noteIndex] ?? 0.32;
      for (let harmonicIndex = 0; harmonicIndex < harmonicLevels.length; harmonicIndex += 1) {
        const harmonic = harmonicIndex + 1;
        centerPhases[noteIndex][harmonicIndex] +=
          (2 * Math.PI * frequencies[noteIndex] * harmonic) / SAMPLE_RATE;
        center +=
          Math.sin(centerPhases[noteIndex][harmonicIndex]) *
          harmonicLevels[harmonicIndex] *
          noteLevel;
      }

      leftPhases[noteIndex] +=
        (2 * Math.PI * frequencies[noteIndex] * 2 * leftDetune) / SAMPLE_RATE;
      rightPhases[noteIndex] +=
        (2 * Math.PI * frequencies[noteIndex] * 2 * rightDetune) / SAMPLE_RATE;
      leftSide += Math.sin(leftPhases[noteIndex]) * noteLevel * 0.11;
      rightSide += Math.sin(rightPhases[noteIndex]) * noteLevel * 0.11;
    }

    const level = envelope * bow * gain;
    left[frame] += (center * 0.62 + leftSide) * level;
    right[frame] += (center * 0.62 + rightSide) * level;
  }
}

function addHarpPluck({ start, frequency, duration, gain, pan = 0 }) {
  const startFrame = secondsToFrame(start);
  const endFrame = Math.min(FRAME_COUNT, secondsToFrame(start + duration));
  const [leftGain, rightGain] = equalPowerPan(pan);
  const phases = [0.2, 0.7, 1.3, 1.9, 2.4, 2.9];

  for (let frame = startFrame; frame < endFrame; frame += 1) {
    const age = (frame - startFrame) / SAMPLE_RATE;
    const attack = smoothstep(age / 0.006);
    const release = smoothstep((duration - age) / Math.min(0.2, duration * 0.25));
    let sample = 0;

    for (let harmonicIndex = 0; harmonicIndex < phases.length; harmonicIndex += 1) {
      const harmonic = harmonicIndex + 1;
      phases[harmonicIndex] += (2 * Math.PI * frequency * harmonic) / SAMPLE_RATE;
      const harmonicLevel = 1 / harmonic ** 1.58;
      const decay = Math.exp(-(2.1 + harmonicIndex * 0.72) * age / duration);
      sample += Math.sin(phases[harmonicIndex]) * harmonicLevel * decay;
    }

    const value = sample * attack * release * gain;
    left[frame] += value * leftGain;
    right[frame] += value * rightGain;
  }
}

function addMagicRiser({ start, duration, gain }) {
  const startFrame = secondsToFrame(start);
  const endFrame = Math.min(FRAME_COUNT, secondsToFrame(start + duration));
  let tonalPhase = 0;
  let leftSmooth = 0;
  let rightSmooth = 0;

  for (let frame = startFrame; frame < endFrame; frame += 1) {
    const age = (frame - startFrame) / SAMPLE_RATE;
    const progress = clamp(age / duration, 0, 1);
    const rise = smoothstep(progress) ** 1.65;
    const release = smoothstep((duration - age) / 0.075);
    const frequency = 392 * (1046.502 / 392) ** progress;
    tonalPhase += (2 * Math.PI * frequency) / SAMPLE_RATE;
    const cutoff = 900 + progress * 5_800;
    const coefficient = 1 - Math.exp((-2 * Math.PI * cutoff) / SAMPLE_RATE);
    leftSmooth += coefficient * (random() * 2 - 1 - leftSmooth);
    rightSmooth += coefficient * (random() * 2 - 1 - rightSmooth);
    const tonal = Math.sin(tonalPhase) * (0.11 + progress * 0.09);
    const envelope = rise * release * gain;
    left[frame] += (tonal + leftSmooth * 0.24) * envelope;
    right[frame] += (tonal + rightSmooth * 0.24) * envelope;
  }
}

// Original five-note wonder motif over an E(add9) -> A6 -> Bsus -> E6/9 arc.
// The major third arrives at the final bloom, turning curiosity into a warm welcome.
addMagicRiser({ start: 0.0, duration: 0.18, gain: 0.007 });
addRoundedPulse({ start: 0.075, frequency: 123.471, duration: 0.62, gain: 0.038, pan: 0 });
addOrchestralBloom({
  start: 0.02,
  duration: 0.82,
  frequencies: [123.471, 164.814, 184.997, 246.942],
  gain: 0.034,
  attack: 0.15,
  release: 0.28,
});
addHarpPluck({ start: 0.08, frequency: 246.942, duration: 0.72, gain: 0.022, pan: -0.12 });
addHarpPluck({ start: 0.185, frequency: 329.628, duration: 0.72, gain: 0.02, pan: 0.12 });
addHarpPluck({ start: 0.335, frequency: 369.994, duration: 0.76, gain: 0.018, pan: -0.08 });
addGlassTone({ start: 0.22, frequency: 493.883, duration: 0.82, gain: 0.064, pan: -0.12, brightness: 0.72 });
addGlassTone({ start: 0.61, frequency: 739.989, duration: 0.9, gain: 0.068, pan: 0.16, brightness: 0.78 });

addOrchestralBloom({
  start: 0.76,
  duration: 0.86,
  frequencies: [110, 164.814, 184.997, 277.183],
  gain: 0.036,
  attack: 0.17,
  release: 0.3,
});
addHarpPluck({ start: 0.79, frequency: 220, duration: 0.72, gain: 0.019, pan: -0.1 });
addHarpPluck({ start: 0.93, frequency: 329.628, duration: 0.74, gain: 0.018, pan: 0.11 });
addGlassTone({ start: 1.08, frequency: 554.365, duration: 0.9, gain: 0.061, pan: -0.14, brightness: 0.72 });

addOrchestralBloom({
  start: 1.45,
  duration: 1.0,
  frequencies: [123.471, 184.997, 277.183, 329.628],
  gain: 0.039,
  attack: 0.2,
  release: 0.38,
});
addHarpPluck({ start: 1.49, frequency: 246.942, duration: 0.78, gain: 0.019, pan: -0.1 });
addHarpPluck({ start: 1.635, frequency: 277.183, duration: 0.76, gain: 0.018, pan: 0.1 });
addGlassTone({ start: 1.6, frequency: 622.254, duration: 0.94, gain: 0.064, pan: 0.13, brightness: 0.74 });
addHarpPluck({ start: 1.8, frequency: 329.628, duration: 0.76, gain: 0.018, pan: -0.08 });

addMagicRiser({ start: 1.95, duration: 0.33, gain: 0.018 });

addRoundedPulse({ start: 2.28, frequency: 82.407, duration: 1.38, gain: 0.073, pan: 0 });
addOrchestralBloom({
  start: 2.24,
  duration: Math.max(2.35, DURATION - 2.28),
  frequencies: [82.407, 123.471, 164.814, 207.652],
  gain: 0.072,
  attack: 0.095,
  release: 1.0,
});
addOrchestralBloom({
  start: 2.26,
  duration: Math.max(2.28, DURATION - 2.32),
  frequencies: [277.183, 369.994, 493.883],
  gain: 0.032,
  attack: 0.11,
  release: 0.92,
});
addGlassTone({ start: 2.28, frequency: 659.255, duration: 1.62, gain: 0.076, pan: 0.05, brightness: 0.78 });
addGlassTone({ start: 2.32, frequency: 1318.51, duration: 1.5, gain: 0.025, pan: 0.22, brightness: 0.68 });
addHarpPluck({ start: 2.285, frequency: 164.814, duration: 0.96, gain: 0.022, pan: -0.1 });
addHarpPluck({ start: 2.43, frequency: 246.942, duration: 0.94, gain: 0.021, pan: 0.11 });
addHarpPluck({ start: 2.625, frequency: 277.183, duration: 0.9, gain: 0.019, pan: -0.12 });
addHarpPluck({ start: 2.865, frequency: 369.994, duration: 0.88, gain: 0.018, pan: 0.13 });
addHarpPluck({ start: 3.145, frequency: 415.305, duration: 0.86, gain: 0.017, pan: -0.08 });
addGlassTone({ start: 3.38, frequency: 987.767, duration: 1.08, gain: 0.021, pan: 0.27, brightness: 0.58 });
addGlassTone({ start: 3.72, frequency: 1479.978, duration: 0.84, gain: 0.014, pan: -0.24, brightness: 0.52 });
addAir({ start: 2.28, duration: Math.max(1.9, DURATION - 2.34), gain: 0.0022, pan: 0.12 });

function addStereoReverb() {
  const dryLeft = Float64Array.from(left);
  const dryRight = Float64Array.from(right);
  const taps = [
    [0.043, 0.075],
    [0.071, 0.056],
    [0.109, 0.043],
    [0.167, 0.031],
    [0.239, 0.022],
  ];

  for (const [delaySeconds, gain] of taps) {
    const delay = secondsToFrame(delaySeconds);
    for (let frame = delay; frame < FRAME_COUNT; frame += 1) {
      const sourceFrame = frame - delay;
      const damping = 1 - 0.12 * (delaySeconds / 0.239);
      left[frame] +=
        (dryLeft[sourceFrame] * 0.72 + dryRight[sourceFrame] * 0.28) * gain * damping;
      right[frame] +=
        (dryRight[sourceFrame] * 0.72 + dryLeft[sourceFrame] * 0.28) * gain * damping;
    }
  }
}

addStereoReverb();

function filterChannel(samples) {
  let previousInput = 0;
  let previousOutput = 0;
  const highPassCoefficient = Math.exp((-2 * Math.PI * 40) / SAMPLE_RATE);
  let lowPassState = 0;
  const lowPassCoefficient = 1 - Math.exp((-2 * Math.PI * 18_500) / SAMPLE_RATE);

  for (let frame = 0; frame < samples.length; frame += 1) {
    const input = samples[frame];
    const highPassed = highPassCoefficient * (previousOutput + input - previousInput);
    previousInput = input;
    previousOutput = highPassed;
    lowPassState += lowPassCoefficient * (highPassed - lowPassState);
    samples[frame] = lowPassState;
  }
}

filterChannel(left);
filterChannel(right);

function applyEdgeFades() {
  const fadeInFrames = secondsToFrame(0.006);
  const fadeOutFrames = Math.min(secondsToFrame(0.18), Math.floor(FRAME_COUNT * 0.12));
  for (let frame = 0; frame < FRAME_COUNT; frame += 1) {
    const fadeIn = frame < fadeInFrames ? smoothstep(frame / fadeInFrames) : 1;
    const framesFromEnd = FRAME_COUNT - 1 - frame;
    const fadeOut = framesFromEnd < fadeOutFrames ? smoothstep(framesFromEnd / fadeOutFrames) : 1;
    const edgeGain = fadeIn * fadeOut;
    left[frame] *= edgeGain;
    right[frame] *= edgeGain;
  }
}

applyEdgeFades();

const K_WEIGHTING_FILTERS = [
  {
    b: [1.53512485958697, -2.69169618940638, 1.19839281085285],
    a: [1, -1.69065929318241, 0.73248077421585],
  },
  {
    b: [1, -2, 1],
    a: [1, -1.99004745483398, 0.99007225036621],
  },
];

function biquad(samples, coefficients) {
  const output = new Float64Array(samples.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let frame = 0; frame < samples.length; frame += 1) {
    const x0 = samples[frame];
    const y0 =
      coefficients.b[0] * x0 +
      coefficients.b[1] * x1 +
      coefficients.b[2] * x2 -
      coefficients.a[1] * y1 -
      coefficients.a[2] * y2;
    output[frame] = y0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }
  return output;
}

function kWeight(samples) {
  return K_WEIGHTING_FILTERS.reduce((signal, filter) => biquad(signal, filter), samples);
}

function integratedLoudness(leftSamples, rightSamples) {
  const weightedLeft = kWeight(leftSamples);
  const weightedRight = kWeight(rightSamples);
  const blockFrames = secondsToFrame(0.4);
  const stepFrames = secondsToFrame(0.1);
  const blocks = [];

  for (let start = 0; start + blockFrames <= FRAME_COUNT; start += stepFrames) {
    let sum = 0;
    for (let frame = start; frame < start + blockFrames; frame += 1) {
      sum += weightedLeft[frame] ** 2 + weightedRight[frame] ** 2;
    }
    const meanSquare = sum / blockFrames;
    const loudness = -0.691 + 10 * Math.log10(Math.max(meanSquare, 1e-20));
    if (loudness > -70) blocks.push({ meanSquare, loudness });
  }

  if (blocks.length === 0) return -Infinity;
  const ungatedMean = blocks.reduce((sum, block) => sum + block.meanSquare, 0) / blocks.length;
  const relativeGate = -0.691 + 10 * Math.log10(ungatedMean) - 10;
  const gated = blocks.filter((block) => block.loudness > relativeGate);
  const gatedMean = gated.reduce((sum, block) => sum + block.meanSquare, 0) / gated.length;
  return -0.691 + 10 * Math.log10(gatedMean);
}

function samplePeak(leftSamples, rightSamples) {
  let peak = 0;
  for (let frame = 0; frame < FRAME_COUNT; frame += 1) {
    peak = Math.max(peak, Math.abs(leftSamples[frame]), Math.abs(rightSamples[frame]));
  }
  return peak;
}

const TARGET_LUFS = -16;
const MAXIMUM_PEAK = 10 ** (-1.2 / 20);
const initialLoudness = integratedLoudness(left, right);
const loudnessGain = 10 ** ((TARGET_LUFS - initialLoudness) / 20);
const peakLimitedGain = MAXIMUM_PEAK / Math.max(samplePeak(left, right), 1e-9);
const finalGain = Math.min(loudnessGain, peakLimitedGain);

for (let frame = 0; frame < FRAME_COUNT; frame += 1) {
  left[frame] *= finalGain;
  right[frame] *= finalGain;
}

function createWav(bitDepth) {
  const bytesPerSample = bitDepth / 8;
  const dataSize = FRAME_COUNT * 2 * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(2, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2 * bytesPerSample, 28);
  buffer.writeUInt16LE(2 * bytesPerSample, 32);
  buffer.writeUInt16LE(bitDepth, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let frame = 0; frame < FRAME_COUNT; frame += 1) {
    for (const sample of [left[frame], right[frame]]) {
      const dither = (random() - random()) / 2 ** bitDepth;
      const value = clamp(sample + dither, -1, 1 - 1 / 2 ** (bitDepth - 1));
      const integer = Math.round(value * (2 ** (bitDepth - 1) - 1));
      if (bitDepth === 16) {
        buffer.writeInt16LE(integer, offset);
      } else if (bitDepth === 24) {
        buffer.writeIntLE(integer, offset, 3);
      } else {
        throw new Error(`Unsupported bit depth: ${bitDepth}`);
      }
      offset += bytesPerSample;
    }
  }
  return buffer;
}

const masterPath = join(OUTPUT_DIR, `${BASENAME}-master-48k-24bit.wav`);
const mobilePath = join(OUTPUT_DIR, `${BASENAME}-mobile-48k-16bit.wav`);
writeFileSync(masterPath, createWav(24));
writeFileSync(mobilePath, createWav(16));

const finalLoudness = integratedLoudness(left, right);
const finalPeak = samplePeak(left, right);
const summary = {
  title: 'LeliBramBas+ Launch Jingle',
  composition: 'Original synthetic sonic logo',
  durationSeconds: FRAME_COUNT / SAMPLE_RATE,
  sampleRateHz: SAMPLE_RATE,
  channels: 2,
  integratedLufs: Number(finalLoudness.toFixed(2)),
  samplePeakDbfs: Number((20 * Math.log10(finalPeak)).toFixed(2)),
  sourceFiles: [basename(masterPath), basename(mobilePath)],
};
writeFileSync(join(OUTPUT_DIR, 'audio-analysis.json'), `${JSON.stringify(summary, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
