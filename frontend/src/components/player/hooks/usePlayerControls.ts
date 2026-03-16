import { useEffect, useRef, useCallback, type RefObject } from 'react';
import type { PlayerState } from '../lib/types';

export function usePlayerControls(
	videoElementRef: RefObject<HTMLVideoElement | null>,
	state: PlayerState,
	setState: (updater: (prev: PlayerState) => PlayerState) => void
) {
	const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const preMuteVolumeRef = useRef(0.5);
	const CONTROLS_TIMEOUT = 3000;

	const showControls = useCallback(() => {
		setState(prev => ({ ...prev, isControlsVisible: true }));
		resetControlsTimeout();
	}, [setState]);

	const hideControls = useCallback(() => {
		setState(prev => ({ ...prev, isControlsVisible: false }));
		if (controlsTimeoutRef.current) {
			clearTimeout(controlsTimeoutRef.current);
			controlsTimeoutRef.current = null;
		}
	}, [setState]);

	const resetControlsTimeout = useCallback(() => {
		if (controlsTimeoutRef.current) {
			clearTimeout(controlsTimeoutRef.current);
		}
		controlsTimeoutRef.current = setTimeout(() => {
			if (state.isPlaying && !state.isSettingsOpen) {
				setState(prev => ({ ...prev, isControlsVisible: false }));
			}
		}, CONTROLS_TIMEOUT);
	}, [state.isPlaying, state.isSettingsOpen, setState]);

	const togglePlayPause = useCallback(() => {
		const el = videoElementRef.current;
		if (!el) return;
		if (state.isPlaying) {
			el.pause();
		} else {
			el.play();
		}
	}, [videoElementRef, state.isPlaying]);

	const seek = useCallback((seconds: number) => {
		const el = videoElementRef.current;
		if (!el) return;
		el.currentTime = Math.max(0, Math.min(seconds, state.duration));
	}, [videoElementRef, state.duration]);

	const seekRelative = useCallback((seconds: number) => {
		const el = videoElementRef.current;
		if (!el) return;
		seek(el.currentTime + seconds);
	}, [videoElementRef, seek]);

	const setVolume = useCallback((volume: number) => {
		const el = videoElementRef.current;
		if (!el) return;
		el.volume = Math.max(0, Math.min(1, volume));
		if (el.volume > 0) preMuteVolumeRef.current = el.volume;
		setState(prev => ({ ...prev, volume: el.volume }));
	}, [videoElementRef, setState]);

	const toggleMute = useCallback(() => {
		const el = videoElementRef.current;
		if (!el) return;
		if (el.volume > 0) {
			preMuteVolumeRef.current = el.volume;
			el.volume = 0;
		} else {
			el.volume = preMuteVolumeRef.current || 0.5;
		}
		setState(prev => ({ ...prev, volume: el.volume }));
	}, [videoElementRef, setState]);

	const toggleFullscreen = useCallback(() => {
		if (!document.fullscreenElement) {
			document.documentElement.requestFullscreen();
		} else {
			document.exitFullscreen();
		}
	}, []);

	useEffect(() => {
		const handleFullscreenChange = () => {
			setState(prev => ({ ...prev, isFullscreen: !!document.fullscreenElement }));
		};
		document.addEventListener('fullscreenchange', handleFullscreenChange);
		
		return () => {
			document.removeEventListener('fullscreenchange', handleFullscreenChange);
			if (controlsTimeoutRef.current) {
				clearTimeout(controlsTimeoutRef.current);
			}
		};
	}, [setState]);

	return {
		showControls,
		hideControls,
		resetControlsTimeout,
		togglePlayPause,
		seek,
		seekRelative,
		setVolume,
		toggleMute,
		toggleFullscreen
	};
}
