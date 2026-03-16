import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { fetchSubtitles } from './lib/api';
import { saveProgress, getProgress, saveSettings, getSettings, getOrCreateGuestId, getGuestDisplayName, setGuestDisplayName, type MediaMeta } from './lib/storage';
import { saveProgressToBackend, fetchProgress, fetchPlayerSettings, savePlayerSettingsToBackend, checkContentLocked, apiUrl } from '@/lib/api/backend';
import { fetchIntroData, type IntroSegments } from './lib/intro';
import { usePlayerControls } from './hooks/usePlayerControls';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useQualityAutoSwitch } from './hooks/useQualityAutoSwitch';
import PlayerControls from './components/PlayerControls';
import SettingsMenu from './components/SettingsMenu';
import { SubtitleSelection } from './components/SubtitleSelection';
import EpisodesMenu from './components/EpisodesMenu';
import DebugPanel from './components/DebugPanel';
import SourceCheckList from './components/SourceCheckList';
import PauseScreen from './components/PauseScreen';
import WatchPartyChat from './components/WatchPartyChat';
import { customServers } from './servers/customServers';
import { getFreshServerConfigs } from './servers/index';
import { DelayedPasmellsTurnstile, BalooPowPrewarm } from './servers/pasmells/PasmellsTurnstile';

import { isExtensionActive } from '@/backend/extension';
import { getElectronAPI } from '@/lib/electron';
import { useDiscordRPCPlayer } from '@/components/DiscordRPC';
import type { MediaSource, SubtitleTrack, PlayerSettings, PlayerState, ProviderSubtitle } from './lib/types';
import { getVideoFormat, getPlaybackUrl, hasNativeHlsSupport } from './lib/videoLoader';
import { tmdbApi, getBackdropUrl, getPosterUrl, type TMDBMovie, type TMDBSeries } from '../../lib/tmdb';
import { t } from '../../lib/i18n';
import { Icon } from '@iconify/react';
import Hls from 'hls.js';

interface PlayerProps {
	tmdbId: number;
	season?: number;
	episode?: number;
}

interface ExtendedPlayerState extends PlayerState {
	isSwitchingSource: boolean;
	toast?: string;
}

interface ExtendedPlayerSettings extends PlayerSettings {
	autoQuality: boolean;
	autoNext?: boolean;
	skipEndCredits?: boolean;
	subtitleFontFamily?: string;
	subtitleFontWeight?: string;
	subtitleFontStyle?: string;
	subtitleTextDecoration?: string;
	subtitleBgOpacity?: number;
	fixSubtitles?: boolean;
	fixCapitalization?: boolean;
	subtitleBgRgba?: string;
}

