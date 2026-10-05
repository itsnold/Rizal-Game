import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const output = fileURLToPath(new URL('../public/assets/audio/', import.meta.url));
await mkdir(output, { recursive: true });
const rate = 22050;
const note = (frequency, start, duration, gain = 0.3, type = 'sine') => ({ frequency, start, duration, gain, type });
const cues = {
  'ui-click': [note(740, 0, 0.055, 0.15), note(1109, 0.035, 0.055, 0.12)],
  'round-alert': [note(523.25, 0, 0.18, 0.26, 'triangle'), note(659.25, 0.15, 0.18, 0.26, 'triangle'), note(783.99, 0.3, 0.45, 0.3, 'triangle')],
  'countdown-tick': [note(440, 0, 0.11, 0.26), note(880, 0, 0.065, 0.09)],
  'round-start': [note(523.25, 0, 0.16, 0.22, 'triangle'), note(659.25, 0.09, 0.16, 0.22, 'triangle'), note(1046.5, 0.19, 0.4, 0.3, 'triangle')],
  'answer-lock': [note(622.25, 0, 0.08, 0.18), note(932.33, 0.07, 0.18, 0.2)],
  'final-seconds': [note(880, 0, 0.08, 0.2), note(440, 0, 0.05, 0.08)],
  correct: [note(523.25, 0, 0.2, 0.2, 'triangle'), note(659.25, 0.13, 0.22, 0.23, 'triangle'), note(783.99, 0.26, 0.25, 0.23, 'triangle'), note(1046.5, 0.39, 0.55, 0.27, 'triangle')],
  incorrect: [note(392, 0, 0.22, 0.17, 'triangle'), note(329.63, 0.18, 0.32, 0.15, 'triangle')],
  leaderboard: [note(392, 0, 0.2, 0.2, 'triangle'), note(523.25, 0.16, 0.2, 0.2, 'triangle'), note(659.25, 0.32, 0.2, 0.2, 'triangle'), note(783.99, 0.48, 0.55, 0.23, 'triangle'), note(523.25, 0.48, 0.55, 0.12)],
  podium: [note(523.25, 0, 0.2, 0.24, 'triangle'), note(523.25, 0.21, 0.16, 0.21, 'triangle'), note(659.25, 0.38, 0.2, 0.23, 'triangle'), note(783.99, 0.58, 0.22, 0.25, 'triangle'), note(1046.5, 0.82, 0.9, 0.26, 'triangle'), note(659.25, 0.82, 0.9, 0.12), note(783.99, 0.82, 0.9, 0.12)],
};

// A four-second original game-show sting: bouncy plucks, bass, and soft percussion.
// The melody is original, not a transcription of another game's theme.
const intro = [];
const melody = [659.25, 783.99, 987.77, 783.99, 880, 659.25, 587.33, 783.99, 659.25, 987.77, 1174.66, 987.77, 880, 783.99, 659.25, 1318.51];
melody.forEach((frequency, i) => {
  intro.push(note(frequency, i * 0.24, i === 15 ? 0.3 : 0.13, 0.23, 'triangle'));
  if (i % 2 === 0) intro.push(note(i < 8 ? 164.81 : 196, i * 0.24, 0.17, 0.32, 'triangle'));
  intro.push(note(65, i * 0.24, 0.1, i % 2 === 0 ? 0.25 : 0.12, 'kick'));
  if (i % 2 === 1) intro.push(note(3600, i * 0.24, 0.065, 0.075, 'noise'));
});
cues['quiz-intro'] = intro;

function wav(notes) {
  const length = Math.ceil((Math.max(...notes.map(n => n.start + n.duration)) + 0.1) * rate);
  const buffer = Buffer.alloc(44 + length * 2);
  buffer.write('RIFF', 0); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVE', 8);
  buffer.write('fmt ', 12); buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24); buffer.writeUInt32LE(rate * 2, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36); buffer.writeUInt32LE(length * 2, 40);
  for (let i = 0; i < length; i++) {
    const t = i / rate;
    let sample = 0;
    for (const n of notes) {
      const local = t - n.start;
      if (local < 0 || local > n.duration) continue;
      const envelope = Math.min(1, local / 0.008) * Math.min(1, (n.duration - local) / 0.05) * Math.exp(-local * 2.8);
      const phase = 2 * Math.PI * n.frequency * local;
      const wave = n.type === 'triangle' ? Math.asin(Math.sin(phase)) * 2 / Math.PI
        : n.type === 'kick' ? Math.sin(phase * Math.exp(-local * 10))
        : n.type === 'noise' ? Math.sin(i * 123.4567) * Math.sin(i * 78.9123)
        : Math.sin(phase);
      sample += wave * envelope * n.gain;
    }
    buffer.writeInt16LE(Math.round(Math.tanh(sample) * 30000), 44 + i * 2);
  }
  return buffer;
}

let total = 0;
for (const [name, notes] of Object.entries(cues)) {
  const data = wav(notes);
  await writeFile(resolve(output, `${name}.wav`), data);
  total += data.length;
}
console.log(`Generated ${Object.keys(cues).length} original audio cues (${(total / 1024).toFixed(0)} KB total).`);
