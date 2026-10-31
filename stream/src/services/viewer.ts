import { Client, VoiceConnection, StreamConnectionReadonly, BaseGuildVoiceChannel } from "discord.js-selfbot-v13";
import config from "../config.js";
import logger from "../utils/logger.js";

export interface FarmStats {
	isConfigured: boolean;
	isOnline: boolean;
	isWatching: boolean;
	viewerTag: string;
	currentSessionSeconds: number;
	totalFarmedSeconds: number;
	formattedSessionTime: string;
	formattedTotalTime: string;
}

export function formatDuration(totalSeconds: number): string {
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = Math.floor(totalSeconds % 60);

	if (hours > 0) {
		return `${hours}h ${minutes}m ${seconds}s`;
	}
	return `${minutes}m ${seconds}s`;
}

export class ViewerService {
	private client: Client;
	private isOnline: boolean = false;
	private isWatching: boolean = false;
	private currentVoiceConnection: VoiceConnection | null = null;
	private currentStreamWatch: StreamConnectionReadonly | null = null;
	private sessionStartTime: number | null = null;
	private totalFarmedSeconds: number = 0;
	private targetGuildId: string | null = null;
	private targetChannelId: string | null = null;
	private targetStreamerId: string | null = null;

	constructor() {
		this.client = new Client();
		this.setupEvents();
	}

	public isConfigured(): boolean {
		return Boolean(config.viewerToken && config.viewerToken.trim().length > 0);
	}

	public getClient(): Client {
		return this.client;
	}

	private setupEvents(): void {
		this.client.on("ready", () => {
			this.isOnline = true;
			logger.info(`[Viewer Farm] Logged in as ${this.client.user?.tag} (Stream watcher active)`);
		});

		this.client.on("error", (err) => {
			logger.error("[Viewer Farm Error]:", err);
		});

		this.client.on("voiceStateUpdate", (oldState, newState) => {
			const currentUserId = this.client.user?.id;
			if (currentUserId && oldState.member?.user.id === currentUserId && oldState.channelId && !newState.channelId) {
				if (this.isWatching) {
					logger.warn("[Viewer Farm] Viewer was disconnected from voice channel.");
					this.stopWatching();
				}
			}
		});
	}

	public async start(): Promise<void> {
		if (!this.isConfigured()) {
			logger.info("[Viewer Farm] VIEWER_TOKEN not provided. Stream farming watcher is disabled.");
			return;
		}

		try {
			logger.info("[Viewer Farm] Logging in stream watcher client...");
			await this.client.login(config.viewerToken);
		} catch (err) {
			logger.error("[Viewer Farm] Failed to login viewer client with provided VIEWER_TOKEN:", err);
		}
	}

	public async updateTokenAndLogin(newToken: string): Promise<boolean> {
		config.viewerToken = newToken.trim();
		if (!this.isConfigured()) {
			this.stopWatching();
			this.isOnline = false;
			return false;
		}
		try {
			this.stopWatching();
			try {
				this.client.destroy();
			} catch {}
			this.client = new Client();
			this.setupEvents();
			await this.client.login(config.viewerToken);
			this.isOnline = true;
			return true;
		} catch (err) {
			this.isOnline = false;
			logger.error("[Viewer Farm] Failed to login with updated VIEWER_TOKEN:", err);
			return false;
		}
	}

	public async watchStream(guildId: string, channelId: string, streamerUserId: string): Promise<boolean> {
		if (!this.isConfigured() || !this.isOnline) {
			return false;
		}

		this.targetGuildId = guildId;
		this.targetChannelId = channelId;
		this.targetStreamerId = streamerUserId;

		if (this.isWatching && this.currentStreamWatch) {
			return true;
		}

		try {
			const channel = await this.client.channels.fetch(channelId).catch(() => null);
			if (!channel || !(channel instanceof BaseGuildVoiceChannel)) {
				logger.error(`[Viewer Farm] Target channel ${channelId} is not a valid guild voice channel for viewer account.`);
				return false;
			}

			logger.info(`[Viewer Farm] Viewer joining voice channel: ${channel.name} (${channel.id})...`);
			const voiceConnection = await this.client.voice.joinChannel(channel.id, {
				selfDeaf: true,
				selfMute: true,
				selfVideo: false
			});
			this.currentVoiceConnection = voiceConnection;

			const isStreaming = await this.waitForStreamerStreaming(guildId, streamerUserId, 15000);
			if (!isStreaming) {
				logger.warn(`[Viewer Farm] Streamer ${streamerUserId} not reporting active stream within 15s. Watching might be delayed.`);
			}

			logger.info(`[Viewer Farm] Sending STREAM_WATCH for streamer ${streamerUserId}...`);
			const streamWatchConn = await voiceConnection.joinStreamConnection(streamerUserId);
			this.currentStreamWatch = streamWatchConn;
			this.isWatching = true;
			this.sessionStartTime = Date.now();

			logger.info(`[Viewer Farm] SUCCESS: Viewer is now watching the stream. Discord stream hours are now accumulating!`);
			return true;
		} catch (error) {
			logger.error("[Viewer Farm] Error while joining stream watch:", error);
			this.cleanupConnections();
			return false;
		}
	}

	public stopWatching(): void {
		if (this.sessionStartTime) {
			const elapsed = Math.round((Date.now() - this.sessionStartTime) / 1000);
			this.totalFarmedSeconds += elapsed;
			logger.info(`[Viewer Farm] Stream watch ended. Session duration: ${formatDuration(elapsed)}. Total farmed: ${formatDuration(this.totalFarmedSeconds)}`);
		}

		this.sessionStartTime = null;
		this.isWatching = false;
		this.cleanupConnections();
	}

	private cleanupConnections(): void {
		if (this.currentStreamWatch) {
			try {
				this.currentStreamWatch.disconnect();
			} catch {}
			this.currentStreamWatch = null;
		}

		if (this.currentVoiceConnection) {
			try {
				this.currentVoiceConnection.disconnect();
			} catch {}
			this.currentVoiceConnection = null;
		}
	}

	private async waitForStreamerStreaming(guildId: string, streamerUserId: string, maxWaitMs = 15000): Promise<boolean> {
		const guild = await this.client.guilds.fetch(guildId).catch(() => null);
		if (!guild) return false;

		const start = Date.now();
		while (Date.now() - start < maxWaitMs) {
			const voiceState = guild.voiceStates.cache.get(streamerUserId);
			if (voiceState?.streaming) {
				return true;
			}
			await new Promise(resolve => setTimeout(resolve, 1000));
		}
		return false;
	}

	public getFarmStats(): FarmStats {
		let currentSessionSeconds = 0;
		if (this.isWatching && this.sessionStartTime) {
			currentSessionSeconds = Math.round((Date.now() - this.sessionStartTime) / 1000);
		}

		const totalSeconds = this.totalFarmedSeconds + currentSessionSeconds;

		return {
			isConfigured: this.isConfigured(),
			isOnline: this.isOnline,
			isWatching: this.isWatching,
			viewerTag: this.client.user?.tag || "Not connected",
			currentSessionSeconds,
			totalFarmedSeconds: totalSeconds,
			formattedSessionTime: formatDuration(currentSessionSeconds),
			formattedTotalTime: formatDuration(totalSeconds)
		};
	}
}
