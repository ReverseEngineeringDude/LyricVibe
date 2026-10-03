/**
 * High-performance Canvas & Audio MediaRecorder engine for Status / Story video exports.
 * Synchronizes offscreen canvas rendering with HTMLAudioElement playback,
 * producing WebM or MP4 video files ready for direct download or H.264 transcoding.
 */

export interface ExportOptions {
  canvas: HTMLCanvasElement;
  audioElement: HTMLAudioElement;
  startTime: number;
  endTime: number;
  fps?: number;
  muteSpeaker?: boolean;
  onProgress?: (progress: number, currentTime: number) => void;
  onFrame?: (currentTime: number, dt: number) => void;
  signal?: AbortSignal;
}

let sharedAudioContext: AudioContext | null = null;
let sharedMediaSource: MediaElementAudioSourceNode | null = null;
let sharedMediaDest: MediaStreamAudioDestinationNode | null = null;
let sharedSpeakerGain: GainNode | null = null;
let boundAudioElement: HTMLAudioElement | null = null;

/**
 * Configure persistent Web Audio routing for the audio element.
 * Routes audio simultaneously to the speakers (via gain node) and
 * to a MediaStreamDestination for clean, non-clipping video capture.
 */
function getAudioStream(audio: HTMLAudioElement, muteSpeaker: boolean): MediaStream | null {
  // Method 1: Web Audio routing
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      if (!sharedAudioContext || boundAudioElement !== audio) {
        sharedAudioContext = new AudioCtx();
        sharedMediaSource = sharedAudioContext.createMediaElementSource(audio);
        sharedSpeakerGain = sharedAudioContext.createGain();
        sharedMediaDest = sharedAudioContext.createMediaStreamDestination();

        // Connect source -> speakerGain -> speakers
        sharedMediaSource.connect(sharedSpeakerGain);
        sharedSpeakerGain.connect(sharedAudioContext.destination);

        // Connect source -> mediaDest (recording stream)
        sharedMediaSource.connect(sharedMediaDest);

        boundAudioElement = audio;
      }

      if (sharedAudioContext.state === 'suspended') {
        sharedAudioContext.resume().catch(() => {});
      }

      if (sharedSpeakerGain) {
        sharedSpeakerGain.gain.value = muteSpeaker ? 0 : 1;
      }

      if (sharedMediaDest && sharedMediaDest.stream) {
        return sharedMediaDest.stream;
      }
    }
  } catch (err) {
    console.warn('Web Audio capture setup note:', err);
  }

  // Method 2: HTMLMediaElement captureStream / mozCaptureStream fallback
  if (typeof (audio as any).captureStream === 'function') {
    try {
      return (audio as any).captureStream();
    } catch (e) {
      console.warn('audio.captureStream fallback error:', e);
    }
  }
  if (typeof (audio as any).mozCaptureStream === 'function') {
    try {
      return (audio as any).mozCaptureStream();
    } catch (e) {
      console.warn('audio.mozCaptureStream fallback error:', e);
    }
  }

  return null;
}

/**
 * Detect the best available video container & codec combination supported by this browser.
 */
export function getSupportedMimeType(): string {
  const mimeTypes = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=h264,opus',
    'video/webm',
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4',
  ];

  for (const mime of mimeTypes) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }
  return '';
}

/**
 * Records an offscreen or onscreen canvas combined with audio into a single video Blob.
 */
export async function exportCanvasVideo(options: ExportOptions): Promise<Blob> {
  const {
    canvas,
    audioElement,
    startTime,
    endTime,
    fps = 60,
    muteSpeaker = false,
    onProgress,
    onFrame,
    signal,
  } = options;

  if (typeof MediaRecorder === 'undefined') {
    throw new Error('MediaRecorder is not supported in this browser environment.');
  }

  const duration = Math.max(0.5, endTime - startTime);

  // 1. Capture canvas stream
  const canvasStream = canvas.captureStream(fps);
  const videoTracks = canvasStream.getVideoTracks();
  if (videoTracks.length === 0) {
    throw new Error('Canvas capture stream did not produce a video track.');
  }

  // 2. Capture audio stream
  const audioStream = getAudioStream(audioElement, muteSpeaker);
  const tracks: MediaStreamTrack[] = [videoTracks[0]];

  if (audioStream) {
    const audioTracks = audioStream.getAudioTracks();
    if (audioTracks.length > 0) {
      tracks.push(audioTracks[0]);
    }
  }

  const combinedStream = new MediaStream(tracks);

  // 3. Create MediaRecorder
  const mimeType = getSupportedMimeType();
  const recorderOptions: MediaRecorderOptions = {
    videoBitsPerSecond: 8_000_000, // 8 Mbps high quality
  };
  if (mimeType) {
    recorderOptions.mimeType = mimeType;
  }

  const mediaRecorder = new MediaRecorder(combinedStream, recorderOptions);
  const chunks: Blob[] = [];

  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  // 4. Seek audio to start position
  audioElement.pause();
  audioElement.currentTime = startTime;

  await new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        audioElement.removeEventListener('seeked', finish);
        resolve();
      }
    };
    audioElement.addEventListener('seeked', finish);
    setTimeout(finish, 400); // 400ms max seek timeout fallback
  });

  // Render initial frame at startTime
  onFrame?.(startTime, 0.016);

  return new Promise<Blob>((resolve, reject) => {
    let animId: number | null = null;
    let isCleanedUp = false;
    let lastTimestamp = performance.now();

    const cleanup = () => {
      if (isCleanedUp) return;
      isCleanedUp = true;

      if (animId !== null) {
        cancelAnimationFrame(animId);
        animId = null;
      }

      audioElement.pause();

      // Restore speaker gain if muted
      if (sharedSpeakerGain) {
        sharedSpeakerGain.gain.value = 1;
      }
    };

    if (signal) {
      signal.addEventListener('abort', () => {
        cleanup();
        if (mediaRecorder.state !== 'inactive') {
          try {
            mediaRecorder.stop();
          } catch {}
        }
        reject(new DOMException('Video export was cancelled by user', 'AbortError'));
      });
    }

    mediaRecorder.onstop = () => {
      cleanup();
      const outputType = mediaRecorder.mimeType || mimeType || 'video/webm';
      const finalBlob = new Blob(chunks, { type: outputType });
      resolve(finalBlob);
    };

    mediaRecorder.onerror = (event: any) => {
      cleanup();
      reject(new Error(event?.error?.message || 'MediaRecorder failed during video export.'));
    };

    // 5. Start MediaRecorder with 100ms timeslices
    try {
      mediaRecorder.start(100);
    } catch (err) {
      cleanup();
      reject(err);
      return;
    }

    // 6. Play audio and drive animation render loop
    audioElement.play().catch((err) => {
      console.warn('Playback start notice during export:', err);
    });

    const loop = (timestamp: number) => {
      if (signal?.aborted || isCleanedUp) return;

      const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.1);
      lastTimestamp = timestamp;

      const currentTime = audioElement.currentTime;
      onFrame?.(currentTime, dt);

      const progress = Math.min(100, Math.max(0, ((currentTime - startTime) / duration) * 100));
      onProgress?.(progress, currentTime);

      if (currentTime >= endTime || audioElement.ended) {
        cleanup();
        if (mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        }
        return;
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
  });
}