const Player: React.FC<PlayerProps> = ({ tmdbId, season, episode }) => {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const { currentTheme } = useTheme();
	const { token } = useAuth();

	const [playerState, setPlayerState] = useState<ExtendedPlayerState>({
		isPlaying: false,
		currentTime: 0,
		duration: 0,
		buffered: 0,
		volume: 1,
		isFullscreen: false,
		isSettingsOpen: false,
		isControlsVisible: true,
		quality: '',
		loading: true,
		error: null,
		isSwitchingSource: false
	});

	const [playerSettings, setPlayerSettings] = useState<ExtendedPlayerSettings>({
		quality: '',
		subtitle: null,
		subtitleSize: 24,
		subtitleColor: 'rgb(255, 255, 255)',
		subtitleBackground: '#000000',
		subtitlePosition: 0,
		subtitleDelay: 0,
		volume: 1,
		playbackRate: 1,
		autoQuality: false,
		autoNext: true,
		skipEndCredits: true,
		subtitleFontFamily: 'Arial',
		subtitleFontWeight: 'normal',
		subtitleFontStyle: 'normal',
		subtitleTextDecoration: 'none',
		subtitleBgOpacity: 0.35,
		fixSubtitles: true,
		fixCapitalization: false
	});

	const videoElementRef = useRef<HTMLVideoElement | null>(null);
	const [sources, setSources] = useState<MediaSource[]>([]);
	const [currentSource, setCurrentSource] = useState<MediaSource | null>(null);
	const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([]);
	const [isDebugOpen, setIsDebugOpen] = useState(false);
	const [subtitleBaseOffset, setSubtitleBaseOffset] = useState(80);
	const [currentSubtitleText, setCurrentSubtitleText] = useState<string>('');
	const [lastProgressSave, setLastProgressSave] = useState(0);
	const settingsButtonRef = useRef<HTMLButtonElement | null>(null);
	const subtitleButtonRef = useRef<HTMLButtonElement | null>(null);
	const episodesButtonRef = useRef<HTMLButtonElement | null>(null);
	const controlsBarRef = useRef<HTMLDivElement | null>(null);
	const [mediaDetails, setMediaDetails] = useState<(TMDBMovie | TMDBSeries) | null>(null);
	const [mediaYear, setMediaYear] = useState<number | null>(null);
	const [lastEpisodesBySeason, setLastEpisodesBySeason] = useState<Record<number, number>>({});
	const hlsInstanceRef = useRef<Hls | null>(null);
	const attemptedFemboxHlsFallbackRef = useRef(false);
	const sourceLoadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [skipOverlay, setSkipOverlay] = useState({ amount: 0, direction: 'forward' as 'forward' | 'backward', visible: false });
	const [hlsQualityLevels, setHlsQualityLevels] = useState<Array<{ height: number; width: number; bitrate: number; index: number }>>([]);
	const hlsQualityLevelsRef = useRef<Array<{ height: number; width: number; bitrate: number; index: number }>>([]);
	const [hlsAudioTracks, setHlsAudioTracks] = useState<Array<{ id: number; name: string; lang: string; default: boolean }>>([]);
	const [, setCurrentHlsLevel] = useState<number>(-1);
	const [currentHlsAudioTrack, setCurrentHlsAudioTrack] = useState<number>(0);
	const skipOverlayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [volumeOverlay, setVolumeOverlay] = useState({ delta: 0, visible: false });
	const volumeOverlayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [introSegments, setIntroSegments] = useState<IntroSegments>({});
	const [shortcutsMenuVisible, setShortcutsMenuVisible] = useState(false);
	const [isEpisodesMenuOpen, setIsEpisodesMenuOpen] = useState(false);
	const [serverChecks, setServerChecks] = useState<{ name: string; status: 'pending' | 'checking' | 'ok' | 'fail'; message?: string }[]>([]);
	const serverCheckClearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const isResettingVideoRef = useRef(false);
	const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
	const [watchPartyRoomId, setWatchPartyRoomId] = useState<string | null>(null);
	const [watchPartyHostId, setWatchPartyHostId] = useState<string | null>(null);
	const [watchPartyUserId, setWatchPartyUserId] = useState<string | null>(null);
	const [watchPartyCanSkip, setWatchPartyCanSkip] = useState(false);
	const [watchPartyParticipants, setWatchPartyParticipants] = useState<Array<{ userId: string; displayName: string; avatar: string | null; isHost: boolean; canSkip: boolean }>>([]);
	const [watchPartyOverlayVisible, setWatchPartyOverlayVisible] = useState(false);
	const [watchPartyChatOpen, setWatchPartyChatOpen] = useState(false);
	const [watchPartyChatMessages, setWatchPartyChatMessages] = useState<Array<{ userId: string; displayName: string; avatar: string | null; text: string; ts: number }>>([]);
	const watchPartySyncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const watchPartyWsRef = useRef<WebSocket | null>(null);
	const watchPartyCanSkipRef = useRef(false);
	const watchPartyUserIdRef = useRef<string | null>(null);
	const watchPartyJoiningRef = useRef(false);
	const watchPartyGuestPausedRef = useRef(false);
	const watchPartyApplyingHostStateRef = useRef(false);
	const watchPartyLastHostStateRef = useRef<{ isPlaying: boolean; currentTime: number }>({ isPlaying: true, currentTime: 0 });
	const savePlayerSettingsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	watchPartyCanSkipRef.current = watchPartyCanSkip;
	watchPartyUserIdRef.current = watchPartyUserId;

	const [serverConfigs, setServerConfigs] = useState(() => getFreshServerConfigs());
	const [isSubtitleMenuOpen, setIsSubtitleMenuOpen] = useState(false);
	const [isLocked, setIsLocked] = useState<boolean | null>(null);
	const [lockReason, setLockReason] = useState<string | undefined>(undefined);

	// Enhanced sources that include HLS quality levels as virtual sources
	const enhancedSources = useMemo(() => {
		// If we have HLS quality levels, create virtual sources for each level
		if (hlsQualityLevels.length > 1 && currentSource?.type === 'hls') {
			const heightToQuality: Record<number, string> = {
				2160: '4K',
				1080: '1080p',
				720: '720p',
				480: '480p',
				360: '360p'
			};

			const hlsVirtualSources: MediaSource[] = [
				// Auto quality option
				{
					...currentSource,
					quality: 'Auto',
					name: `${currentSource.name} (Auto)`
				},
				// Individual quality levels
				...hlsQualityLevels.map(level => ({
					...currentSource,
					quality: heightToQuality[level.height] || `${level.height}p`,
					name: `${currentSource.name} (${heightToQuality[level.height] || level.height + 'p'})`
				}))
			];

			return hlsVirtualSources;
		}

		return sources;
	}, [sources, hlsQualityLevels, currentSource]);

	const mediaBackdropUrl = useMemo(
		() => (mediaDetails?.backdrop_path ? getBackdropUrl(mediaDetails.backdrop_path, 'large') : ''),
		[mediaDetails]
	);

	const mediaTitle = useMemo(
		() => (mediaDetails ? ('title' in mediaDetails ? mediaDetails.title : mediaDetails.name) : null),
		[mediaDetails]
	);

	useDiscordRPCPlayer(
		mediaDetails && getElectronAPI()?.rpcSetActivity
			? {
					title: mediaTitle ?? 'Unknown',
					season,
					episode,
					currentTime: playerState.currentTime,
					duration: playerState.duration,
					isPlaying: playerState.isPlaying,
					posterUrl: mediaDetails.poster_path ? getPosterUrl(mediaDetails.poster_path, 'medium') : undefined,
				}
			: null
	);

	useEffect(() => {
		if (!selectedServerId && serverConfigs.length > 0) {
			setSelectedServerId(serverConfigs[0]?.id ?? null);
		}
	}, [selectedServerId, serverConfigs]);

	useEffect(() => {
		let cancelled = false;
		const check = async () => {
			const type = season != null && episode != null ? 'tv' : 'movie';
			const result = await checkContentLocked(tmdbId, type, season ?? undefined, episode ?? undefined);
			if (!cancelled) {
				setIsLocked(result.locked);
				setLockReason(result.reason);
			}
		};
		void check();
		return () => { cancelled = true; };
	}, [tmdbId, season, episode]);

	useEffect(() => {
		if (!mediaDetails) {
			setMediaYear(null);
			return;
		}
		const date = 'release_date' in mediaDetails ? mediaDetails.release_date : mediaDetails.first_air_date;
		setMediaYear(date ? new Date(date).getFullYear() : null);
	}, [mediaDetails]);

	const syncPlaybackState = useCallback(() => {
		if (!watchPartyRoomId || !watchPartyUserId || !videoElementRef.current || !watchPartyCanSkip) return;
		const ws = watchPartyWsRef.current;
		if (ws?.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify({
				type: 'playback',
				userId: watchPartyUserId,
				isPlaying: !videoElementRef.current.paused,
				currentTime: videoElementRef.current.currentTime
			}));
		} else {
			fetch(apiUrl('/api/watch-party/sync'), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
				body: JSON.stringify({ code: watchPartyRoomId, roomId: watchPartyRoomId, userId: watchPartyUserId, isPlaying: !videoElementRef.current.paused, currentTime: videoElementRef.current.currentTime })
			}).catch(() => {});
		}
	}, [watchPartyRoomId, watchPartyUserId, watchPartyCanSkip, token]);

	const startWatchPartySync = useCallback(() => {
		if (!watchPartyRoomId || !watchPartyUserId) return;

		const path = `/api/watch-party/ws?code=${watchPartyRoomId}`;
		let wsUrl = apiUrl(path);
		if (wsUrl.startsWith('https://')) wsUrl = 'wss://' + wsUrl.slice(8);
		else if (wsUrl.startsWith('http://')) wsUrl = 'ws://' + wsUrl.slice(7);
		else wsUrl = (window.location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + window.location.host + path;
		const ws = new WebSocket(wsUrl);
		watchPartyWsRef.current = ws;

		ws.onopen = () => {
			ws.send(JSON.stringify({ type: 'join', userId: watchPartyUserId }));
		};
		ws.onmessage = (e) => {
			try {
				const msg = JSON.parse(e.data) as { type: string; isPlaying?: boolean; currentTime?: number; participants?: Array<{ userId: string; displayName: string; avatar: string | null; isHost: boolean; canSkip: boolean }>; userId?: string; displayName?: string; avatar?: string | null; text?: string; ts?: number };
				if (msg.type === 'chat' && msg.userId && msg.displayName != null && msg.text) {
					setWatchPartyChatMessages(prev => [...prev, { userId: msg.userId!, displayName: msg.displayName!, avatar: msg.avatar ?? null, text: msg.text!, ts: msg.ts ?? Date.now() }]);
				} else if (msg.type === 'participants' && msg.participants) {
					setWatchPartyParticipants(msg.participants);
					const me = msg.participants.find((p: { userId: string }) => p.userId === watchPartyUserIdRef.current);
					if (!me) {
						ws.close();
						setWatchPartyRoomId(null);
						setWatchPartyHostId(null);
						setWatchPartyUserId(null);
						setWatchPartyCanSkip(false);
						setWatchPartyParticipants([]);
						setWatchPartyChatMessages([]);
						const url = new URL(window.location.href);
						url.searchParams.delete('code');
						navigate(url.pathname + url.search || '?', { replace: true });
					} else {
						setWatchPartyCanSkip(me.canSkip);
					}
				} else if (msg.type === 'playback' && videoElementRef.current && !watchPartyCanSkipRef.current) {
					const hostTime = msg.currentTime ?? 0;
					const hostPlaying = msg.isPlaying ?? true;
					watchPartyLastHostStateRef.current = { isPlaying: hostPlaying, currentTime: hostTime };
					if (watchPartyGuestPausedRef.current) {
						return;
					}
					watchPartyApplyingHostStateRef.current = true;
					const timeDiff = Math.abs(videoElementRef.current.currentTime - hostTime);
					if (timeDiff > 0.5) videoElementRef.current.currentTime = hostTime;
					if (hostPlaying && videoElementRef.current.paused) videoElementRef.current.play().catch(() => {});
					else if (!hostPlaying && !videoElementRef.current.paused) videoElementRef.current.pause();
					setTimeout(() => { watchPartyApplyingHostStateRef.current = false; }, 50);
				}
			} catch {}
		};
		ws.onclose = () => {
			watchPartyWsRef.current = null;
		};

		if (watchPartySyncIntervalRef.current) clearInterval(watchPartySyncIntervalRef.current);
		watchPartySyncIntervalRef.current = setInterval(() => {
			if (watchPartyCanSkip) syncPlaybackState();
		}, 500);
	}, [watchPartyRoomId, watchPartyUserId, watchPartyCanSkip, syncPlaybackState]);


	const applySettings = (saved: Record<string, any>) => {
		setPlayerSettings(prev => ({
			...prev,
			...(saved.subtitleSize && { subtitleSize: saved.subtitleSize }),
			...(saved.subtitleColor && { subtitleColor: saved.subtitleColor }),
			...(saved.subtitleBackground && { subtitleBackground: saved.subtitleBackground }),
			...(saved.subtitlePosition !== undefined && { subtitlePosition: saved.subtitlePosition }),
			...(saved.volume !== undefined && { volume: saved.volume }),
			...(saved.playbackRate && { playbackRate: saved.playbackRate }),
			...(saved.autoQuality !== undefined && { autoQuality: saved.autoQuality }),
			...((saved as any).autoNext !== undefined && { autoNext: (saved as any).autoNext }),
			...((saved as any).skipEndCredits !== undefined && { skipEndCredits: (saved as any).skipEndCredits }),
			...((saved as any).subtitleFontFamily && { subtitleFontFamily: (saved as any).subtitleFontFamily }),
			...((saved as any).subtitleFontWeight && { subtitleFontWeight: (saved as any).subtitleFontWeight }),
			...((saved as any).subtitleFontStyle && { subtitleFontStyle: (saved as any).subtitleFontStyle }),
			...((saved as any).subtitleTextDecoration && { subtitleTextDecoration: (saved as any).subtitleTextDecoration }),
			...((saved as any).subtitleBgOpacity !== undefined && { subtitleBgOpacity: (saved as any).subtitleBgOpacity }),
			...((saved as any).subtitleDelay !== undefined && { subtitleDelay: (saved as any).subtitleDelay }),
			...((saved as any).fixSubtitles !== undefined && { fixSubtitles: (saved as any).fixSubtitles }),
			...((saved as any).fixCapitalization !== undefined && { fixCapitalization: (saved as any).fixCapitalization }),
		}));

		const bgColor = saved.subtitleBackground || '#000000';
		const opacity = (saved as any).subtitleBgOpacity || 0.7;
		const r = parseInt(bgColor.slice(1, 3), 16);
		const g = parseInt(bgColor.slice(3, 5), 16);
		const b = parseInt(bgColor.slice(5, 7), 16);
		setPlayerSettings(prev => ({
			...prev,
			subtitleBgRgba: `rgba(${r}, ${g}, ${b}, ${opacity})`
		}));
	};

	useEffect(() => {
		const saved = getSettings();
		applySettings(saved);

		// Also load from backend (merges on top of localStorage, backend is source of truth)
		fetchPlayerSettings().then(backendSettings => {
			if (backendSettings && Object.keys(backendSettings).length > 0) {
				const merged = { ...saved, ...backendSettings };
				saveSettings(merged);
				applySettings(merged);
			}
		});

		// Hide extension-required servers if the extension is not installed
		isExtensionActive().then(active => {
			if (!active) {
				setServerConfigs(prev => prev.filter(s => !s.extensionRequired));
			}
		});

		loadMediaSources();
		loadMediaDetails();
	}, []);

	useEffect(() => {
		const codeParam = searchParams.get('code') || searchParams.get('roomId');
		if (!codeParam || codeParam.length !== 4 || watchPartyRoomId) return;
		if (watchPartyJoiningRef.current) return;
		const serverId = selectedServerId ? (selectedServerId.includes(':') ? selectedServerId.split(':')[0] : selectedServerId) : serverConfigs[0]?.id;
		if (!serverId) return;
		watchPartyJoiningRef.current = true;
		const headers: Record<string, string> = { 'Content-Type': 'application/json' };
		if (token) headers['Authorization'] = `Bearer ${token}`;
		const body: Record<string, string> = { code: codeParam.toUpperCase(), serverId };
		if (!token) {
			body.guestUserId = getOrCreateGuestId();
			const savedName = getGuestDisplayName();
			if (savedName) body.displayName = savedName;
		}
		fetch(apiUrl('/api/watch-party/join'), {
			method: 'POST',
			headers,
			body: JSON.stringify(body)
		}).then(response => response.ok ? response.json() : null).then((data: { room?: { hostId: string; participants?: Array<{ userId: string; displayName: string; avatar: string | null; isHost: boolean; canSkip: boolean }> }; userId?: string }) => {
			watchPartyJoiningRef.current = false;
			if (data?.room) {
				setWatchPartyRoomId(codeParam.toUpperCase());
				setWatchPartyHostId(data.room.hostId);
				setWatchPartyUserId(data.userId || getOrCreateGuestId());
				setWatchPartyParticipants(data.room.participants ?? []);
				const me = data.room.participants?.find((p: { userId: string }) => p.userId === data.userId);
				setWatchPartyCanSkip(me?.canSkip ?? false);
			}
		}).catch(() => {
			watchPartyJoiningRef.current = false;
		});
		return () => { watchPartyJoiningRef.current = false; };
	}, [searchParams, selectedServerId, serverConfigs, watchPartyRoomId, token]);

	useEffect(() => {
		if (watchPartyRoomId && watchPartyUserId) {
			startWatchPartySync();
			return () => {
				if (watchPartySyncIntervalRef.current) {
					clearInterval(watchPartySyncIntervalRef.current);
					watchPartySyncIntervalRef.current = null;
				}
				if (watchPartyWsRef.current) {
					watchPartyWsRef.current.close();
					watchPartyWsRef.current = null;
				}
			};
		}
	}, [watchPartyRoomId, watchPartyUserId, startWatchPartySync]);

	const loadMediaDetails = async () => {
		try {
			if (!tmdbId) return;
			if (season !== undefined && episode !== undefined) {
				setMediaDetails(await tmdbApi.getTVDetails(tmdbId));
			} else {
				setMediaDetails(await tmdbApi.getMovieDetails(tmdbId));
			}
		} catch (error) {
			console.error('Error fetching media details:', error);
		}
	};

	const mergeSubtitleTracks = (existing: SubtitleTrack[], incoming: SubtitleTrack[]): SubtitleTrack[] => {
		const seen = new Set<string>();
		const merged: SubtitleTrack[] = [];

		const register = (track: SubtitleTrack) => {
			const key = track.id || track.url || `${track.language}-${track.src}`;
			if (key) {
				seen.add(key);
			}
			merged.push(track);
		};

		existing.forEach(register);
		incoming.forEach((track) => {
			const key = track.id || track.url || `${track.language}-${track.src}`;
			if (!key || !seen.has(key)) {
				register(track);
			}
		});

		return merged;
	};

	const buildSubtitleTracksFromResponse = (subtitles?: ProviderSubtitle[]): SubtitleTrack[] => {
		if (!subtitles || subtitles.length === 0) return [];

		return subtitles
			.map((track, index) => {
				const url = track.url || track.file || track.src;
				if (!url) return null;

				const language = (track.language || track.lang || track.srclang || 'und').toLowerCase();
				const label = track.display || track.label || language.toUpperCase();

				return {
					id: track.id?.toString() ?? `provider-${index}`,
					label,
					display: label,
					language,
					src: url,
					srclang: language,
					url,
					flagUrl: track.flagUrl,
					source: 'provider',
					isHearingImpaired: track.isHearingImpaired
				} as SubtitleTrack;
			})
			.filter(Boolean) as SubtitleTrack[];
	};

	const loadSubtitles = async (existingTracks: SubtitleTrack[] = []) => {
		try {
			const tracks = await fetchSubtitles(tmdbId, season, episode);
			if (tracks.length > 0) {
				const providerTracks = existingTracks.filter(t => t.source === 'provider');
				setSubtitleTracks(providerTracks.length > 0 ? mergeSubtitleTracks(providerTracks, tracks) : tracks);
			} else {
				setSubtitleTracks(existingTracks.filter(t => t.source === 'provider'));
			}
		} catch (error) {
			console.error('Error loading subtitles:', error);
			setSubtitleTracks(existingTracks.filter(t => t.source === 'provider'));
		}
	};

	const loadMediaSources = async (overrideServerId?: string): Promise<boolean> => {
		let success = false;
		try {
			setPlayerState(prev => ({ ...prev, loading: true, error: null }));
			
			if (serverChecks.length === 0) {
				setServerChecks(serverConfigs.map((config) => ({
					name: config.name,
					status: 'pending' as const,
					message: undefined
				})));
			}
			
			// Use the override if provided (handles the case where setSelectedServerId hasn't re-rendered yet)
			const activeServerId = overrideServerId !== undefined ? overrideServerId : selectedServerId;
			const isInitialLoad = !activeServerId || serverChecks.every(c => c.status === 'pending');
			
			if (serverCheckClearTimeoutRef.current) {
				clearTimeout(serverCheckClearTimeoutRef.current);
				serverCheckClearTimeoutRef.current = null;
			}
			
			let allLinks: MediaSource[] = [];
			let allSubtitles: ProviderSubtitle[] = [];
			
			const parseSelectedServer = (id: string | null) => {
				if (!id) return { serverId: null, subServerName: null };
				const parts = id.split(':');
				if (parts.length === 2) {
					return { serverId: parts[0], subServerName: parts[1] };
				}
				return { serverId: id, subServerName: null };
			};

			const parsedSelected = parseSelectedServer(activeServerId);

			const orderedServers = [...serverConfigs].sort((a, b) => {
				if (parsedSelected.serverId && a.id === parsedSelected.serverId) return -1;
				if (parsedSelected.serverId && b.id === parsedSelected.serverId) return 1;
				return a.order - b.order;
			});

			let successfulServerId: string | null = null;
			const failedServers: string[] = [];
			
			for (const serverConfig of orderedServers) {
				try {
					if (isInitialLoad) {
						setServerChecks(prev => prev.map((check) =>
							check.name === serverConfig.name
								? { ...check, status: 'checking' as const, message: t('player.server.checking') }
								: check
						));
						await new Promise(resolve => setTimeout(resolve, 100));
					}

					const isSelected = parsedSelected.serverId === serverConfig.id;
					const subServerName = isSelected ? parsedSelected.subServerName : null;
					
					const serverSourcesRaw = await serverConfig.fetchSources(tmdbId, season, episode, subServerName || undefined);
					const serverSources = serverSourcesRaw.map((s) => ({
						...s,
						useProxy: serverConfig.useProxy ?? s.useProxy ?? false
					}));
					if (serverSources.length > 0) {
						allLinks = [...allLinks, ...serverSources];
						if (isInitialLoad) {
							setServerChecks(prev => prev.map((check) =>
								check.name === serverConfig.name
									? { ...check, status: 'ok' as const, message: undefined }
									: check
							));
						}
						success = true;
						successfulServerId = serverConfig.id;
						if (serverConfig.getSubtitles) {
							const subtitles = await serverConfig.getSubtitles(tmdbId, season, episode, subServerName || undefined);
							if (subtitles.length > 0) {
								allSubtitles = [...allSubtitles, ...subtitles];
							}
						}
						break;
					}
					
					failedServers.push(serverConfig.name);
					if (isInitialLoad) {
						setServerChecks(prev => prev.map((check) =>
							check.name === serverConfig.name 
								? { ...check, status: 'fail' as const, message: t('player.server.noVideo') }
								: check
						));
					}
				} catch (error) {
					console.warn(`${serverConfig.name} failed:`, error);
					failedServers.push(serverConfig.name);
					if (isInitialLoad) {
						setServerChecks(prev => prev.map((check) =>
							check.name === serverConfig.name 
								? { ...check, status: 'fail' as const, message: t('player.server.failedFetch') }
								: check
						));
					}
				}
			}
			
			if (activeServerId && successfulServerId) {
				if (activeServerId !== successfulServerId) {
					const selectedServerFailed = serverChecks.find(
						check => {
							const server = serverConfigs.find(s => s.name === check.name);
							const parsed = parseSelectedServer(activeServerId);
							return server?.id === parsed.serverId && check.status === 'fail';
						}
					);
					if (selectedServerFailed) {
						setSelectedServerId(successfulServerId);
					}
				}
			} else if (activeServerId && !successfulServerId) {
				setSelectedServerId(null);
			} else if (!activeServerId && successfulServerId) {
				setSelectedServerId(successfulServerId);
			}
			
			allLinks = [...allLinks, ...customServers];

			if (allLinks.length === 0) {
				if (failedServers.length === orderedServers.length || (parsedSelected.serverId && !successfulServerId)) {
					throw new Error(t('player.server.noVideo'));
				}
			}

			const sortedSources = allLinks.sort((a: MediaSource, b: MediaSource) => {
				const normalizeQuality = (q: string) => {
					const upper = q.toUpperCase();
					return upper === 'ORG' ? '4K' : upper;
				};
				const qualityOrder = ['4K', '1080P', '720P', '480P', '360P'];
				const aNorm = normalizeQuality(a.quality);
				const bNorm = normalizeQuality(b.quality);
				const aIndex = qualityOrder.indexOf(aNorm);
				const bIndex = qualityOrder.indexOf(bNorm);
				if (aIndex !== -1 && bIndex !== -1) {
					const qualityDiff = aIndex - bIndex;
					if (qualityDiff !== 0) return qualityDiff;
					const fmtOrder = { hls: 0, mp4: 1, mkv: 2, other: 3 };
					const fmtA = getVideoFormat(a);
					const fmtB = getVideoFormat(b);
					return fmtOrder[fmtA] - fmtOrder[fmtB];
				}
				if (aIndex !== -1) return -1;
				if (bIndex !== -1) return 1;
				const fmtOrder = { hls: 0, mp4: 1, mkv: 2, other: 3 };
				return fmtOrder[getVideoFormat(a)] - fmtOrder[getVideoFormat(b)];
			});

			setSources(sortedSources);

			const providerSubtitles = buildSubtitleTracksFromResponse(allSubtitles);
			if (providerSubtitles.length) {
				setSubtitleTracks(providerSubtitles);
			} else {
				setSubtitleTracks([]);
			}

			const normalizeQuality = (q: string) => {
				const upper = q.toUpperCase();
				return upper === 'ORG' ? '4K' : upper;
			};
			
			const defaultQuality = sortedSources[0]?.quality || '';
			
			let qualityToUse = defaultQuality;
			if (!playerSettings.autoQuality && playerSettings.quality) {
				const savedNormalized = normalizeQuality(playerSettings.quality);
				const exactMatch = sortedSources.find(s => s.quality === playerSettings.quality);
				if (exactMatch) {
					qualityToUse = exactMatch.quality;
				} else {
					const normalizedMatch = sortedSources.find(s => normalizeQuality(s.quality) === savedNormalized);
					if (normalizedMatch) {
						qualityToUse = normalizedMatch.quality;
					} else {
						qualityToUse = defaultQuality;
					}
				}
			}
			
			setPlayerSettings(prev => ({ ...prev, quality: qualityToUse }));
			setPlayerState(prev => ({ ...prev, quality: qualityToUse }));

			loadSubtitles([...subtitleTracks]);
			
			if (success) {
				try {
					const segments = await fetchIntroData(tmdbId, season, episode);
					setIntroSegments(segments);
				} catch (error) {
					console.error('Error loading intro data:', error);
				}
			}
			
			success = sortedSources.length > 0;

			if (!success) {
				setSubtitleTracks([]);
			}
		} catch (error) {
			console.error('Error loading media sources:', error);
			setPlayerState(prev => ({
				...prev,
				error: error instanceof Error ? error.message : 'Failed to load media'
			}));
			setSubtitleTracks([]);
		} finally {
			setPlayerState(prev => ({ ...prev, loading: false }));
			serverCheckClearTimeoutRef.current = setTimeout(() => {
				setServerChecks([]);
			}, 3000);
		}
		return success;
	};

	const handleSelectServer = async (serverId: string, subServerName?: string): Promise<boolean> => {
		const newSelectedId = subServerName ? `${serverId}:${subServerName}` : serverId;
		console.log(`[handleSelectServer] ▶ START switching to "${newSelectedId}" (isResetting=${isResettingVideoRef.current})`);

		// Clear any existing source load timeout
		if (sourceLoadTimeoutRef.current) {
			clearTimeout(sourceLoadTimeoutRef.current);
			sourceLoadTimeoutRef.current = null;
		}

		setSources([]);
		setCurrentSource(null);
		setSubtitleTracks([]);
		setPlayerState(prev => ({ ...prev, loading: true, error: null }));
		setServerChecks(serverConfigs.map((config) => ({
			name: config.name,
			status: 'pending' as const,
			message: undefined
		})));

		// Set flag first — HLS destroy() and src='' both fire error events
		console.log(`[handleSelectServer] Setting isResettingVideoRef = true`);
		isResettingVideoRef.current = true;

		if (videoElementRef.current) {
			console.log(`[handleSelectServer] videoElement exists, readyState=${videoElementRef.current.readyState}`);

			if (hlsInstanceRef.current) {
				console.log(`[handleSelectServer] Destroying HLS instance`);
				hlsInstanceRef.current.destroy();
				hlsInstanceRef.current = null;
			setHlsQualityLevels([]);
			hlsQualityLevelsRef.current = [];
			setHlsAudioTracks([]);
			setCurrentHlsLevel(-1);
			setCurrentHlsAudioTrack(0);
			console.log(`[handleSelectServer] HLS destroyed`);
			} else {
				console.log(`[handleSelectServer] No HLS instance to destroy`);
			}

			console.log(`[handleSelectServer] Clearing video src`);
			videoElementRef.current.src = '';
			videoElementRef.current.load();
			console.log(`[handleSelectServer] Video src cleared, readyState=${videoElementRef.current.readyState}`);

			// Wait for the unload to complete
			await new Promise(resolve => {
				const video = videoElementRef.current;
				if (!video) {
					console.log(`[handleSelectServer] videoElement gone during unload wait, resolving immediately`);
					resolve(void 0);
					return;
				}

				const onEmptied = () => {
					video.removeEventListener('emptied', onEmptied);
					console.log(`[handleSelectServer] 'emptied' event fired`);
					resolve(void 0);
				};

				if (video.readyState === 0) {
					console.log(`[handleSelectServer] Already unloaded (readyState=0)`);
					resolve(void 0);
				} else {
					console.log(`[handleSelectServer] Waiting for 'emptied' event (readyState=${video.readyState})`);
					video.addEventListener('emptied', onEmptied);
					setTimeout(() => {
						video.removeEventListener('emptied', onEmptied);
						console.log(`[handleSelectServer] Timeout waiting for 'emptied', continuing`);
						resolve(void 0);
					}, 1000);
				}
			});
		} else {
			console.warn(`[handleSelectServer] videoElementRef.current is NULL — cannot reset video`);
		}

		const previousSelectedId = selectedServerId;
		setSelectedServerId(newSelectedId);

		// Pass newSelectedId directly — setSelectedServerId hasn't re-rendered yet so
		// loadMediaSources would otherwise read the stale selectedServerId from the closure
		console.log(`[handleSelectServer] Calling loadMediaSources("${newSelectedId}") (isResetting still true)`);
		const result = await loadMediaSources(newSelectedId);
		console.log(`[handleSelectServer] loadMediaSources() returned: ${result}`);

		// Clear only after loadMediaSources completes — HLS destroy fires async errors
		// that can land during the fetch, so we suppress them for the whole transition
		console.log(`[handleSelectServer] Setting isResettingVideoRef = false`);
		isResettingVideoRef.current = false;

		if (result) {
			setSelectedServerId(newSelectedId);
		} else {
			console.warn(`[handleSelectServer] loadMediaSources failed, restoring previous server: "${previousSelectedId}"`);
			setSelectedServerId(previousSelectedId);
		}

		console.log(`[handleSelectServer] ▶ END switching to "${newSelectedId}"`);
		return result;
	};

	const tryNextSource = useCallback(async () => {
		if (!currentSource || sources.length <= 1) return;
		const idx = sources.findIndex((s) => s.url === currentSource?.url);
		if (idx < 0 || idx >= sources.length - 1) return;
		const nextSource = sources[idx + 1];
		console.log('[Player] Source failed, trying next:', nextSource?.name, nextSource?.quality);
		setCurrentSource(nextSource);
		setPlayerState(prev => ({
			...prev,
			quality: nextSource.quality,
			error: null,
			loading: true,
			isSwitchingSource: true
		}));
		setPlayerSettings(prev => ({ ...prev, quality: nextSource.quality }));
		await changeQuality(nextSource.quality);
	}, [currentSource, sources]);

	const changeQuality = useCallback(async (quality: string) => {
		const normalizeQuality = (q: string) => {
			const upper = q.toUpperCase();
			return upper === 'ORG' ? '4K' : upper;
		};
		const normalizedQuality = normalizeQuality(quality);
		
		// Check if we're switching quality within an EXISTING HLS master playlist
		// Use the ref so we always read the live value, not a stale closure copy
		const currentHlsLevels = hlsQualityLevelsRef.current;
		if (hlsInstanceRef.current && currentHlsLevels.length > 1) {
			// Map quality string to HLS level index
			const qualityToHeight: Record<string, number> = {
				'4K': 2160,
				'1080P': 1080,
				'720P': 720,
				'480P': 480,
				'360P': 360
			};
			
			const targetHeight = qualityToHeight[normalizedQuality];
			if (targetHeight) {
				// Find the closest matching level
				const levelIndex = currentHlsLevels.findIndex(level => level.height === targetHeight);
				if (levelIndex >= 0) {
					console.log(`Switching HLS quality to ${quality} (level ${levelIndex})`);
					hlsInstanceRef.current.currentLevel = levelIndex;
					setCurrentHlsLevel(levelIndex);
					setPlayerSettings(prev => ({ ...prev, quality }));
					setPlayerState(prev => ({ ...prev, quality, isSwitchingSource: false }));
					return;
				}
			}
			
			// Handle "Auto" quality
			if (quality.toUpperCase() === 'AUTO') {
				console.log('Switching HLS quality to Auto');
				hlsInstanceRef.current.currentLevel = -1; // -1 means auto
				setCurrentHlsLevel(-1);
				setPlayerSettings(prev => ({ ...prev, quality: 'Auto' }));
				setPlayerState(prev => ({ ...prev, quality: 'Auto', isSwitchingSource: false }));
				return;
			}
		}
		
		// Fallback to traditional source switching (or initial load)
		let source = sources.find((s: MediaSource) => s.quality === quality);
		if (!source) {
			source = sources.find((s: MediaSource) => normalizeQuality(s.quality) === normalizedQuality);
		}
		
		// If still no match and we have sources, pick the first one (for "Auto" on initial load)
		if (!source && sources.length > 0 && (quality.toUpperCase() === 'AUTO' || !quality)) {
			source = sources[0];
		}
		
		if (!source || !videoElementRef.current) return;

		setPlayerState(prev => ({ ...prev, isSwitchingSource: true }));

		const currentTime = videoElementRef.current.currentTime || 0;
		const currentVolume = videoElementRef.current.volume;

		setCurrentSource(source);
		attemptedFemboxHlsFallbackRef.current = false;
		setPlayerSettings(prev => ({ ...prev, quality }));
		setPlayerState(prev => ({ ...prev, quality }));

		// Clear any existing timeout
		if (sourceLoadTimeoutRef.current) {
			clearTimeout(sourceLoadTimeoutRef.current);
			sourceLoadTimeoutRef.current = null;
		}

		// Set a timeout to skip to next source if this one doesn't load
		sourceLoadTimeoutRef.current = setTimeout(() => {
			if (videoElementRef.current && videoElementRef.current.readyState < 2) {
				console.error('Source failed to load within timeout, trying next source');
				tryNextSource();
			}
		}, 15000); // 15 second timeout

		if (hlsInstanceRef.current) {
			hlsInstanceRef.current.destroy();
			hlsInstanceRef.current = null;
		// Clear HLS-specific state
		setHlsQualityLevels([]);
		hlsQualityLevelsRef.current = [];
		setHlsAudioTracks([]);
		setCurrentHlsLevel(-1);
		setCurrentHlsAudioTrack(0);
	}

		const isHls = source.type === 'hls' || source.url.includes('.m3u8') || source.url.endsWith('.m3u8');

		const sourceUrl = getPlaybackUrl(source, window.location.origin);

		// For sources with custom headers (like vidlink), always use HLS.js even if native HLS is available
		// This ensures CORS headers are properly applied
		const forceHlsJs = source.headers && Object.keys(source.headers).length > 0;

		if (isHls && (Hls.isSupported() || forceHlsJs)) {
			console.log('Setting up HLS.js for source:', sourceUrl, forceHlsJs ? '(forced due to headers)' : '');

			hlsInstanceRef.current = new Hls({
				enableWorker: true,
				lowLatencyMode: false,
				backBufferLength: 90,
				debug: false,
				maxBufferLength: 30,
				maxMaxBufferLength: 60,
				maxBufferSize: 60 * 1000 * 1000,
				maxBufferHole: 0.5,
				highBufferWatchdogPeriod: 2,
				nudgeOffset: 0.1,
				nudgeMaxRetry: 3,
				fragLoadingTimeOut: 20000,
				manifestLoadingTimeOut: 10000,
				levelLoadingTimeOut: 10000,
				xhrSetup: (xhr: any) => {
					if (source.headers) {
						Object.entries(source.headers).forEach(([key, value]) => {
							const lowerKey = key.toLowerCase();
							if (lowerKey === 'origin' || lowerKey === 'referer') {
								return; // Skip protected headers
							}
							try {
								xhr.setRequestHeader(key, value);
							} catch (headerError) {
								console.error(`Failed to set header ${key}:`, headerError);
							}
						});
					}
				}
			});

			// Add a small delay to ensure domain rules are applied
			await new Promise(resolve => setTimeout(resolve, 500));

			hlsInstanceRef.current.loadSource(sourceUrl);
			hlsInstanceRef.current.attachMedia(videoElementRef.current);

		hlsInstanceRef.current.on(Hls.Events.MANIFEST_PARSED, () => {
			console.log('HLS manifest parsed');
			
			// Extract quality levels from HLS.js
			if (hlsInstanceRef.current) {
				const levels = hlsInstanceRef.current.levels;
				if (levels && levels.length > 0) {
					const qualityLevels = levels.map((level: any, index: number) => ({
						height: level.height,
						width: level.width,
						bitrate: level.bitrate,
						index
					}));
				setHlsQualityLevels(qualityLevels);
				hlsQualityLevelsRef.current = qualityLevels;
				console.log('✅ HLS Quality Levels detected:', qualityLevels.length, 'levels');
					console.log('   Available qualities:', qualityLevels.map(l => `${l.height}p`).join(', '));
					
					// Set current level
					setCurrentHlsLevel(hlsInstanceRef.current.currentLevel);
				}
				
				// Extract audio tracks from HLS.js
				const audioTracks = hlsInstanceRef.current.audioTracks;
				console.log('🔍 Raw HLS audioTracks:', audioTracks);
				console.log('🔍 audioTracks length:', audioTracks?.length);
				console.log('🔍 Current audioTrack index:', hlsInstanceRef.current.audioTrack);
				
				if (audioTracks && audioTracks.length > 0) {
					const tracks = audioTracks.map((track: any, idx: number) => ({
						id: idx,
						name: track.name || track.groupId || `Track ${idx + 1}`,
						lang: track.lang || 'und',
						default: track.default || false
					}));
					setHlsAudioTracks(tracks);
					console.log('✅ HLS Audio Tracks detected:', tracks.length, 'tracks');
					console.log('   Available audio:', tracks.map(t => `${t.name} (${t.lang})`).join(', '));
					
					// Set current audio track
					setCurrentHlsAudioTrack(hlsInstanceRef.current.audioTrack);
				} else {
					console.log('⚠️ No HLS audio tracks detected');
				}
			}
			
			// Clear the timeout since source loaded successfully
			if (sourceLoadTimeoutRef.current) {
				clearTimeout(sourceLoadTimeoutRef.current);
				sourceLoadTimeoutRef.current = null;
			}
			
			setPlayerState(prev => ({ ...prev, isSwitchingSource: false, loading: false }));
			if (videoElementRef.current) {
				if (currentTime > 0) {
					videoElementRef.current.currentTime = Math.min(currentTime, videoElementRef.current.duration || Infinity);
				}
				videoElementRef.current.muted = false;
				videoElementRef.current.volume = currentVolume;
				videoElementRef.current.play().catch((err) => {
					console.warn('Autoplay prevented:', err);
				});
			}
		});

		// Listen for audio tracks being loaded
		hlsInstanceRef.current.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_event: any, data: any) => {
			console.log('🔍 AUDIO_TRACKS_UPDATED event:', data);
			if (hlsInstanceRef.current) {
				const audioTracks = hlsInstanceRef.current.audioTracks;
				console.log('🔍 Updated audioTracks:', audioTracks);
				
				if (audioTracks && audioTracks.length > 0) {
					const tracks = audioTracks.map((track: any, idx: number) => ({
						id: idx,
						name: track.name || track.groupId || `Track ${idx + 1}`,
						lang: track.lang || 'und',
						default: track.default || false
					}));
					setHlsAudioTracks(tracks);
					console.log('✅ HLS Audio Tracks updated:', tracks.length, 'tracks');
					console.log('   Available audio:', tracks.map(t => `${t.name} (${t.lang})`).join(', '));
				}
			}
		});

		// Listen for level switching events
		hlsInstanceRef.current.on(Hls.Events.LEVEL_SWITCHED, (_event: any, data: any) => {
			console.log('HLS level switched to:', data.level);
			setCurrentHlsLevel(data.level);
			
			// Update quality display based on current level
			if (hlsInstanceRef.current && data.level >= 0) {
				const level = hlsInstanceRef.current.levels[data.level];
				if (level) {
					const heightToQuality: Record<number, string> = {
						2160: '4K',
						1080: '1080p',
						720: '720p',
						480: '480p',
						360: '360p'
					};
					const qualityLabel = heightToQuality[level.height] || `${level.height}p`;
					setPlayerState(prev => ({ ...prev, quality: qualityLabel }));
				}
			} else if (data.level === -1) {
				// Auto quality
				setPlayerState(prev => ({ ...prev, quality: 'Auto' }));
			}
		});

		// Listen for audio track switching events
		hlsInstanceRef.current.on(Hls.Events.AUDIO_TRACK_SWITCHED, (_event: any, data: any) => {
			console.log('HLS audio track switched to:', data.id);
			setCurrentHlsAudioTrack(data.id);
		});

		let recoveryAttempts = 0;
		const MAX_RECOVERY_ATTEMPTS = 2;

		hlsInstanceRef.current.on(Hls.Events.ERROR, (_event: any, data: any) => {
				if (!data.fatal) {
					if (data.details === 'fragParsingError' || data.details === 'fragLoadError') {
						console.warn('HLS non-fatal error (will attempt recovery):', data.details, data.reason || '');
						if (videoElementRef.current && videoElementRef.current.readyState < 2) {
							setTimeout(() => {
								if (hlsInstanceRef.current && videoElementRef.current && videoElementRef.current.readyState < 2) {
									console.log('Attempting HLS recovery for non-fatal error...');
									hlsInstanceRef.current.recoverMediaError();
								}
							}, 1000);
						}
					} else {
						console.debug('HLS non-fatal error:', data.details);
					}
					return;
				}
				
				console.error('HLS fatal error:', data);
				
				// Try recovery first, but limit attempts
				if (recoveryAttempts < MAX_RECOVERY_ATTEMPTS) {
					recoveryAttempts++;
					console.log(`HLS recovery attempt ${recoveryAttempts}/${MAX_RECOVERY_ATTEMPTS}`);
					
					switch (data.type) {
						case Hls.ErrorTypes.NETWORK_ERROR:
							console.error('Fatal network error, trying to recover...');
							setTimeout(() => {
								hlsInstanceRef.current?.startLoad();
							}, 500);
							break;
						case Hls.ErrorTypes.MEDIA_ERROR:
							console.error('Fatal media error, trying to recover...');
							setTimeout(() => {
								hlsInstanceRef.current?.recoverMediaError();
							}, 500);
							break;
						default:
							// For other errors, skip to next source immediately
							console.error('Fatal error, skipping to next source');
							hlsInstanceRef.current?.destroy();
							hlsInstanceRef.current = null;
							tryNextSource();
							break;
					}
				} else {
					// Max recovery attempts reached, skip to next source
					console.error('Max recovery attempts reached, skipping to next source');
					hlsInstanceRef.current?.destroy();
					hlsInstanceRef.current = null;
					tryNextSource();
				}
			});
		} else if (isHls && hasNativeHlsSupport() && !forceHlsJs) {
			console.log('Using native HLS for:', sourceUrl);
			videoElementRef.current.src = sourceUrl;
			videoElementRef.current.muted = false;
			videoElementRef.current.volume = currentVolume;
			videoElementRef.current.load();
		} else {
			console.log('Using native video for:', sourceUrl.substring(0, 80) + '...');
			videoElementRef.current.src = sourceUrl;
			videoElementRef.current.muted = false;
			videoElementRef.current.volume = currentVolume;
			videoElementRef.current.load();
		}
		
		const restoreTime = () => {
			// Clear the timeout since source loaded successfully
			if (sourceLoadTimeoutRef.current) {
				clearTimeout(sourceLoadTimeoutRef.current);
				sourceLoadTimeoutRef.current = null;
			}
			
			if (videoElementRef.current) {
				videoElementRef.current.muted = false;
				videoElementRef.current.volume = currentVolume;
				
				const audioTracks = (videoElementRef.current as any).audioTracks;
				if (audioTracks && audioTracks.length > 0) {
					for (let i = 0; i < audioTracks.length; i++) {
						audioTracks[i].enabled = true;
					}
				}
				
				if (currentTime > 0) {
					videoElementRef.current.currentTime = Math.min(currentTime, videoElementRef.current.duration || Infinity);
				}
			}
			setPlayerState(prev => ({ ...prev, isSwitchingSource: false }));
		};
		
		videoElementRef.current.addEventListener('loadedmetadata', restoreTime, { once: true });
		videoElementRef.current.addEventListener('canplay', () => {
			// Clear the timeout since source can play
			if (sourceLoadTimeoutRef.current) {
				clearTimeout(sourceLoadTimeoutRef.current);
				sourceLoadTimeoutRef.current = null;
			}
			
			if (videoElementRef.current) {
				videoElementRef.current.muted = false;
				videoElementRef.current.volume = currentVolume;
			}
			setPlayerState(prev => ({ ...prev, isSwitchingSource: false }));
		}, { once: true });
	}, [sources, tryNextSource]);

	// Function to change HLS audio track
	const changeHlsAudioTrack = useCallback((trackId: number) => {
		if (!hlsInstanceRef.current || hlsAudioTracks.length === 0) {
			console.warn('Cannot change audio track: HLS not active or no tracks available');
			return;
		}

		console.log(`Switching HLS audio track to: ${trackId}`);
		hlsInstanceRef.current.audioTrack = trackId;
		setCurrentHlsAudioTrack(trackId);
	}, [hlsAudioTracks]);

	// Setup player controls hook
	const controls = usePlayerControls(videoElementRef, playerState, setPlayerState as any);

	// Initialize video source when video element is ready and sources are loaded
	useEffect(() => {
		if (videoElementRef.current && sources.length > 0 && playerState.quality && !currentSource) {
			changeQuality(playerState.quality).catch(error => {
				console.error('Error initializing video quality:', error);
			});
		}
	}, [videoElementRef.current, sources, playerState.quality, currentSource]);

	// Setup video element
	useEffect(() => {
		if (!videoElementRef.current) return;

		const videoElement = videoElementRef.current;
		videoElement.volume = playerSettings.volume ?? 1;
		videoElement.playbackRate = playerSettings.playbackRate;
		videoElement.muted = false;
		videoElement.preload = 'auto';
		videoElement.playsInline = true;

		const handlePlay = () => {
			setPlayerState(prev => ({ ...prev, isPlaying: true }));
			if (watchPartyRoomId && watchPartyCanSkip) {
				syncPlaybackState();
			} else if (watchPartyRoomId && !watchPartyCanSkip && videoElementRef.current) {
				watchPartyGuestPausedRef.current = false;
				const { currentTime } = watchPartyLastHostStateRef.current;
				if (Math.abs(videoElementRef.current.currentTime - currentTime) > 0.5) {
					videoElementRef.current.currentTime = currentTime;
				}
			}
		};

		const handlePause = () => {
			setPlayerState(prev => ({ ...prev, isPlaying: false }));
			if (watchPartyRoomId && watchPartyCanSkip) {
				syncPlaybackState();
			} else if (watchPartyRoomId && !watchPartyCanSkip && !watchPartyApplyingHostStateRef.current) {
				watchPartyGuestPausedRef.current = true;
			}
		};

		let autoNextTriggered = false;
		
		const handleTimeUpdate = () => {
			if (videoElement) {
				const playing = !videoElement.paused;
				setPlayerState(prev => ({
					...prev,
					currentTime: videoElement.currentTime,
					duration: videoElement.duration,
					...(prev.isPlaying !== playing ? { isPlaying: playing } : {})
				}));
				
				const skipCredits = playerSettings.skipEndCredits !== false;
				const triggerThreshold = skipCredits ? videoElement.duration * 0.99 : videoElement.duration - 0.5;
				if (videoElement.duration > 0 && 
				    videoElement.currentTime >= triggerThreshold && 
				    !autoNextTriggered &&
				    season !== undefined && 
				    episode !== undefined && 
				    tmdbId &&
				    playerSettings.autoNext !== false) {
					autoNextTriggered = true;
					void goToNextEpisode();
					return;
				}
				
				const resetThreshold = skipCredits ? videoElement.duration * 0.98 : videoElement.duration - 2;
				if (videoElement.currentTime < resetThreshold) {
					autoNextTriggered = false;
				}
				
				const currentTime = Math.floor(videoElement.currentTime);
				if (currentTime !== lastProgressSave && currentTime > 0 && currentTime % 5 === 0) {
					const meta: MediaMeta | undefined = mediaDetails ? {
						title: 'title' in mediaDetails ? mediaDetails.title : undefined,
						name: 'name' in mediaDetails ? mediaDetails.name : undefined,
						poster_path: mediaDetails.poster_path,
						backdrop_path: mediaDetails.backdrop_path,
						release_date: 'release_date' in mediaDetails ? mediaDetails.release_date : undefined,
						first_air_date: 'first_air_date' in mediaDetails ? mediaDetails.first_air_date : undefined,
						vote_average: mediaDetails.vote_average,
					} : undefined;
					saveProgress(tmdbId, videoElement.currentTime, videoElement.duration, season, episode, meta);
					setLastProgressSave(currentTime);

					// Sync to backend every 30 seconds (every 6th 5-second tick)
					if (currentTime % 30 === 0) {
						saveProgressToBackend({
							tmdbId,
							type: season !== undefined ? 'tv' : 'movie',
							season,
							episode,
							progress: videoElement.currentTime,
							duration: videoElement.duration,
							title: meta?.title ?? meta?.name,
							posterPath: meta?.poster_path,
							backdropPath: meta?.backdrop_path,
							voteAverage: meta?.vote_average,
						});
					}
				}
			}
		};

		const handleProgress = () => {
			if (videoElement && videoElement.buffered.length > 0) {
				const bufferedEnd = videoElement.buffered.end(videoElement.buffered.length - 1);
				setPlayerState(prev => ({ ...prev, buffered: bufferedEnd }));
			}
		};

		const handleVolumeChange = () => {
			if (videoElement) {
				const newVolume = videoElement.volume;
				setPlayerState(prev => ({ ...prev, volume: newVolume }));
				setPlayerSettings(prev => {
					const next = { ...prev, volume: newVolume };
					saveSettings(next as Record<string, any>);
					return next;
				});
			}
		};

		const handleWaiting = () => {
			setPlayerState(prev => ({ ...prev, loading: true }));
		};

		const handleCanPlay = () => {
			setPlayerState(prev => ({ ...prev, loading: false }));
			if (!playerState.isPlaying && videoElement && videoElement.readyState >= 2) {
				videoElement.play().catch(() => {});
			}
		};

		const handleError = () => {
			if (!videoElement) return;
			const err = videoElement.error;
			console.log(`[handleError] fired — isResetting=${isResettingVideoRef.current}, code=${err?.code}, msg="${err?.message}", src="${videoElement.src}"`);
			if (isResettingVideoRef.current) {
				console.log(`[handleError] suppressed (isResetting=true)`);
				return;
			}
			
			const error = err;
			let errorMessage = 'Failed to load video';
			
			if (error) {
				switch (error.code) {
					case error.MEDIA_ERR_ABORTED:
						errorMessage = 'Video loading aborted';
						break;
					case error.MEDIA_ERR_NETWORK:
						errorMessage = 'Network error while loading video';
						break;
					case error.MEDIA_ERR_DECODE:
						errorMessage = 'Error decoding video';
						break;
					case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
						errorMessage = 'Video format not supported';
						break;
					default:
						errorMessage = `Video error (code: ${error.code})`;
				}
				
				console.error('Video error:', {
					code: error.code,
					message: error.message,
					src: videoElement.src,
					currentSource: currentSource
				});
			}
			
			if (hlsInstanceRef.current && hlsInstanceRef.current.media) {
				console.log('Attempting HLS recovery...');
				hlsInstanceRef.current.recoverMediaError();
				return;
			}

			if (
				!attemptedFemboxHlsFallbackRef.current &&
				currentSource &&
				currentSource.name?.startsWith('Fembox') &&
				currentSource.type !== 'hls'
			) {
				console.warn('Fembox MP4 failed, attempting automatic fallback to Fembox HLS...');
				attemptedFemboxHlsFallbackRef.current = true;
				void handleSelectServer('fembox', 'HLS');
				return;
			}

			if (
				error &&
				(error.code === error.MEDIA_ERR_SRC_NOT_SUPPORTED ||
					error.code === error.MEDIA_ERR_DECODE ||
					error.code === error.MEDIA_ERR_NETWORK) &&
				sources.length > 1
			) {
				tryNextSource();
				return;
			}
			
			setPlayerState(prev => ({ ...prev, error: errorMessage, loading: false }));
		};

		const handleLoadedMetadata = () => {
			if (videoElement) {
				videoElement.muted = false;
				videoElement.volume = playerSettings.volume ?? 1;
				
				const audioTracks = (videoElement as any).audioTracks;
				if (audioTracks && audioTracks.length > 0) {
					for (let i = 0; i < audioTracks.length; i++) {
						audioTracks[i].enabled = true;
					}
				}
				
				// Prefer backend progress (more recent), fallback to localStorage
				const localProgress = getProgress(tmdbId, season, episode);
				fetchProgress(tmdbId, season !== undefined ? 'tv' : 'movie', season, episode).then(backendItem => {
					const backendProgress = backendItem?.progress ?? 0;
					const resumeAt = backendProgress > localProgress ? backendProgress : localProgress;
					if (resumeAt > 0 && videoElement && resumeAt < videoElement.duration) {
						videoElement.currentTime = resumeAt;
					}
					videoElement.play().catch(() => {});
				}).catch(() => {
					if (localProgress > 0 && localProgress < videoElement.duration) {
						videoElement.currentTime = localProgress;
					}
					videoElement.play().catch(() => {});
				});
			}
		};

		const handleEnded = () => {
			if (season !== undefined && episode !== undefined && tmdbId && !autoNextTriggered) {
				if (playerSettings.autoNext === false) return;
				autoNextTriggered = true;
				void goToNextEpisode();
			}
		};

		videoElement.addEventListener('play', handlePlay);
		videoElement.addEventListener('pause', handlePause);
		videoElement.addEventListener('timeupdate', handleTimeUpdate);
		videoElement.addEventListener('progress', handleProgress);
		videoElement.addEventListener('volumechange', handleVolumeChange);
		videoElement.addEventListener('waiting', handleWaiting);
		videoElement.addEventListener('canplay', handleCanPlay);
		videoElement.addEventListener('error', handleError);
		videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
		videoElement.addEventListener('ended', handleEnded);

		return () => {
			videoElement?.removeEventListener('play', handlePlay);
			videoElement?.removeEventListener('pause', handlePause);
			videoElement?.removeEventListener('timeupdate', handleTimeUpdate);
			videoElement?.removeEventListener('progress', handleProgress);
			videoElement?.removeEventListener('volumechange', handleVolumeChange);
			videoElement?.removeEventListener('waiting', handleWaiting);
			videoElement?.removeEventListener('canplay', handleCanPlay);
			videoElement?.removeEventListener('error', handleError);
			videoElement?.removeEventListener('loadedmetadata', handleLoadedMetadata);
			videoElement?.removeEventListener('ended', handleEnded);
		};
	}, [videoElementRef.current, playerSettings, playerState, sources, currentSource, watchPartyRoomId, watchPartyCanSkip, syncPlaybackState]);

	// Setup keyboard shortcuts
	const shortcuts = useMemo(() => ({
		togglePlayPause: () => controls?.togglePlayPause(),
		seekBackward: () => handleSeekRelative(-10),
		seekForward: () => handleSeekRelative(10),
		increaseVolume: () => adjustVolume(0.05),
		decreaseVolume: () => adjustVolume(-0.05),
		toggleMute: () => {
			const prev = playerState.volume;
			controls?.toggleMute();
			setTimeout(() => {
				showVolumeOverlay((playerState.volume ?? 0) - prev);
			}, 0);
		},
		toggleFullscreen: () => controls?.toggleFullscreen(),
		toggleSettings: () => {
			setPlayerState(prev => ({ ...prev, isSettingsOpen: !prev.isSettingsOpen }));
		},
		toggleHelp: () => {
			setShortcutsMenuVisible(prev => !prev);
			controls?.showControls();
		}
	}), [controls, playerState.volume]);

	useKeyboardShortcuts(shortcuts, playerState);

	useQualityAutoSwitch(videoElementRef.current, sources, playerState.quality, async (quality: string) => {
		await changeQuality(quality);
	}, () => playerSettings.autoQuality);

	const srtToVtt = (srtText: string): string => {
		let vtt = 'WEBVTT\n\n';
		const normalized = srtText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
		const blocks = normalized.trim().split(/\n\s*\n/).filter(block => block.trim().length > 0);

		for (const block of blocks) {
			const lines = block.trim().split('\n').filter(line => line.trim().length > 0);
			if (lines.length < 3) continue;

			const timeLine = lines[1];
			const vttTime = timeLine.replace(/,/g, '.').trim();
			const text = lines.slice(2).join('\n').trim();

			if (vttTime && text) {
				vtt += `${vttTime}\n${text}\n\n`;
			}
		}

		return vtt.trim() + '\n';
	};

	const offsetVttTimestamp = (timestamp: string, offsetSeconds: number): string => {
		const normalized = timestamp.replace(',', '.');
		const [hStr, mStr, sMs] = normalized.split(':');
		const [sStr, msStr] = sMs.split('.');
		const ms = msStr ? parseInt(msStr.padStart(3, '0'), 10) / 1000 : 0;
		let totalSeconds =
			parseInt(hStr, 10) * 3600 +
			parseInt(mStr, 10) * 60 +
			parseInt(sStr, 10) +
			ms +
			offsetSeconds;

		if (totalSeconds < 0) totalSeconds = 0;

		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = Math.floor(totalSeconds % 60);
		const millis = Math.round((totalSeconds - Math.floor(totalSeconds)) * 1000);

		const pad = (n: number, width: number) => n.toString().padStart(width, '0');
		return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)}.${pad(millis, 3)}`;
	};

	const applySubtitleDelayToVtt = (vtt: string, offsetSeconds: number): string => {
		if (!offsetSeconds) return vtt;
		const lines = vtt.split('\n');
		const timestampRegex =
			/^(\d{1,2}:\d{2}:\d{2}[.,]\d{2,3})\s+-->\s+(\d{1,2}:\d{2}:\d{2}[.,]\d{2,3})(.*)$/;

		const normalizeTs = (ts: string) => ts.replace(',', '.');
		const adjusted = lines.map((line) => {
			const match = line.match(timestampRegex);
			if (!match) return line;
			const [, start, end, rest] = match;
			const normStart = normalizeTs(start);
			const normEnd = normalizeTs(end);
			const newStart = offsetVttTimestamp(normStart, offsetSeconds);
			const newEnd = offsetVttTimestamp(normEnd, offsetSeconds);
			return `${newStart} --> ${newEnd}${rest}`;
		});

		return adjusted.join('\n');
	};

	const handleSubtitleChange = async (track: SubtitleTrack | null, delayOverride?: number) => {
		setPlayerSettings(prev => ({ ...prev, subtitle: track }));
		if (videoElementRef.current) {
			const existingTracks = videoElementRef.current.querySelectorAll('track');
			existingTracks.forEach((t: HTMLTrackElement) => {
				if (t.src && t.src.startsWith('blob:')) {
					URL.revokeObjectURL(t.src);
				}
				t.remove();
			});

			if (videoElementRef.current.textTracks) {
				for (let i = 0; i < videoElementRef.current.textTracks.length; i++) {
					videoElementRef.current.textTracks[i].mode = 'disabled';
				}
			}

			if (track && track.url) {
				try {
					const needsConversion =
						(track.format?.toLowerCase() === 'srt') || track.url.toLowerCase().includes('.srt');
					const delaySeconds = delayOverride !== undefined ? delayOverride : (playerSettings.subtitleDelay || 0);
					let subtitleSource = track.url;

					if (needsConversion || delaySeconds !== 0) {
						const response = await fetch(track.url);
						if (!response.ok) throw new Error('Failed to fetch subtitle');
						const buffer = await response.arrayBuffer();
						const encoding = (track.encoding || 'UTF-8').toUpperCase().replace(/[^A-Z0-9]/g, '');
						const decoder = new TextDecoder(
							encoding === 'UTF8' || encoding === 'UTF' ? 'utf-8' :
							encoding === 'CP1252' ? 'windows-1252' :
							encoding === 'CP1250' ? 'windows-1250' :
							encoding === 'CP1251' ? 'windows-1251' :
							encoding === 'CP1255' ? 'windows-1255' :
							encoding === 'ASCII' ? 'us-ascii' :
							'utf-8'
						);
						let subtitleText = decoder.decode(buffer);
						if (needsConversion) {
							subtitleText = srtToVtt(subtitleText);
						}
						if (delaySeconds !== 0) {
							subtitleText = applySubtitleDelayToVtt(subtitleText, delaySeconds);
						}
						const blob = new Blob([subtitleText], { type: 'text/vtt' });
						subtitleSource = URL.createObjectURL(blob);
					}

					const trackElement = document.createElement('track');
					trackElement.kind = 'subtitles';
					trackElement.label = track.label || track.display || 'Subtitle';
					trackElement.srclang = track.srclang || track.language || 'en';
					trackElement.src = subtitleSource;
					trackElement.default = false;
					videoElementRef.current.appendChild(trackElement);

					const enableTrack = () => {
						if (!videoElementRef.current) return;
						for (let i = 0; i < videoElementRef.current.textTracks.length; i++) {
							videoElementRef.current.textTracks[i].mode = 'disabled';
						}
						let textTrack = Array.from(videoElementRef.current.textTracks).find(
							(t) => t.label === track.label && t.language === (track.srclang || track.language || 'en')
						);
						
						if (!textTrack) {
							textTrack = Array.from(videoElementRef.current.textTracks).find(
								(t) => t.language === (track.srclang || track.language || 'en')
							);
						}
						
						if (!textTrack && videoElementRef.current.textTracks.length > 0) {
							textTrack = videoElementRef.current.textTracks[videoElementRef.current.textTracks.length - 1];
						}
						
						if (textTrack) {
							textTrack.mode = 'hidden';
						}
					};

					trackElement.addEventListener('load', () => {
						enableTrack();
					});
					
					trackElement.addEventListener('error', (e) => {
						console.error('Subtitle track error:', e);
					});
					
					setTimeout(enableTrack, 50);
					setTimeout(enableTrack, 200);
					setTimeout(enableTrack, 500);
					
					if (videoElementRef.current.readyState >= 1) {
						setTimeout(enableTrack, 300);
					} else {
						videoElementRef.current.addEventListener('loadedmetadata', () => {
							setTimeout(enableTrack, 100);
						}, { once: true });
					}
				} catch (error) {
					console.error('Error loading subtitle:', error);
				}
			}
		}
		saveSettings(playerSettings);
	};

	const handleSubtitleToggle = (enabled: boolean) => {
		if (enabled && subtitleTracks.length > 0) {
			const englishTrack = subtitleTracks.find(t => t.language === 'en') || subtitleTracks[0];
			handleSubtitleChange(englishTrack);
		} else {
			handleSubtitleChange(null);
		}
	};

	const handleSubtitleSettingsChange = (key: keyof PlayerSettings | string, value: unknown) => {
		setPlayerSettings(prev => {
			const next = { ...prev, [key]: value };

			if (key === 'subtitleBackground' || key === 'subtitleBgOpacity' || key === 'subtitleBgEnabled') {
				const enabled = (next as any).subtitleBgEnabled !== false;
				if (enabled && next.subtitleBackground) {
					const bgColor = (next.subtitleBackground as string) || '#000000';
					const opacity = (next as any).subtitleBgOpacity ?? 0.7;
					const r = parseInt(bgColor.slice(1, 3), 16);
					const g = parseInt(bgColor.slice(3, 5), 16);
					const b = parseInt(bgColor.slice(5, 7), 16);
					next.subtitleBgRgba = `rgba(${r}, ${g}, ${b}, ${opacity})`;
				} else {
					next.subtitleBgRgba = 'transparent';
				}
			}

			saveSettings(next as Record<string, any>);
			const payload = {
				subtitleSize: (next as any).subtitleSize,
				subtitleColor: (next as any).subtitleColor,
				subtitleBackground: (next as any).subtitleBackground,
				subtitleBgOpacity: (next as any).subtitleBgOpacity,
				subtitleShadow: (next as any).subtitleShadow,
				subtitleBgEnabled: (next as any).subtitleBgEnabled,
				subtitleAutoDetect: (next as any).subtitleAutoDetect,
				subtitleOpacity: (next as any).subtitleOpacity,
				subtitleFontFamily: (next as any).subtitleFontFamily,
				subtitleFontWeight: (next as any).subtitleFontWeight,
				subtitleFontStyle: (next as any).subtitleFontStyle,
				subtitleTextDecoration: (next as any).subtitleTextDecoration,
				subtitleDelay: (next as any).subtitleDelay,
				fixSubtitles: (next as any).fixSubtitles,
				fixCapitalization: (next as any).fixCapitalization,
				volume: (next as any).volume,
				playbackRate: (next as any).playbackRate,
				autoQuality: (next as any).autoQuality,
			};
			if (savePlayerSettingsDebounceRef.current) clearTimeout(savePlayerSettingsDebounceRef.current);
			savePlayerSettingsDebounceRef.current = setTimeout(() => {
				savePlayerSettingsToBackend(payload);
				savePlayerSettingsDebounceRef.current = null;
			}, 400);

			return next;
		});

		if (key === 'subtitleDelay' && playerSettings.subtitle) {
			handleSubtitleChange(playerSettings.subtitle, value as number);
		}
	};


	const handleContextMenu = (event: React.MouseEvent) => {
		event.preventDefault();
		return false;
	};

	const handleMouseMove = () => {
		controls?.showControls();
	};

	const showSkipOverlay = (seconds: number) => {
		if (seconds === 0) return;
		const direction = seconds > 0 ? 'forward' : 'backward';
		setSkipOverlay(prev => ({
			amount: direction === prev.direction ? prev.amount + Math.abs(seconds) : Math.abs(seconds),
			direction,
			visible: true
		}));
		if (skipOverlayTimeoutRef.current) {
			clearTimeout(skipOverlayTimeoutRef.current);
		}
		skipOverlayTimeoutRef.current = setTimeout(() => {
			setSkipOverlay(prev => ({ ...prev, visible: false, amount: 0 }));
		}, 600);
	};

	const showVolumeOverlay = (delta: number) => {
		const deltaPercent = Math.round(delta * 100);
		if (deltaPercent === 0) return;
		setVolumeOverlay({ delta: deltaPercent, visible: true });
		if (volumeOverlayTimeoutRef.current) {
			clearTimeout(volumeOverlayTimeoutRef.current);
		}
		volumeOverlayTimeoutRef.current = setTimeout(() => {
			setVolumeOverlay(prev => ({ ...prev, visible: false, delta: 0 }));
		}, 600);
	};

	const handleSeekRelative = (seconds: number) => {
		if (!controls) return;
		controls.seekRelative(seconds);
		showSkipOverlay(seconds);
		if (watchPartyRoomId && watchPartyCanSkip) {
			setTimeout(() => syncPlaybackState(), 100);
		}
	};

	const handleSeekTo = (time: number) => {
		controls?.seek(time);
		if (watchPartyRoomId && watchPartyCanSkip) {
			setTimeout(() => syncPlaybackState(), 100);
		}
	};

	const adjustVolume = (delta: number) => {
		if (!controls) return;
		const prev = playerState.volume ?? 0;
		const next = Math.min(1, Math.max(0, prev + delta));
		controls.setVolume(next);
		showVolumeOverlay(next - prev);
	};

	const applyVolume = (volume: number) => {
		if (!controls) return;
		const prev = playerState.volume ?? 0;
		const next = Math.min(1, Math.max(0, volume));
		controls.setVolume(next);
		showVolumeOverlay(next - prev);
	};

	const handlePlayPause = () => {
		controls?.togglePlayPause();
		if (watchPartyRoomId && watchPartyCanSkip) {
			setTimeout(() => syncPlaybackState(), 100);
		}
	};

	const goToNextEpisode = async () => {
		if (tmdbId && season !== undefined && episode !== undefined) {
			const currentSeason = season;
			const currentEpisode = episode;

			let lastEpisodeInSeason = lastEpisodesBySeason[currentSeason];

			if (!lastEpisodeInSeason || currentEpisode > lastEpisodeInSeason) {
				try {
					const seasonData = await tmdbApi.getTVSeasonEpisodes(tmdbId, currentSeason);
					const seasonEpisodes = (seasonData as any).episodes || [];
					if (seasonEpisodes.length > 0) {
						lastEpisodeInSeason = seasonEpisodes.reduce(
							(max: number, ep: any) => Math.max(max, ep.episode_number || 0),
							0
						);
						setLastEpisodesBySeason(prev => ({
							...prev,
							[currentSeason]: lastEpisodeInSeason
						}));
					}
				} catch (e) {
					console.error('Error fetching season episodes for auto-next:', e);
					const fallbackNext = (currentEpisode ?? 0) + 1;
					navigate(`/tv/watch/${tmdbId}/${currentSeason}/${fallbackNext}`);
					return;
				}
			}

			let nextSeason = currentSeason;
			let nextEpisode = currentEpisode + 1;

			if (lastEpisodeInSeason && currentEpisode >= lastEpisodeInSeason) {
				const totalSeasons =
					mediaDetails && 'number_of_seasons' in mediaDetails
						? (mediaDetails as any).number_of_seasons
						: null;

				if (totalSeasons && currentSeason < totalSeasons) {
					nextSeason = currentSeason + 1;
					nextEpisode = 1;
				} else {
					return;
				}
			}

			navigate(`/tv/watch/${tmdbId}/${nextSeason}/${nextEpisode}`);
		}
	};

	const handleSkipIntro = () => {
		if (introSegments.intro && controls) {
			controls.seek(introSegments.intro.end);
		}
	};

	const handleSkipRecap = () => {
		if (introSegments.recap && controls) {
			controls.seek(introSegments.recap.end);
		}
	};

	const handleSkipCredits = () => {
		if (introSegments.credits && controls) {
			const endTime = introSegments.credits.end === -1 ? playerState.duration : introSegments.credits.end;
			controls.seek(endTime);
		}
	};

	const skipIntroVisible = useMemo(() => {
		if (!introSegments?.intro) return false;
		const current = playerState.currentTime;
		return current >= introSegments.intro.start && current < introSegments.intro.end;
	}, [introSegments, playerState.currentTime]);

	const skipRecapVisible = useMemo(() => {
		if (!introSegments?.recap) return false;
		const current = playerState.currentTime;
		return current >= introSegments.recap.start && current < introSegments.recap.end;
	}, [introSegments, playerState.currentTime]);

	const skipCreditsVisible = useMemo(() => {
		if (!introSegments?.credits) return false;
		const current = playerState.currentTime;
		const endTime = introSegments.credits.end === -1 ? playerState.duration : introSegments.credits.end;
		return current >= introSegments.credits.start && current < endTime;
	}, [introSegments, playerState.currentTime, playerState.duration]);

	const handleExit = () => {
		if (document.pictureInPictureElement) {
			document.exitPictureInPicture().catch(() => {});
		}
		navigate('/', { replace: true });
	};

	useEffect(() => {
		return () => {
			if (skipOverlayTimeoutRef.current) clearTimeout(skipOverlayTimeoutRef.current);
			if (volumeOverlayTimeoutRef.current) clearTimeout(volumeOverlayTimeoutRef.current);
			if (serverCheckClearTimeoutRef.current) clearTimeout(serverCheckClearTimeoutRef.current);
			if (sourceLoadTimeoutRef.current) clearTimeout(sourceLoadTimeoutRef.current);
			if (hlsInstanceRef.current) {
				hlsInstanceRef.current.destroy();
				hlsInstanceRef.current = null;
			}

			// Final progress flush to backend on unmount
			if (videoElementRef.current && videoElementRef.current.currentTime > 0) {
				const vid = videoElementRef.current;
				saveProgressToBackend({
					tmdbId,
					type: season !== undefined ? 'tv' : 'movie',
					season,
					episode,
					progress: vid.currentTime,
					duration: vid.duration || 0,
				});
			}
		};
	}, []);

	useEffect(() => {
		if (controlsBarRef.current) {
			const rect = controlsBarRef.current.getBoundingClientRect();
			const vh = window.innerHeight;
			const gap = 32;
			const offset = vh - rect.top + gap;
			setSubtitleBaseOffset(Math.max(80, offset));
		}
	}, [controlsBarRef.current]);

	const fixSubtitleText = (text: string): string => {
		return text.replace(/<[^>]*>/g, '');
	};

	const fixCapitalization = (text: string): string => {
		const sentences = text.split(/([.!?]\s*)/);
		let result = '';
		let capitalizeNext = true;
		
		for (let i = 0; i < sentences.length; i++) {
			const part = sentences[i];
			if (!part) continue;
			
			if (part.match(/^[.!?]\s*$/)) {
				result += part;
				capitalizeNext = true;
			} else {
				if (capitalizeNext) {
					result += part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
					capitalizeNext = false;
				} else {
					result += part;
				}
			}
		}
		
		return result.trim();
	};

	useEffect(() => {
		if (subtitleTracks.length > 0 && playerSettings.subtitle && videoElementRef.current) {
			const savedTrack = subtitleTracks.find(t => t.id === playerSettings.subtitle?.id);
			if (savedTrack && !videoElementRef.current.querySelector(`track[src*="${savedTrack.url}"]`)) {
				handleSubtitleChange(savedTrack);
			}
		}
	}, [subtitleTracks, playerSettings.subtitle]);

	useEffect(() => {
		if (!videoElementRef.current || !playerSettings.subtitle) {
			setCurrentSubtitleText('');
			return;
		}
		
		const updateSubtitle = () => {
			if (!videoElementRef.current) {
				setCurrentSubtitleText('');
				return;
			}
			
			const activeTrack =
				Array.from(videoElementRef.current.textTracks).find(
					(track) => track.kind === 'subtitles' && track.mode === 'hidden'
				) ||
				Array.from(videoElementRef.current.textTracks).find((track) => track.kind === 'subtitles');
			
			if (activeTrack && activeTrack.activeCues && activeTrack.activeCues.length > 0) {
				const cues = Array.from(activeTrack.activeCues) as VTTCue[];
				let combinedText = cues.map(cue => cue.text).join('\n');
				
				if (playerSettings.fixSubtitles) {
					combinedText = fixSubtitleText(combinedText);
				}
				if (playerSettings.fixCapitalization) {
					combinedText = fixCapitalization(combinedText);
				}
				
				setCurrentSubtitleText(combinedText);
			} else {
				setCurrentSubtitleText('');
			}
		};

		const videoEl = videoElementRef.current;
		const tracks = Array.from(videoEl.textTracks);
		tracks.forEach(track => {
			track.addEventListener('cuechange', updateSubtitle);
		});

		const seekingHandler = () => setCurrentSubtitleText('');
		videoEl.addEventListener('timeupdate', updateSubtitle);
		videoEl.addEventListener('seeked', updateSubtitle);
		videoEl.addEventListener('playing', updateSubtitle);
		videoEl.addEventListener('seeking', seekingHandler);

		updateSubtitle();

		let rafId: number;
		const rafLoop = () => {
			updateSubtitle();
			rafId = requestAnimationFrame(rafLoop);
		};
		rafId = requestAnimationFrame(rafLoop);

		return () => {
			tracks.forEach(track => {
				track.removeEventListener('cuechange', updateSubtitle);
			});
			videoEl.removeEventListener('timeupdate', updateSubtitle);
			videoEl.removeEventListener('seeked', updateSubtitle);
			videoEl.removeEventListener('playing', updateSubtitle);
			videoEl.removeEventListener('seeking', seekingHandler);
			cancelAnimationFrame(rafId);
		};
	}, [videoElementRef.current, playerSettings.subtitle, playerSettings.fixSubtitles, playerSettings.fixCapitalization]);

	const overlayBottom = useMemo(() => {
		if (currentSubtitleText && playerSettings.subtitle) {
			return isEpisodesMenuOpen ? 580 : playerState.isControlsVisible ? 156 : 84;
		}
		return playerState.isControlsVisible ? 96 : 24;
	}, [currentSubtitleText, playerSettings.subtitle, isEpisodesMenuOpen, playerState.isControlsVisible]);

	const subtitleBottom = useMemo(() => {
		return isEpisodesMenuOpen 
			? 520 
			: playerState.isControlsVisible 
				? 96
				: 24;
	}, [isEpisodesMenuOpen, playerState.isControlsVisible]);

	if (isLocked === true) {
		return (
			<div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center gap-6 px-6">
				<div className="flex items-center justify-center w-20 h-20 rounded-full bg-amber-500/20 border border-amber-500/40">
					<Icon icon="tabler:lock" className="w-10 h-10 text-amber-400" />
				</div>
				<h2 className="text-xl md:text-2xl font-semibold text-white">Content Locked</h2>
				{lockReason && <p className="text-white/70 text-center max-w-md">{lockReason}</p>}
				<button
					onClick={() => navigate(-1)}
					className="px-6 py-3 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white font-medium transition"
				>
					Go back
				</button>
			</div>
		);
	}

	return (
		<div
			className="fixed inset-0 bg-black z-50 flex items-center justify-center"
			role="application"
			onContextMenu={handleContextMenu}
			onMouseMove={handleMouseMove}
			style={{ "--player-accent": currentTheme.accentColor } as React.CSSProperties}
		>
				{/* Mounts widget here if user arrived directly without visiting Home */}
				<DelayedPasmellsTurnstile />
				<BalooPowPrewarm />
				{mediaTitle && (
				<div className={`absolute top-0 left-0 right-0 z-40 px-4 pt-4 pb-2 transition-opacity duration-300 ${playerState.isControlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
					<div className="flex items-center justify-between gap-4">
						<button
							onClick={handleExit}
							className="flex items-center justify-center w-10 h-10 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 hover:bg-black/80 hover:border-white/20 transition-all duration-200 pointer-events-auto"
							aria-label="Exit player"
						>
							<Icon icon="tabler:arrow-back-up-double" className="w-5 h-5 text-white" />
						</button>
						<div className="flex-1 flex items-center justify-center min-w-0 px-4">
							<div className="text-center min-w-0">
								<p className="text-white text-base font-semibold truncate max-w-md">
									{mediaTitle}
								</p>
						
								<p className="text-white/60 text-xs mt-0.5 font-family: 'Lato', Arial, sans-serif;">
									{mediaYear && mediaYear}
									{mediaYear && season !== undefined && ' ・ '}
									{season !== undefined && `S${season} ・ E${episode}`}
								</p>
							</div>
						</div>
						<button
							onClick={() => {
								if (videoElementRef.current) {
									if ('remote' in videoElementRef.current) {
										(videoElementRef.current as any).remote.prompt().catch((err: any) => {
											console.log('Cast prompt cancelled or unavailable:', err);
										});
									} else {
										console.log('Remote playback not supported in this browser');
									}
								}
							}}
							className="sm:hidden flex items-center justify-center w-10 h-10 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 hover:bg-black/80 hover:border-white/20 transition-all duration-200 pointer-events-auto"
							aria-label="Cast to device"
						>
							<Icon icon="solar:screencast-2-bold" className="w-5 h-5 text-white" />
						</button>
						<div className="hidden sm:block w-10"></div>
					</div>
				</div>
			)}

			{playerState.toast && (
				<div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg bg-black/80 border border-white/20 backdrop-blur-md text-white text-sm max-w-[90vw]">
					{playerState.toast}
				</div>
			)}

			{watchPartyOverlayVisible && watchPartyRoomId && watchPartyParticipants.length > 0 && (
				<div className="absolute top-4 left-4 z-40 rounded-lg bg-black/70 border border-white/10 backdrop-blur-md px-3 py-2 max-w-[180px]">
					<div className="text-white/60 text-xs font-medium mb-1.5">Watch Party</div>
					<div className="space-y-1">
						{watchPartyParticipants.slice(0, 5).map((p) => (
							<div key={p.userId} className="flex items-center gap-2">
								{p.avatar ? (
									<img src={p.avatar} alt="" className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
								) : (
									<div className="w-5 h-5 rounded-full bg-white/10 flex-shrink-0" />
								)}
								<span className="text-white text-xs truncate">{p.displayName}</span>
								{p.isHost && <span className="text-[var(--player-accent)] text-[10px]">Host</span>}
							</div>
						))}
						{watchPartyParticipants.length > 5 && (
							<div className="text-white/50 text-xs">+{watchPartyParticipants.length - 5} more</div>
						)}
					</div>
				</div>
			)}

			{shortcutsMenuVisible && (
				<div className="absolute top-16 right-4 z-40 w-64 rounded-2xl bg-black/70 border border-white/10 backdrop-blur-md shadow-2xl text-white text-sm">
					<div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
						<span className="font-semibold">Keyboard shortcuts</span>
						<span className="text-white/50 text-xs">` to toggle</span>
					</div>
					<div className="p-4 space-y-2">
						<div className="flex justify-between text-white/90"><span>Play / Pause</span><span className="text-white/60">Space / K</span></div>
						<div className="flex justify-between text-white/90"><span>Seek</span><span className="text-white/60">← / →</span></div>
						<div className="flex justify-between text-white/90"><span>Volume</span><span className="text-white/60">↑ / ↓</span></div>
						<div className="flex justify-between text-white/90"><span>Mute</span><span className="text-white/60">M</span></div>
						<div className="flex justify-between text-white/90"><span>Fullscreen</span><span className="text-white/60">F</span></div>
						<div className="flex justify-between text-white/90"><span>Settings</span><span className="text-white/60">S</span></div>
					</div>
				</div>
			)}

			{playerState.loading && !videoElementRef.current ? (
				<div className="relative flex items-center justify-center h-full w-full bg-black">
					{mediaBackdropUrl && (
						<div className="absolute inset-0 opacity-20">
							<img
								src={mediaBackdropUrl}
								alt=""
								className="w-full h-full object-cover blur-3xl scale-110"
								decoding="async"
								loading="eager"
							/>
						</div>
					)}
					
					<SourceCheckList serverChecks={serverChecks} serverConfigs={serverConfigs} />
				</div>
			) : playerState.error ? (
				<div className="relative flex items-center justify-center h-full w-full bg-black">
					{mediaBackdropUrl && (
						<div className="absolute inset-0 opacity-10">
							<img
								src={mediaBackdropUrl}
								alt=""
								className="w-full h-full object-cover blur-3xl scale-110"
								decoding="async"
								loading="eager"
							/>
						</div>
					)}
					
					<div className="relative w-full max-w-sm px-4">
						<div className="backdrop-blur-md bg-black/70 border border-white/10 rounded-xl p-6 shadow-xl">
							<div className="flex flex-col items-center text-center space-y-4">
								<div className="w-12 h-12 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
									<Icon icon="solar:danger-circle-bold" className="w-6 h-6 text-white/60" />
								</div>
								<div className="space-y-1.5">
									<h2 className="text-white text-lg font-semibold">Failed to load video</h2>
									<p className="text-white/60 text-xs leading-relaxed max-w-xs mx-auto">
										{playerState.error}
									</p>
								</div>
								<div className="flex gap-2 w-full mt-2">
									<button
										onClick={() => {
											setPlayerState(prev => ({ ...prev, error: null }));
											navigate('/', { replace: true });
										}}
										className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white text-sm font-medium transition-all"
									>
										Back to Home
									</button>
									<button
										onClick={() => {
											setPlayerState(prev => ({ ...prev, error: null }));
											loadMediaSources();
										}}
										className="flex-1 px-4 py-2.5 bg-[var(--player-accent)] hover:bg-[var(--player-accent)]/80 border border-[var(--player-accent)]/30 rounded-lg text-white text-sm font-medium transition-all"
									>
										Try again
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>
			) : (
				<>
					<div
						className="absolute inset-0 z-10 cursor-pointer flex items-center justify-center"
						onClick={handlePlayPause}
						aria-label="Click to play or pause"
					>
					<video
						ref={videoElementRef}
						className="w-full h-full object-contain"
						controls={false}
						autoPlay
						playsInline
						muted={false}
						style={{
							'--subtitle-size': `${playerSettings.subtitleSize}px`,
							'--subtitle-color': playerSettings.subtitleColor,
							'--subtitle-bg': playerSettings.subtitleBgRgba || 'rgba(0, 0, 0, 0.7)',
							'--subtitle-position': `${playerSettings.subtitlePosition}px`,
							'--subtitle-base-offset': `${subtitleBaseOffset}px`,
							'--subtitle-font-family': playerSettings.subtitleFontFamily || 'Arial',
							'--subtitle-font-weight': playerSettings.subtitleFontWeight || 'normal',
							'--subtitle-font-style': playerSettings.subtitleFontStyle || 'normal',
							'--subtitle-text-decoration': playerSettings.subtitleTextDecoration || 'none'
						} as React.CSSProperties}
					>
						Your browser does not support the video tag.
					</video>

					{playerState.isSwitchingSource && (
						<div className="absolute inset-0 flex items-center justify-center bg-black/50 z-30 pointer-events-none">
							<div className="relative w-10 h-10">
								<div className="absolute inset-0 rounded-full border-2 border-white/10"></div>
								<div className="absolute inset-0 rounded-full border-2 border-transparent border-t-white animate-spin"></div>
							</div>
						</div>
					)}

					<PauseScreen
						isVisible={!playerState.isPlaying && !playerState.loading && !playerState.isSwitchingSource && videoElementRef.current !== null}
						onPlay={handlePlayPause}
						mediaTitle={mediaTitle}
						currentTime={playerState.currentTime}
						duration={playerState.duration}
					/>
					</div>

					{controls && playerState.isPlaying && (
						<PlayerControls
							playerState={playerState}
							videoElement={videoElementRef.current}
							onPlayPause={handlePlayPause}
							onSeek={handleSeekTo}
							onSeekRelative={handleSeekRelative}
							onToggleFullscreen={() => controls?.toggleFullscreen()}
							onToggleSettings={() => {
								setPlayerState(prev => ({ ...prev, isSettingsOpen: !prev.isSettingsOpen }));
								if (!playerState.isSettingsOpen) {
									setIsEpisodesMenuOpen(false);
									setIsSubtitleMenuOpen(false);
								}
							}}
							onToggleCaptions={() => {
								if (playerSettings.subtitle) {
									handleSubtitleChange(null);
								} else if (subtitleTracks.length > 0) {
									const englishTrack = subtitleTracks.find(t => t.language === 'en') || subtitleTracks[0];
									handleSubtitleChange(englishTrack);
								}
							}}
							onOpenSubtitleMenu={() => {
								setIsSubtitleMenuOpen(prev => !prev);
								setPlayerState(prev => ({ ...prev, isSettingsOpen: false }));
								setIsEpisodesMenuOpen(false);
							}}
							isSubtitleMenuOpen={isSubtitleMenuOpen}
							hasSubtitles={!!playerSettings.subtitle}
							onVolumeChange={(volume: number) => applyVolume(volume)}
							onToggleMute={() => {
								const prev = playerState.volume;
								if (controls) {
									controls.toggleMute();
									setTimeout(() => {
										showVolumeOverlay((playerState.volume ?? 0) - prev);
									}, 0);
								}
							}}
							onSkipIntro={handleSkipIntro}
							onSkipRecap={handleSkipRecap}
							onSkipCredits={handleSkipCredits}
							onNextEpisode={goToNextEpisode}
							skipIntroVisible={skipIntroVisible}
							skipRecapVisible={skipRecapVisible}
							skipCreditsVisible={skipCreditsVisible}
							onToggleEpisodes={() => {
								setIsEpisodesMenuOpen(prev => !prev);
								if (!isEpisodesMenuOpen) {
									setPlayerState(prev => ({ ...prev, isSettingsOpen: false }));
								}
							}}
							isTVShow={season !== undefined && episode !== undefined}
							isEpisodesMenuOpen={isEpisodesMenuOpen}
							isSettingsOpen={playerState.isSettingsOpen}
							bindSettingsButton={settingsButtonRef}
							bindSubtitleButton={subtitleButtonRef}
							bindEpisodesButton={episodesButtonRef.current}
							bindControlsBar={controlsBarRef as React.MutableRefObject<HTMLDivElement | null>}
						/>
					)}

					<div 
						className="absolute left-1/2 -translate-x-1/2 z-35 pointer-events-none flex flex-col items-center gap-3 transition-all duration-200"
						style={{ bottom: `${overlayBottom}px` }}
					>
						{skipOverlay.visible && (
							<div className="px-6 py-2 rounded-full bg-black/60 border border-white/15 text-white text-lg font-semibold tracking-wide backdrop-blur-md">
								{skipOverlay.direction === 'forward' ? '+' : '-'}{skipOverlay.amount}s
							</div>
						)}

						{volumeOverlay.visible && (
							<div className="px-6 py-2 rounded-full bg-black/60 border border-white/15 text-white text-lg font-semibold tracking-wide backdrop-blur-md">
								{volumeOverlay.delta > 0 ? '+' : ''}{volumeOverlay.delta}% vol
							</div>
						)}
					</div>

				{currentSubtitleText && playerSettings.subtitle && !playerState.loading && (
					<div
						className="absolute left-1/2 -translate-x-1/2 pointer-events-none transition-all duration-200"
						style={{ bottom: `${subtitleBottom}px`, zIndex: isEpisodesMenuOpen ? 60 : 35 }}
					>
						<div 
							className="mb-1 rounded px-4 py-1 text-center leading-normal max-w-[85vw] mx-auto"
							style={{
								color: (playerSettings as any).subtitleColor || 'rgb(255, 255, 255)',
								fontSize: `${playerSettings.subtitleSize}px`,
								backgroundColor: (playerSettings as any).subtitleBgEnabled === false
									? 'transparent'
									: `rgba(0, 0, 0, ${playerSettings.subtitleBgOpacity ?? 0.48})`,
								backdropFilter: (playerSettings as any).subtitleBgEnabled === false ? 'none' : 'blur(16px)',
								fontWeight: (playerSettings as any).subtitleFontWeight || 'normal',
								fontStyle: (playerSettings as any).subtitleFontStyle || 'normal',
								fontFamily: (playerSettings as any).subtitleFontFamily && (playerSettings as any).subtitleFontFamily !== 'Default'
									? (playerSettings as any).subtitleFontFamily
									: "'SubFont', Arial, sans-serif",
								textShadow: (() => {
									const shadow = (playerSettings as any).subtitleShadow;
									if (shadow === 'drop') return '0 2px 8px rgba(0,0,0,0.95), 0 1px 3px rgba(0,0,0,0.8)';
									if (shadow === 'outline') return '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 0 2px 6px rgba(0,0,0,0.8)';
									if (shadow === 'none') return 'none';
									return '0 2px 4px rgba(0,0,0,0.5)'; // default soft shadow
								})(),
								opacity: (playerSettings as any).subtitleOpacity != null
									? (playerSettings as any).subtitleOpacity / 100
									: 1,
								whiteSpace: 'pre-line',
								wordWrap: 'break-word',
							}}
						>
							{currentSubtitleText}
						</div>
					</div>
				)}

					{!playerState.isPlaying && !playerState.loading && videoElementRef.current && playerState.duration > 0 && (
						<div
							className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
							style={{ bottom: `${currentSubtitleText && playerSettings.subtitle ? (isEpisodesMenuOpen ? 580 : 156) : (isEpisodesMenuOpen ? 520 : 96)}px`, zIndex: isEpisodesMenuOpen ? 60 : 35 }}
						>
							<div className="liquid-glass-pill flex items-center gap-3 px-5 py-2.5">
								<svg className="w-7 h-4 shrink-0" viewBox="0 0 24 8" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5">
									<rect x="1" y="1" width="22" height="6" rx="1.5" />
									<path d="M5 4h14" strokeWidth="1" stroke="rgba(255,255,255,0.4)" />
								</svg>
								<div className="h-3.5 w-px bg-white/20 shrink-0"></div>
								<div className="flex items-center gap-1.5">
									<kbd className="key-badge">SPACE</kbd>
									<span className="text-white/40 text-xs">or</span>
									<kbd className="key-badge">K</kbd>
									<span className="text-white/50 text-xs font-light tracking-wide">to play</span>
								</div>
							</div>
						</div>
					)}

					{season !== undefined && episode !== undefined && (
						<EpisodesMenu
							isOpen={isEpisodesMenuOpen}
							tmdbId={tmdbId}
							currentSeason={season}
							currentEpisode={episode}
							settingsButtonRef={episodesButtonRef.current}
							controlsBarRef={controlsBarRef.current}
							onClose={() => setIsEpisodesMenuOpen(false)}
							onSelectEpisode={(newSeason: number, newEpisode: number) => {
								navigate(`/tv/watch/${tmdbId}/${newSeason}/${newEpisode}`);
							}}
						/>
					)}

					{isSubtitleMenuOpen && (
					<SubtitleSelection
						isOpen={isSubtitleMenuOpen}
						subtitleTracks={subtitleTracks}
						currentSubtitle={playerSettings.subtitle}
						settings={playerSettings}
						anchorRef={subtitleButtonRef.current}
						controlsBarRef={controlsBarRef.current}
						onClose={() => setIsSubtitleMenuOpen(false)}
						onSubtitleChange={(track) => {
							handleSubtitleChange(track);
						}}
						onSettingsChange={handleSubtitleSettingsChange}
					/>
				)}

			{watchPartyRoomId && (
				<WatchPartyChat
					isOpen={watchPartyChatOpen}
					onClose={() => setWatchPartyChatOpen(false)}
					onToggle={() => setWatchPartyChatOpen(prev => !prev)}
					messages={watchPartyChatMessages}
					onSendMessage={(text) => {
						const ws = watchPartyWsRef.current;
						if (!ws || ws.readyState !== WebSocket.OPEN || !watchPartyUserId) return;
						ws.send(JSON.stringify({ type: 'chat', userId: watchPartyUserId, text }));
					}}
					watchPartyHostId={watchPartyHostId}
					isSettingsOpen={playerState.isSettingsOpen}
				/>
			)}

			<SettingsMenu
					isOpen={playerState.isSettingsOpen}
					sources={enhancedSources}
					currentQuality={playerState.quality}
					currentSource={currentSource}
					subtitleTracks={subtitleTracks}
						serverConfigs={serverConfigs}
						selectedServerId={selectedServerId}
						tmdbId={tmdbId}
						season={season}
						episode={episode}
						settings={playerSettings}
						playerState={playerState}
						settingsButtonRef={settingsButtonRef.current}
						controlsBarRef={controlsBarRef.current}
						watchPartyRoomId={watchPartyRoomId}
						watchPartyParticipants={watchPartyParticipants}
						watchPartyHostId={watchPartyHostId}
						watchPartyUserId={watchPartyUserId}
						watchPartyOverlayVisible={watchPartyOverlayVisible}
						onWatchPartyCreate={async (displayName, allowOffensiveWords) => {
							try {
								const serverId = selectedServerId ? (selectedServerId.includes(':') ? selectedServerId.split(':')[0] : selectedServerId) : serverConfigs[0]?.id;
								if (!serverId) {
									setPlayerState(prev => ({ ...prev, toast: 'Select a server first' }));
									setTimeout(() => setPlayerState(prev => ({ ...prev, toast: undefined })), 2000);
									return;
								}
								const headers: Record<string, string> = { 'Content-Type': 'application/json' };
								if (token) headers['Authorization'] = `Bearer ${token}`;
								const body: Record<string, unknown> = { serverId, tmdbId, season, episode, allowOffensiveWords: !!allowOffensiveWords };
								if (!token) {
									body.guestUserId = getOrCreateGuestId();
									const name = displayName?.trim() || getGuestDisplayName();
									if (name) {
										body.displayName = name.slice(0, 32);
										setGuestDisplayName(body.displayName as string);
									}
								}
								const response = await fetch(apiUrl('/api/watch-party/create'), {
									method: 'POST',
									headers,
									body: JSON.stringify(body)
								});
								if (response.ok) {
									const data = await response.json() as { code: string; hostId: string; displayName: string; avatar: string | null };
									setWatchPartyRoomId(data.code);
									setWatchPartyHostId(data.hostId);
									setWatchPartyUserId(data.hostId);
									setWatchPartyCanSkip(true);
									setWatchPartyParticipants([{ userId: data.hostId, displayName: data.displayName || 'Host', avatar: data.avatar, isHost: true, canSkip: true }]);
									navigate(`?code=${data.code}`, { replace: true });
									const inviteUrl = `${window.location.origin}${window.location.pathname}?code=${data.code}`;
									try {
										await navigator.clipboard.writeText(inviteUrl);
										setPlayerState(prev => ({ ...prev, toast: 'Watch party created! Invite link copied.' }));
									} catch {
										setPlayerState(prev => ({ ...prev, toast: 'Watch party created! Share: ' + inviteUrl }));
									}
									setTimeout(() => setPlayerState(prev => ({ ...prev, toast: undefined })), 3000);
								} else {
									const err = await response.json().catch(() => ({}));
									setPlayerState(prev => ({ ...prev, toast: err?.error || 'Failed to create watch party' }));
									setTimeout(() => setPlayerState(prev => ({ ...prev, toast: undefined })), 3000);
								}
							} catch {
								setPlayerState(prev => ({ ...prev, toast: 'Error creating watch party' }));
								setTimeout(() => setPlayerState(prev => ({ ...prev, toast: undefined })), 3000);
							}
						}}
						onWatchPartyJoin={async (code, displayName) => {
							const serverId = selectedServerId ? (selectedServerId.includes(':') ? selectedServerId.split(':')[0] : selectedServerId) : serverConfigs[0]?.id;
							if (!serverId) {
								setPlayerState(prev => ({ ...prev, toast: 'Select a server first' }));
								setTimeout(() => setPlayerState(prev => ({ ...prev, toast: undefined })), 2000);
								return;
							}
							const headers: Record<string, string> = { 'Content-Type': 'application/json' };
							if (token) headers['Authorization'] = `Bearer ${token}`;
							const body: Record<string, string> = { code: code.toUpperCase(), serverId };
							if (!token) {
								body.guestUserId = getOrCreateGuestId();
								if (displayName?.trim()) {
									body.displayName = displayName.trim().slice(0, 32);
									setGuestDisplayName(body.displayName);
								} else {
									const savedName = getGuestDisplayName();
									if (savedName) body.displayName = savedName;
								}
							}
							const response = await fetch(apiUrl('/api/watch-party/join'), {
								method: 'POST',
								headers,
								body: JSON.stringify(body)
							});
							if (response.ok) {
								const data = await response.json() as { room: { hostId: string; participants: Array<{ userId: string; displayName: string; avatar: string | null; isHost: boolean; canSkip: boolean }> }; userId: string };
								setWatchPartyRoomId(code.toUpperCase());
								setWatchPartyHostId(data.room.hostId);
								setWatchPartyUserId(data.userId);
								setWatchPartyParticipants(data.room.participants);
								const me = data.room.participants.find((p: { userId: string }) => p.userId === data.userId);
								setWatchPartyCanSkip(me?.canSkip ?? false);
								navigate(`?code=${code.toUpperCase()}`, { replace: true });
								setPlayerState(prev => ({ ...prev, toast: 'Joined watch party!' }));
								setTimeout(() => setPlayerState(prev => ({ ...prev, toast: undefined })), 2000);
							} else {
								const err = await response.json().catch(() => ({}));
								setPlayerState(prev => ({ ...prev, toast: err?.error || 'Failed to join' }));
								setTimeout(() => setPlayerState(prev => ({ ...prev, toast: undefined })), 3000);
							}
						}}
						onWatchPartyLeave={async () => {
							if (!watchPartyRoomId || !watchPartyUserId) return;
							await fetch(apiUrl('/api/watch-party/leave'), {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({ code: watchPartyRoomId, userId: watchPartyUserId })
							});
							if (watchPartyWsRef.current) {
								watchPartyWsRef.current.close();
								watchPartyWsRef.current = null;
							}
							setWatchPartyRoomId(null);
							setWatchPartyHostId(null);
							setWatchPartyUserId(null);
							setWatchPartyCanSkip(false);
							setWatchPartyParticipants([]);
							setWatchPartyChatMessages([]);
							const url = new URL(window.location.href);
							url.searchParams.delete('code');
							navigate(url.pathname + url.search || '?', { replace: true });
							setPlayerState(prev => ({ ...prev, toast: 'Left watch party' }));
							setTimeout(() => setPlayerState(prev => ({ ...prev, toast: undefined })), 2000);
						}}
						onRemoveParticipant={watchPartyHostId === watchPartyUserId ? async (targetUserId) => {
							if (!watchPartyRoomId || !watchPartyHostId) return;
							const response = await fetch(apiUrl('/api/watch-party/remove'), {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({ code: watchPartyRoomId, hostId: watchPartyHostId, targetUserId })
							});
							if (response.ok) {
								setPlayerState(prev => ({ ...prev, toast: 'Participant removed' }));
								setTimeout(() => setPlayerState(prev => ({ ...prev, toast: undefined })), 2000);
							}
						} : undefined}
						onGrantSkip={watchPartyHostId === watchPartyUserId ? async (targetUserId, canSkip) => {
							if (!watchPartyRoomId || !watchPartyHostId) return;
							const response = await fetch(apiUrl('/api/watch-party/grant-skip'), {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({ code: watchPartyRoomId, hostId: watchPartyHostId, targetUserId, canSkip })
							});
							if (response.ok) {
								setPlayerState(prev => ({ ...prev, toast: canSkip ? 'Can sync & seek' : 'Sync & seek revoked' }));
								setTimeout(() => setPlayerState(prev => ({ ...prev, toast: undefined })), 2000);
							}
						} : undefined}
						onWatchPartyOverlayToggle={(visible) => setWatchPartyOverlayVisible(visible)}
						onOpenChat={() => setWatchPartyChatOpen(true)}
						isLoggedIn={!!token}
						savedGuestDisplayName={token ? null : getGuestDisplayName()}
						hlsAudioTracks={hlsAudioTracks}
						currentHlsAudioTrack={currentHlsAudioTrack}
						onClose={() => setPlayerState(prev => ({ ...prev, isSettingsOpen: false }))}
						onSubtitleChange={handleSubtitleChange}
						onSubtitleToggle={handleSubtitleToggle}
						onSubtitleSettingsChange={handleSubtitleSettingsChange}
						onQualityChange={changeQuality}
						onAudioTrackChange={changeHlsAudioTrack}
						onSelectServer={handleSelectServer}
						onAutoQualityToggle={async (enabled: boolean) => {
							setPlayerSettings(prev => ({ ...prev, autoQuality: enabled }));
							saveSettings(playerSettings);
							if (enabled && sources.length > 0) {
								const bestSource = sources[0];
								await changeQuality(bestSource.quality);
							}
						}}
						onAutoNextToggle={(enabled: boolean) => {
							setPlayerSettings(prev => ({ ...prev, autoNext: enabled }));
							saveSettings(playerSettings);
						}}
						onDownload={() => {
							if (currentSource?.url) {
								const downloadUrl = `https://hls-downloader.pstream.mov/?url=${encodeURIComponent(currentSource.url)}`;
								window.open(downloadUrl, '_blank');
							} else {
								console.error('No video source available to download');
							}
						}}
						onPlaybackRateChange={(rate: number) => {
							if (videoElementRef.current) {
								videoElementRef.current.playbackRate = rate;
								setPlayerSettings(prev => ({ ...prev, playbackRate: rate }));
								saveSettings(playerSettings);
							}
						}}
					/>

				<DebugPanel
					isOpen={isDebugOpen}
					state={playerState}
					sources={enhancedSources}
					currentSource={currentSource}
					onClose={() => setIsDebugOpen(false)}
				/>
				</>
			)}

			<style>{`
				.liquid-glass-pill {
					border-radius: 999px;
					background: linear-gradient(
						135deg,
						rgba(255, 255, 255, 0.18) 0%,
						rgba(255, 255, 255, 0.06) 50%,
						rgba(255, 255, 255, 0.12) 100%
					);
					backdrop-filter: blur(24px) saturate(180%);
					-webkit-backdrop-filter: blur(24px) saturate(180%);
					border: 1px solid rgba(255, 255, 255, 0.22);
					box-shadow:
						0 8px 32px rgba(0, 0, 0, 0.35),
						0 2px 8px rgba(0, 0, 0, 0.2),
						inset 0 1px 0 rgba(255, 255, 255, 0.3),
						inset 0 -1px 0 rgba(255, 255, 255, 0.06);
					animation: floatIn 0.35s cubic-bezier(0.16, 1, 0.3, 1);
				}

				.key-badge {
					display: inline-flex;
					align-items: center;
					padding: 2px 8px;
					border-radius: 6px;
					background: rgba(255, 255, 255, 0.1);
					border: 1px solid rgba(255, 255, 255, 0.2);
					border-bottom-width: 2px;
					color: rgba(255, 255, 255, 0.85);
					font-family: ui-monospace, monospace;
					font-size: 11px;
					font-weight: 500;
					letter-spacing: 0.04em;
					box-shadow:
						inset 0 1px 0 rgba(255, 255, 255, 0.15),
						0 2px 4px rgba(0, 0, 0, 0.25);
				}

				@keyframes floatIn {
					from {
						opacity: 0;
						transform: translateY(8px) scale(0.95);
						filter: blur(4px);
					}
					to {
						opacity: 1;
						transform: translateY(0) scale(1);
						filter: blur(0);
					}
				}

				video::cue {
					display: none !important;
					visibility: hidden !important;
					opacity: 0 !important;
					font-size: 0 !important;
					line-height: 0 !important;
					padding: 0 !important;
					margin: 0 !important;
				}
				
				video::cue-region {
					display: none !important;
					visibility: hidden !important;
					opacity: 0 !important;
				}
				
				video::-webkit-media-text-track-display {
					display: none !important;
				}
				
				video::-webkit-media-text-track-container {
					display: none !important;
				}
			`}</style>
		</div>
	);
};

export default Player;
