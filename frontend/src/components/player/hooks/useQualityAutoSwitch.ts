import { useEffect, useRef } from 'react';
import type { MediaSource } from '../lib/types';

export function useQualityAutoSwitch(
	videoElement: HTMLVideoElement | null,
	sources: MediaSource[],
	currentQuality: string,
	onQualityChange: (quality: string) => void,
	isAutoQualityEnabled: () => boolean
) {
	const lastCheckTimeRef = useRef<number>(0);
	const switchCooldownRef = useRef<number>(0);
	const consecutiveBufferingRef = useRef<number>(0);
	const lastQualityRef = useRef<string>(currentQuality);

	useEffect(() => {
		if (!videoElement || !isAutoQualityEnabled()) return;

		const CHECK_INTERVAL = 2000;
		const SWITCH_COOLDOWN = 10000;
		const BUFFERING_THRESHOLD = 3;

		const checkAndSwitch = () => {
			if (!isAutoQualityEnabled()) return;

			const now = Date.now();
			if (now - lastCheckTimeRef.current < CHECK_INTERVAL) return;
			lastCheckTimeRef.current = now;

			if (now - switchCooldownRef.current < SWITCH_COOLDOWN) return;

			if (videoElement.readyState < 3) {
				consecutiveBufferingRef.current++;
			} else {
				consecutiveBufferingRef.current = 0;
			}

			if (consecutiveBufferingRef.current >= BUFFERING_THRESHOLD) {
				const currentIndex = sources.findIndex(s => s.quality === currentQuality);
				if (currentIndex < sources.length - 1) {
					const nextSource = sources[currentIndex + 1];
					console.log('[Auto Quality] Switching down to:', nextSource.quality);
					onQualityChange(nextSource.quality);
					switchCooldownRef.current = now;
					consecutiveBufferingRef.current = 0;
				}
			}
		};

		const intervalId = setInterval(checkAndSwitch, CHECK_INTERVAL);

		return () => {
			clearInterval(intervalId);
		};
	}, [videoElement, sources, currentQuality, onQualityChange, isAutoQualityEnabled]);

	useEffect(() => {
		lastQualityRef.current = currentQuality;
	}, [currentQuality]);
}
