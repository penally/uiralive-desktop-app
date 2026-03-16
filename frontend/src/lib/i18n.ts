// Simple i18n implementation for the player
const translations: Record<string, string> = {
	'player.server.checking': 'Checking...',
	'player.server.noVideo': 'No video sources available',
	'player.server.failedFetch': 'Failed to fetch video',
	'source.checking': 'Checking...',
	'source.failedFetch': 'Failed to fetch',
	'source.success': 'Available',
	'source.prioritytext': 'Priority {count}',
};

export function t(key: string, params?: Record<string, any>): string {
	let translation = translations[key] || key;
	
	if (params) {
		Object.keys(params).forEach((param) => {
			translation = translation.replace(`{${param}}`, String(params[param]));
		});
	}
	
	return translation;
}

//