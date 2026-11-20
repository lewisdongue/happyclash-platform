/**
 * The soft murmur of a seated audience, synthesised (no audio file): pink-ish
 * noise shaped to the voice band, with slow swells like conversations rising
 * and falling. Kept quiet on purpose.
 */
export function startCrowdMurmur(): () => void {
  const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  if (!Context) return () => undefined
  const audio = new Context()
  const seconds = 4
  const buffer = audio.createBuffer(1, audio.sampleRate * seconds, audio.sampleRate)
  const data = buffer.getChannelData(0)
  let last = 0
  for (let i = 0; i < data.length; i++) {
    last = 0.97 * last + 0.03 * (Math.random() * 2 - 1)
    data[i] = last * 6
  }
  const source = audio.createBufferSource()
  source.buffer = buffer
  source.loop = true

  const voices = audio.createBiquadFilter()
  voices.type = 'bandpass'
  voices.frequency.value = 520
  voices.Q.value = 0.8

  const swell = audio.createGain()
  swell.gain.value = 0.5
  const lfo = audio.createOscillator()
  lfo.frequency.value = 0.17
  const depth = audio.createGain()
  depth.gain.value = 0.25
  lfo.connect(depth).connect(swell.gain)

  const master = audio.createGain()
  master.gain.setValueAtTime(0, audio.currentTime)
  master.gain.linearRampToValueAtTime(0.09, audio.currentTime + 2)

  source.connect(voices).connect(swell).connect(master).connect(audio.destination)
  source.start()
  lfo.start()
  void audio.resume()

  return () => {
    master.gain.linearRampToValueAtTime(0, audio.currentTime + 0.6)
    window.setTimeout(() => void audio.close(), 700)
  }
}
