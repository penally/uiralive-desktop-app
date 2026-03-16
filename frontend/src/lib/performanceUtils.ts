import { imageSizes } from './config';

type PerformanceMode = 'low' | 'medium' | 'high';

/**
 * Get optimized image size based on performance mode and image type
 */
export const getImageSize = (
	type: 'poster' | 'backdrop' | 'profile',
	requestedSize: string,
	performanceMode: PerformanceMode = 'medium'
): string => {
	if (performanceMode === 'low') {
		if (requestedSize === 'large' || requestedSize === 'original') {
			return 'medium';
		}
		return requestedSize;
	}

	if (performanceMode === 'high') {
		return requestedSize;
	}

	// Medium performance mode
	if (requestedSize === 'original' && type !== 'profile') {
		return 'large';
	}

	return requestedSize;
};

/**
 * Check if device supports high-resolution images
 */
export const supportsHighRes = (): boolean => {
	if (typeof window === 'undefined') return false;
	return window.devicePixelRatio > 1;
};

/**
 * Get adaptive image size based on viewport width
 */
export const getAdaptiveSize = (
	type: 'poster' | 'backdrop' | 'profile',
	viewportWidth: number
): keyof typeof imageSizes.poster |
	keyof typeof imageSizes.backdrop |
	keyof typeof imageSizes.profile => {

	if (type === 'backdrop') {
		if (viewportWidth >= 1920) return 'large';
		if (viewportWidth >= 1280) return 'medium';
		return 'small';
	}

	if (type === 'poster') {
		if (viewportWidth >= 1280) return 'large';
		if (viewportWidth >= 768) return 'medium';
		return 'small';
	}

	return viewportWidth >= 1280
		? 'large'
		: viewportWidth >= 768
			? 'medium'
			: 'small';
};