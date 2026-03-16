export function selectSubdomainByRegion(input: string | null): string | null {
	const region = (input || '').toLowerCase();

	// Direct node codes
	if (/(^|\b)(usa5|usa6|usa7|uk1|de2|hk1|ca1|au1|sg1|in1)(\b|$)/.test(region)) {
		const match = region.match(/(usa5|usa6|usa7|uk1|de2|hk1|ca1|au1|sg1|in1)/);
		if (match) return match[1];
	}

	// New explicit city-based regions
	if (region.includes('dallas')) return 'usa5';
	if (region.includes('portland')) return 'usa6';
	if (region.includes('new-york')) return 'usa7';
	if (region.includes('paris')) return Math.random() < 0.5 ? 'uk1' : 'de2';
	if (region.includes('hong-kong')) return 'hk1';
	if (region.includes('kansas')) return Math.random() < 0.5 ? 'usa7' : 'usa6';
	if (region.includes('sydney')) return 'au1';
	if (region.includes('singapore')) return 'sg1';
	if (region.includes('mumbai')) return 'in1';

	// Backward compatible mapping for older region names
	if (region === 'east') return 'usa7';
	if (region === 'west') return 'usa6';
	if (region === 'south') return 'usa5';
	if (region === 'europe') return Math.random() < 0.5 ? 'uk1' : 'de2';
	if (region === 'asia') return 'sg1';

	return null;
}

export function rewriteSheguSubdomain(originalUrl: string, subdomain: string): string {
	try {
		const parsed = new URL(originalUrl);
		if (parsed.hostname.endsWith('.shegu.net')) {
			parsed.hostname = `${subdomain}.shegu.net`;
			return parsed.toString();
		}
		return originalUrl;
	} catch {
		return originalUrl;
	}
}

