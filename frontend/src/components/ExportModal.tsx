import React, { useEffect, useRef, useState } from 'react';
import { useSettingsStore, VisualOptions } from '@/store/useSettingsStore';
import { usePlayerStore } from '@/store/usePlayerStore';
import { getGlobalAudioElement } from '@/hooks/useAudioClock';
import { formatTime, findActiveLineIndex } from '@/lib/lrcParser';
import { extractPaletteFromImage, ColorPalette } from '@/lib/palette';
import { convertToMp4 } from '@/lib/api';
import { exportCanvasVideo } from '@/lib/recorder';
import { AestheticMoodTheme } from '@/stage/themes/aestheticMood';
import { KineticTheme } from '@/stage/themes/kineticTheme';
import { StageState } from '@/stage/types';
import {
  Film,
  X,
  Smartphone,
  Square,
  Monitor,
  Scissors,
  Download,
  Share2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Volume2,
  VolumeX,
  RotateCcw,
  Sparkles,
  FileVideo,
} from 'lucide-react';

interface Preset {
  id: 'story' | 'square' | 'landscape';
  name: string;
  ratio: string;
  width: number;
  height: number;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}

const PRESETS: Preset[] = [
  {
    id: 'story',
    name: 'Story / Reel / Status',
    ratio: '9:16',
    width: 1080,
    height: 1920,
    desc: 'Instagram Stories, TikTok, WhatsApp & Shorts',
    icon: Smartphone,
  },
  {
    id: 'square',
    name: 'Square Post',
    ratio: '1:1',
    width: 1080,
    height: 1080,
    desc: 'Instagram Feed, Twitter / X',
    icon: Square,
  },
  {
    id: 'landscape',
    name: 'Landscape',
    ratio: '16:9',
    width: 1920,
    height: 1080,
    desc: 'YouTube & Desktop Display',
    icon: Monitor,
  },
];

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export const ExportModal: React.FC = () => {
  const isOpen = useSettingsStore((s) => s.isExportOpen);
  const toggleExport = useSettingsStore((s) => s.toggleExport);
  const toggleClipPicker = useSettingsStore((s) => s.toggleClipPicker);
  const clipRange = useSettingsStore((s) => s.clipRange);
  const syncedLines = useSettingsStore((s) => s.syncedLines);
  const timingOffset = useSettingsStore((s) => s.timingOffset);
  const visualOptions = useSettingsStore((s) => s.visualOptions);

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const trackDuration = usePlayerStore((s) => s.duration) || currentTrack?.duration || 180;

  const [selectedPreset, setSelectedPreset] = useState<Preset>(PRESETS[0]);
  const [fpsChoice, setFpsChoice] = useState<30 | 60>(visualOptions.fps || 60);
  const [watermarkChoice, setWatermarkChoice] = useState<boolean>(visualOptions.watermark ?? true);
  const [muteDuringRecording, setMuteDuringRecording] = useState<boolean>(false);

  const [status, setStatus] = useState<'idle' | 'recording' | 'complete' | 'error'>('idle');
  const [progress, setProgress] = useState<number>(0);
  const [recordedTime, setRecordedTime] = useState<number>(0);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isConvertingMp4, setIsConvertingMp4] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Clean up object URL when closing or re-recording
  useEffect(() => {
    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setStatus('idle');
      setProgress(0);
      setErrorMessage(null);
      setResultBlob(null);
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
        setVideoUrl(null);
      }
    }
  }, [isOpen]);

  if (!isOpen || !currentTrack) return null;

  const clipDuration = Math.max(1, Math.round((clipRange[1] - clipRange[0]) * 10) / 10);

  const handleClose = () => {
    if (status === 'recording' && abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    toggleExport(false);
  };

  const handleEditClipRange = () => {
    if (status === 'recording' && abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    toggleExport(false);
    toggleClipPicker(true);
  };

  const handleCancelRecording = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setStatus('idle');
    setProgress(0);
  };

  const handleStartExport = async () => {
    const audio = getGlobalAudioElement();
    if (!audio) {
      setErrorMessage('Audio player is not ready.');
      setStatus('error');
      return;
    }

    setStatus('recording');
    setProgress(0);
    setRecordedTime(clipRange[0]);
    setErrorMessage(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // 1. Offscreen target canvas & logical dimensions
      const canvas = document.createElement('canvas');
      canvas.width = selectedPreset.width;
      canvas.height = selectedPreset.height;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('Could not create offscreen canvas rendering context.');

      // Logical viewport dimensions:
      // Story (9:16) -> 432 x 768 (scales 2.5x to 1080 x 1920)
      // Square (1:1)  -> 540 x 540 (scales 2.0x to 1080 x 1080)
      // Landscape (16:9) -> 960 x 540 (scales 2.0x to 1920 x 1080)
      let logicalWidth = 432;
      let logicalHeight = 768;
      if (selectedPreset.id === 'square') {
        logicalWidth = 540;
        logicalHeight = 540;
      } else if (selectedPreset.id === 'landscape') {
        logicalWidth = 960;
        logicalHeight = 540;
      }

      const scaleX = selectedPreset.width / logicalWidth;
      const scaleY = selectedPreset.height / logicalHeight;

      // 2. Initialize theme with logical dimensions
      const isKinetic = useSettingsStore.getState().isKineticMode || useSettingsStore.getState().selectedThemeId === 'kinetic';
      const theme = isKinetic ? new KineticTheme() : new AestheticMoodTheme();
      theme.init(ctx, logicalWidth, logicalHeight, currentTrack);

      // 3. Extract palette
      let palette: ColorPalette | null = null;
      if (currentTrack.thumbnail) {
        palette = await extractPaletteFromImage(currentTrack.thumbnail);
      }

      // 4. Prewarm layout & scroll position
      const initialActiveIdx = findActiveLineIndex(syncedLines, clipRange[0], timingOffset);
      const exportVisuals: VisualOptions = {
        ...visualOptions,
        fps: fpsChoice,
        watermark: watermarkChoice,
      };

      const initialStageState: StageState = {
        currentTime: clipRange[0],
        duration: trackDuration,
        isPlaying: true,
        syncedLines,
        activeLineIndex: initialActiveIdx,
        visualOptions: exportVisuals,
        track: currentTrack,
        palette,
        prefersReducedMotion: false,
        isKineticMode: isKinetic,
        width: logicalWidth,
        height: logicalHeight,
        dpr: 1,
      };

      if ((theme as any).resetScrollToActive) {
        (theme as any).resetScrollToActive(ctx, initialStageState);
      }

      // 5. Record Canvas + Audio
      const blob = await exportCanvasVideo({
        canvas,
        audioElement: audio,
        startTime: clipRange[0],
        endTime: clipRange[1],
        fps: fpsChoice,
        muteSpeaker: muteDuringRecording,
        signal: controller.signal,
        onProgress: (pct, time) => {
          setProgress(pct);
          setRecordedTime(time);
        },
        onFrame: (time, dt) => {
          const activeIdx = findActiveLineIndex(syncedLines, time, timingOffset);
          const stageState: StageState = {
            currentTime: time,
            duration: trackDuration,
            isPlaying: true,
            syncedLines,
            activeLineIndex: activeIdx,
            visualOptions: exportVisuals,
            track: currentTrack,
            palette,
            prefersReducedMotion: false,
            width: logicalWidth,
            height: logicalHeight,
            dpr: 1,
          };
          ctx.save();
          ctx.scale(scaleX, scaleY);
          theme.draw(ctx, stageState, dt);
          ctx.restore();
        },
      });

      theme.dispose();

      setResultBlob(blob);
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
      setStatus('complete');
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setStatus('idle');
      } else {
        console.error('Video export error:', err);
        setErrorMessage(err?.message || 'Video export encountered an unexpected error.');
        setStatus('error');
      }
    }
  };

  const handleDownloadWebm = () => {
    if (!resultBlob || !videoUrl) return;
    const cleanTitle = (currentTrack.title || 'video').replace(/[^a-zA-Z0-9_-]/g, '_');
    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = `LyricVibe_${cleanTitle}_${selectedPreset.id}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleConvertToMp4 = async () => {
    if (!resultBlob) return;
    setIsConvertingMp4(true);
    try {
      const mp4Blob = await convertToMp4(resultBlob);
      const cleanTitle = (currentTrack.title || 'video').replace(/[^a-zA-Z0-9_-]/g, '_');
      const url = URL.createObjectURL(mp4Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `LyricVibe_${cleanTitle}_${selectedPreset.id}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('MP4 conversion error:', err);
      alert('FFmpeg MP4 conversion failed: ' + (err.message || 'Unknown server error'));
    } finally {
      setIsConvertingMp4(false);
    }
  };

  const handleShare = async () => {
    if (!resultBlob) return;
    try {
      const file = new File([resultBlob], `lyricvibe_${selectedPreset.id}.webm`, { type: resultBlob.type });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `${currentTrack.title} - LyricVibe`,
          text: `Check out this lyrics video of ${currentTrack.title}!`,
          files: [file],
        });
      } else {
        handleDownloadWebm();
      }
    } catch (err) {
      console.warn('Share dismissed or unsupported:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="w-full max-w-xl bg-surface border border-surfaceBorder rounded-2xl p-4 sm:p-6 shadow-2xl space-y-4 sm:space-y-5 my-auto max-h-[92dvh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surfaceBorder/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white shadow-md shadow-brand-500/20">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Status / Story Video Generator</h3>
              <p className="text-xs text-gray-400 truncate max-w-xs sm:max-w-md">
                {currentTrack.title} &bull; {currentTrack.artist}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Clip Summary Bar */}
        <div className="flex items-center justify-between bg-surfaceLight/60 border border-surfaceBorder rounded-xl p-3 text-xs">
          <div className="flex items-center gap-2">
            <Scissors className="w-4 h-4 text-brand-400" />
            <span className="text-gray-400">Clip Range:</span>
            <span className="font-semibold text-white font-mono">
              {formatTime(clipRange[0])} &rarr; {formatTime(clipRange[1])} ({clipDuration}s)
            </span>
          </div>
          {status === 'idle' && (
            <button
              onClick={handleEditClipRange}
              className="text-brand-400 hover:text-brand-300 font-medium underline text-xs transition-colors"
            >
              Adjust Range
            </button>
          )}
        </div>

        {/* State 1: IDLE - Settings and Presets */}
        {status === 'idle' && (
          <div className="space-y-4">
            {/* Presets Grid */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-300">Aspect Ratio Preset</label>
              <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                {PRESETS.map((p) => {
                  const Icon = p.icon;
                  const isSel = selectedPreset.id === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPreset(p)}
                      className={`p-2.5 sm:p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                        isSel
                          ? 'bg-brand-500/15 border-brand-500/60 shadow-md shadow-brand-500/15 scale-101'
                          : 'bg-surfaceLight/30 border-surfaceBorder hover:border-surfaceBorder/90 hover:bg-surfaceLight/60'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1.5">
                        <Icon className={`w-4 h-4 ${isSel ? 'text-brand-400' : 'text-gray-400'}`} />
                        <span className={`text-[10px] font-mono px-1 sm:px-1.5 py-0.5 rounded ${isSel ? 'bg-brand-500/20 text-brand-300' : 'bg-surfaceBorder text-gray-400'}`}>
                          {p.ratio}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className={`text-[11px] sm:text-xs font-semibold truncate ${isSel ? 'text-white' : 'text-gray-300'}`}>{p.name}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5 font-mono">{p.width}&times;{p.height}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Customization Options */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              {/* FPS Toggle */}
              <div className="bg-surfaceLight/40 border border-surfaceBorder rounded-xl p-3 space-y-1.5">
                <span className="text-[11px] font-medium text-gray-400 block">Frame Rate</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setFpsChoice(60)}
                    className={`flex-1 py-1 rounded-lg text-xs font-medium transition-colors ${
                      fpsChoice === 60 ? 'bg-brand-600 text-white' : 'bg-surfaceLight text-gray-400 hover:text-white'
                    }`}
                  >
                    60 FPS
                  </button>
                  <button
                    onClick={() => setFpsChoice(30)}
                    className={`flex-1 py-1 rounded-lg text-xs font-medium transition-colors ${
                      fpsChoice === 30 ? 'bg-brand-600 text-white' : 'bg-surfaceLight text-gray-400 hover:text-white'
                    }`}
                  >
                    30 FPS
                  </button>
                </div>
              </div>

              {/* Watermark Toggle */}
              <div className="bg-surfaceLight/40 border border-surfaceBorder rounded-xl p-3 space-y-1.5">
                <span className="text-[11px] font-medium text-gray-400 block">Watermark</span>
                <button
                  onClick={() => setWatermarkChoice(!watermarkChoice)}
                  className={`w-full py-1 rounded-lg text-xs font-medium transition-colors ${
                    watermarkChoice ? 'bg-brand-500/20 text-brand-300 border border-brand-500/40' : 'bg-surfaceLight text-gray-400 border border-transparent'
                  }`}
                >
                  {watermarkChoice ? 'LyricVibe Badge' : 'No Watermark'}
                </button>
              </div>

              {/* Mute Speaker Toggle */}
              <div className="bg-surfaceLight/40 border border-surfaceBorder rounded-xl p-3 space-y-1.5">
                <span className="text-[11px] font-medium text-gray-400 block">Silent Record</span>
                <button
                  onClick={() => setMuteDuringRecording(!muteDuringRecording)}
                  className={`w-full py-1 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                    muteDuringRecording ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-surfaceLight text-gray-400 border border-transparent'
                  }`}
                  title="Mutes your device speakers during recording while still capturing audio cleanly into the video file"
                >
                  {muteDuringRecording ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  <span>{muteDuringRecording ? 'Speakers Muted' : 'Hear Audio'}</span>
                </button>
              </div>
            </div>

            {/* Launch button */}
            <div className="pt-2">
              <button
                onClick={handleStartExport}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-sm font-semibold shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2 transition-all hover:scale-101"
              >
                <Sparkles className="w-4 h-4" />
                <span>Start Video Recording ({clipDuration}s)</span>
              </button>
            </div>
          </div>
        )}

        {/* State 2: RECORDING IN PROGRESS */}
        {status === 'recording' && (
          <div className="space-y-5 py-4 text-center">
            <div className="relative flex items-center justify-center">
              {/* Outer pulsing ring */}
              <div className="w-24 h-24 rounded-full border-4 border-brand-500/20 animate-pulse flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-brand-500/10 border-2 border-brand-400 flex items-center justify-center">
                  <Film className="w-7 h-7 text-brand-400 animate-spin" style={{ animationDuration: '4s' }} />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-sm font-semibold text-white flex items-center justify-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping inline-block" />
                Recording Video ({selectedPreset.ratio} &bull; {selectedPreset.width}&times;{selectedPreset.height})
              </div>
              <p className="text-xs text-gray-400">
                Playing and rendering frame-by-frame spring physics...
              </p>
            </div>

            {/* Progress bar */}
            <div className="space-y-1.5 max-w-md mx-auto">
              <div className="flex justify-between text-xs text-gray-400 font-mono">
                <span>{formatTime(recordedTime)}</span>
                <span className="text-brand-300 font-semibold">{Math.round(progress)}%</span>
                <span>{formatTime(clipRange[1])}</span>
              </div>
              <div className="h-2 w-full bg-surfaceBorder rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-brand-500 to-indigo-500 transition-all duration-150 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={handleCancelRecording}
                className="px-4 py-2 rounded-xl border border-red-500/40 text-red-300 hover:bg-red-500/10 text-xs font-medium transition-colors"
              >
                Cancel Recording
              </button>
            </div>
          </div>
        )}

        {/* State 3: COMPLETE - Video Preview & Download / Transcode */}
        {status === 'complete' && videoUrl && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Video successfully generated! ({clipDuration}s &bull; {resultBlob ? formatBytes(resultBlob.size) : ''})</span>
            </div>

            {/* Video Preview */}
            <div className="relative rounded-xl overflow-hidden bg-black/80 border border-surfaceBorder flex items-center justify-center max-h-72">
              <video
                src={videoUrl}
                controls
                autoPlay
                loop
                playsInline
                className="max-h-72 w-auto max-w-full rounded-lg shadow-2xl"
              />
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              {/* Direct WebM Download */}
              <button
                onClick={handleDownloadWebm}
                className="p-3 rounded-xl bg-surfaceLight/80 hover:bg-surfaceLight border border-surfaceBorder text-white text-xs font-medium flex items-center justify-center gap-2 transition-all hover:scale-102"
              >
                <Download className="w-4 h-4 text-brand-400" />
                <div className="text-left">
                  <div className="font-semibold">Download WebM</div>
                  <div className="text-[10px] text-gray-400">Direct instant export</div>
                </div>
              </button>

              {/* FFmpeg MP4 Transcode */}
              <button
                onClick={handleConvertToMp4}
                disabled={isConvertingMp4}
                className="p-3 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-medium flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 disabled:opacity-50 transition-all hover:scale-102"
              >
                {isConvertingMp4 ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <FileVideo className="w-4 h-4 text-white" />
                )}
                <div className="text-left">
                  <div className="font-semibold">{isConvertingMp4 ? 'Transcoding...' : 'Convert to MP4'}</div>
                  <div className="text-[10px] text-white/70">Optimized for Status / Stories</div>
                </div>
              </button>

              {/* Mobile Web Share */}
              <button
                onClick={handleShare}
                className="p-3 rounded-xl bg-surfaceLight/80 hover:bg-surfaceLight border border-surfaceBorder text-white text-xs font-medium flex items-center justify-center gap-2 transition-all hover:scale-102"
              >
                <Share2 className="w-4 h-4 text-indigo-400" />
                <div className="text-left">
                  <div className="font-semibold">Share</div>
                  <div className="text-[10px] text-gray-400">WhatsApp / Instagram / Apps</div>
                </div>
              </button>
            </div>

            {/* Record Again Option */}
            <div className="flex justify-end pt-2">
              <button
                onClick={() => {
                  setStatus('idle');
                  setProgress(0);
                }}
                className="px-3.5 py-1.5 rounded-lg border border-surfaceBorder text-xs text-gray-300 hover:text-white hover:bg-surfaceLight flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Record New Clip / Settings</span>
              </button>
            </div>
          </div>
        )}

        {/* State 4: ERROR */}
        {status === 'error' && (
          <div className="space-y-4 py-4 text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 mx-auto flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-white">Video Export Failed</h4>
              <p className="text-xs text-red-300 max-w-md mx-auto">{errorMessage || 'An error occurred during video creation.'}</p>
            </div>
            <div className="flex justify-center gap-3 pt-2">
              <button
                onClick={() => setStatus('idle')}
                className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={handleClose}
                className="px-4 py-2 rounded-xl border border-surfaceBorder text-gray-300 hover:bg-surfaceLight text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
