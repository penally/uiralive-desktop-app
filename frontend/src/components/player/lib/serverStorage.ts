const STORAGE_PREFIX = 'uira-player-';

export interface ServerOrder {
	id: string;
	order: number;
	enabled: boolean;
}

export function saveServerOrder(servers: ServerOrder[]): void {
	try {
		localStorage.setItem(`${STORAGE_PREFIX}server_order`, JSON.stringify(servers));
	} catch (e) {
		console.warn('Failed to save server order:', e);
	}
}

export function getServerOrder(): ServerOrder[] | null {
	try {
		const saved = localStorage.getItem(`${STORAGE_PREFIX}server_order`);
		return saved ? (JSON.parse(saved) as ServerOrder[]) : null;
	} catch (e) {
		console.warn('Failed to get server order:', e);
		return null;
	}
}

