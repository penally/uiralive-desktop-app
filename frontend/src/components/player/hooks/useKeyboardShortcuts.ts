import { useEffect } from 'react';
import type { PlayerState } from '../lib/types';

export interface KeyboardShortcuts {
	togglePlayPause: () => void;
	seekBackward: () => void;
	seekForward: () => void;
	increaseVolume: () => void;
	decreaseVolume: () => void;
	toggleMute: () => void;
	toggleFullscreen: () => void;
	toggleSettings: () => void;
	toggleHelp?: () => void;
}

export function useKeyboardShortcuts(
	shortcuts: KeyboardShortcuts,
	state: PlayerState
) {
	useEffect(() => {
		function handleKeyDown(event: KeyboardEvent) {
			if (
				event.target instanceof HTMLInputElement ||
				event.target instanceof HTMLTextAreaElement
			) {
				return;
			}

			switch (event.key.toLowerCase()) {
				case ' ':
				case 'k':
					event.preventDefault();
					shortcuts.togglePlayPause();
					break;
				case 'arrowleft':
					event.preventDefault();
					shortcuts.seekBackward();
					break;
				case 'arrowright':
					event.preventDefault();
					shortcuts.seekForward();
					break;
				case 'arrowup':
					event.preventDefault();
					shortcuts.increaseVolume();
					break;
				case 'arrowdown':
					event.preventDefault();
					shortcuts.decreaseVolume();
					break;
				case 'm':
					event.preventDefault();
					shortcuts.toggleMute();
					break;
				case 'f':
					event.preventDefault();
					shortcuts.toggleFullscreen();
					break;
				case 's':
					event.preventDefault();
					shortcuts.toggleSettings();
					break;
				case '`':
					event.preventDefault();
					shortcuts.toggleHelp?.();
					break;
				case 'escape':
					if (state.isSettingsOpen) {
						event.preventDefault();
						shortcuts.toggleSettings();
					}
					break;
			}
		}

		window.addEventListener('keydown', handleKeyDown);
		return () => {
			window.removeEventListener('keydown', handleKeyDown);
		};
	}, [shortcuts, state.isSettingsOpen]);
}
