import { onBeforeUnmount, ref } from 'vue'

// A voice recording for a Snackbert Report (#424): up to two minutes from the
// microphone, as AAC in MP4 where the browser records that (Safari, Chrome
// from 126), else what Chrome on Android gives (WebM with Opus). Asked for the
// microphone only when `start` is called. While it records, a short row of
// level bars (read from an AnalyserNode every ~100 ms) is kept for the
// waveform, and stays for drawing the finished recording. The microphone and
// the AudioContext are let go of on stop and when the component goes away.
// Plain refs; the `recording` ends up as one Blob whose type is the
// recorder's mimeType.

export type RecordingState = 'idle' | 'recording' | 'done'
// Why nothing is recorded: the microphone was refused, or this browser
// can't record.
export type RecordingProblem = 'denied' | 'unavailable'

export const RECORDING_LIMIT_SECONDS = 120
// How many bars the waveform has, and how often they are sampled.
export const WAVE_BARS = 28
const SAMPLE_MS = 100
const TYPES = ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm;codecs=opus', 'audio/webm']

function supportedType(): string | undefined {
  return TYPES.find(type => MediaRecorder.isTypeSupported(type))
}

export function useVoiceRecording() {
  const state = ref<RecordingState>('idle')
  const seconds = ref(0)
  // Bar heights from 0 to 1, oldest first, at most WAVE_BARS.
  const levels = ref<number[]>([])
  const recording = ref<Blob | null>(null)
  const problem = ref<RecordingProblem | null>(null)

  let recorder: MediaRecorder | null = null
  let stream: MediaStream | null = null
  let context: AudioContext | null = null
  let clock: ReturnType<typeof setInterval> | undefined
  let sampler: ReturnType<typeof setInterval> | undefined
  let chunks: Blob[] = []
  // Counts the starts; a microphone that answers after a reset is let go.
  let attempt = 0

  // Lets go of the microphone and the clocks.
  function release() {
    clearInterval(clock)
    clearInterval(sampler)
    stream?.getTracks().forEach(track => track.stop())
    stream = null
    void context?.close().catch(() => {})
    context = null
  }

  async function start() {
    if (state.value === 'recording') return
    problem.value = null
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      problem.value = 'unavailable'
      return
    }
    const mimeType = supportedType()
    const run = ++attempt
    let micro: MediaStream
    try {
      micro = await navigator.mediaDevices.getUserMedia({ audio: true })
    }
    catch {
      if (run === attempt) problem.value = 'denied'
      return
    }
    if (run !== attempt) {
      micro.getTracks().forEach(track => track.stop())
      return
    }
    stream = micro
    chunks = []
    recording.value = null
    seconds.value = 0
    levels.value = []
    try {
      recorder = new MediaRecorder(micro, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 64000 })
    }
    catch {
      release()
      problem.value = 'unavailable'
      return
    }
    const mine = recorder
    mine.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data)
    }
    mine.onstop = () => {
      // A recorder that was reset away has nothing to hand over.
      if (recorder !== mine) return
      recording.value = new Blob(chunks, { type: mine.mimeType || mimeType || 'audio/mp4' })
      chunks = []
      recorder = null
      state.value = 'done'
    }
    mine.start()
    state.value = 'recording'
    watchLevels(micro)
    clock = setInterval(() => {
      seconds.value++
      if (seconds.value >= RECORDING_LIMIT_SECONDS) stop()
    }, 1000)
  }

  // The waveform: the loudness of the last 100 ms, as a bar. Where the
  // browser has no Web Audio the bars simply stay empty.
  function watchLevels(micro: MediaStream) {
    try {
      context = new AudioContext()
      const analyser = context.createAnalyser()
      analyser.fftSize = 512
      context.createMediaStreamSource(micro).connect(analyser)
      const samples = new Uint8Array(analyser.fftSize)
      sampler = setInterval(() => {
        analyser.getByteTimeDomainData(samples)
        let peak = 0
        for (const sample of samples) peak = Math.max(peak, Math.abs(sample - 128))
        // Speech rarely fills the range; scale it up so quiet voices show.
        const level = Math.min(1, peak / 64)
        levels.value = [...levels.value, level].slice(-WAVE_BARS)
      }, SAMPLE_MS)
    }
    catch {
      context = null
    }
  }

  // Ends the recording; the recorder's last data arrives, then `done`.
  function stop() {
    if (state.value !== 'recording' || !recorder) return
    const mine = recorder
    release()
    if (mine.state !== 'inactive') mine.stop()
  }

  // Throws away the recording (or a running one) and starts afresh.
  function reset() {
    attempt++
    const mine = recorder
    recorder = null
    release()
    if (mine && mine.state !== 'inactive') mine.stop()
    chunks = []
    recording.value = null
    seconds.value = 0
    levels.value = []
    problem.value = null
    state.value = 'idle'
  }

  onBeforeUnmount(reset)

  return { state, seconds, levels, recording, problem, start, stop, reset }
}
