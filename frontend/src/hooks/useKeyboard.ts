import { useEffect } from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useSettingsStore } from '@/store/useSettingsStore';

export function useKeyboard() {
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const seekTo = usePlayerStore((s) => s.seekTo);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const volume = usePlayerStore((s) => s.volume);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const toggleMute = usePlayerStore((s) => s.toggleMute);
  const toggleLyricPicker = useSettingsStore((s) => s.toggleLyricPicker);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if focus is inside an input, textarea, or contentEditable
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;

        case 'ArrowLeft':
          e.preventDefault();
          seekTo(Math.max(0, currentTime - 5));
          break;

        case 'ArrowRight':
          e.preventDefault();
          seekTo(currentTime + 5);
          break;

        case 'ArrowUp':
          e.preventDefault();
          setVolume(Math.min(1, volume + 0.05));
          break;

        case 'ArrowDown':
          e.preventDefault();
          setVolume(Math.max(0, volume - 0.05));
          break;

        case 'KeyM':
          e.preventDefault();
          toggleMute();
          break;

        case 'KeyL':
          e.preventDefault();
          toggleLyricPicker();
          break;

        case 'KeyF':
          e.preventDefault();
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
          } else {
            document.exitFullscreen().catch(() => {});
          }
          break;

        case 'KeyS':
          e.preventDefault();
          useSettingsStore.getState().toggleStatusMode();
          break;

        case 'KeyK':
          e.preventDefault();
          useSettingsStore.getState().toggleKineticMode();
          break;

        case 'Escape':
          e.preventDefault();
          useSettingsStore.getState().toggleStatusMode(false);
          useSettingsStore.getState().toggleKineticMode(false);
          break;

        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, seekTo, currentTime, volume, setVolume, toggleMute, toggleLyricPicker]);
}
