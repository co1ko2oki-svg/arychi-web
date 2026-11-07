import { Client } from "discord.js-selfbot-v13";
import config from "../config.js";
import logger from "../utils/logger.js";

export interface FarmStats {
	isConfigured: boolean;
	isOnline: boolean;
	isWatching: boolean;
	viewerTag: string;
	currentSessionSeconds: number;
	totalFarmedSeconds: number;
	totalMinutesWatched: number;
	formattedSessionTime: string;
	formattedTotalTime: string;
	autoWatch: boolean;
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
	private watchPingInterval: NodeJS.Timeout | null = null;
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

		this.client.on("shardResume", () => {
			logger.info("[Viewer Farm] Gateway shard resumed. Restoring watch state...");
			if (this.isWatching && this.targetGuildId && this.targetChannelId && this.targetStreamerId) {
				this.sendGatewayOp(4, {
					guild_id: this.targetGuildId,
					channel_id: this.targetChannelId,
					self_mute: false,
					self_deaf: false,
					self_video: false
				});
				const streamKey = `guild:${this.targetGuildId}:${this.targetChannelId}:${this.targetStreamerId}`;
				this.sendGatewayOp(20, { stream_key: streamKey });
			}
		});

		this.client.on("error", (err) => {
			logger.error("[Viewer Farm Error]:", err);
		});

		this.client.on("voiceStateUpdate", (oldState, newState) => {
			const currentUserId = this.client.user?.id;
			const targetUserId = newState.id || oldState.id;
			if (currentUserId && targetUserId === currentUserId) {
				if (oldState.channelId && !newState.channelId) {
					if (this.isWatching && config.viewerAutoWatch && this.targetGuildId && this.targetChannelId && this.targetStreamerId) {
						logger.warn("[Viewer Farm] Viewer disconnected from voice. Reconnecting in 3s...");
						setTimeout(() => {
							if (this.isWatching && this.isOnline) {
								this.sendGatewayOp(4, {
									guild_id: this.targetGuildId!,
									channel_id: this.targetChannelId!,
									self_mute: false,
									self_deaf: false,
									self_video: false
								});
								const streamKey = `guild:${this.targetGuildId}:${this.targetChannelId}:${this.targetStreamerId}`;
								this.sendGatewayOp(20, { stream_key: streamKey });
							}
						}, 3000);
					}
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
			this.stopWatching(true);
			this.isOnline = false;
			return false;
		}
		try {
			this.stopWatching(true);
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

	private sendGatewayOp(op: number, d: any): void {
		try {
			const ws = (this.client as any).ws;
			if (ws && typeof ws.broadcast === "function") {
				ws.broadcast({ op, d });
			}
		} catch (err) {
			logger.debug("[Viewer Farm] Gateway broadcast error:", err);
		}
	}

	public async watchStream(guildId: string, channelId: string, streamerUserId: string): Promise<boolean> {
		if (!this.isConfigured() || !this.isOnline) {
			return false;
		}

		this.targetGuildId = guildId;
		this.targetChannelId = channelId;
		this.targetStreamerId = streamerUserId;

		try {
			logger.info(`[Viewer Farm] Joining voice channel ${channelId} via Discord Gateway...`);
			
			this.sendGatewayOp(4, {
				guild_id: guildId,
				channel_id: channelId,
				self_mute: false,
				self_deaf: false,
				self_video: false
			});

			const streamKey = `guild:${guildId}:${channelId}:${streamerUserId}`;

			this.sendGatewayOp(20, { stream_key: streamKey });
			logger.info(`[Viewer Farm] Sent Gateway STREAM_WATCH (Opcode 20) for streamer ${streamerUserId}`);

			if (this.watchPingInterval) {
				clearInterval(this.watchPingInterval);
			}
			this.watchPingInterval = setInterval(() => {
				if (this.isWatching && this.targetGuildId && this.targetChannelId && this.targetStreamerId) {
					const currentKey = `guild:${this.targetGuildId}:${this.targetChannelId}:${this.targetStreamerId}`;
					this.sendGatewayOp(4, {
						guild_id: this.targetGuildId,
						channel_id: this.targetChannelId,
						self_mute: false,
						self_deaf: false,
						self_video: false
					});
					this.sendGatewayOp(21, { stream_key: currentKey });
				}
			}, 20000);

			if (!this.isWatching) {
				this.isWatching = true;
				this.sessionStartTime = Date.now();
			}

			logger.info(`[Viewer Farm] SUCCESS: Viewer is active in voice channel. Discord stream hours are now accumulating!`);
			return true;
		} catch (error) {
			logger.error("[Viewer Farm] Error while joining voice channel:", error);
			return false;
		}
	}

	public stopWatching(forceLeaveVoice: boolean = true): void {
		if (this.watchPingInterval) {
			clearInterval(this.watchPingInterval);
			this.watchPingInterval = null;
		}

		if (this.targetGuildId && this.targetChannelId && this.targetStreamerId) {
			const streamKey = `guild:${this.targetGuildId}:${this.targetChannelId}:${this.targetStreamerId}`;
			this.sendGatewayOp(19, { stream_key: streamKey });
		}

		if (this.sessionStartTime) {
			const elapsed = Math.round((Date.now() - this.sessionStartTime) / 1000);
			this.totalFarmedSeconds += elapsed;
			logger.info(`[Viewer Farm] Stream watch ended. Session duration: ${formatDuration(elapsed)}. Total farmed: ${formatDuration(this.totalFarmedSeconds)}`);
		}

		this.sessionStartTime = null;
		this.isWatching = false;

		if (forceLeaveVoice) {
			const guildId = this.targetGuildId || config.guildId;
			if (guildId) {
				this.sendGatewayOp(4, {
					guild_id: guildId,
					channel_id: null,
					self_mute: false,
					self_deaf: false,
					self_video: false
				});
			}
		}
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
			totalMinutesWatched: Math.floor(totalSeconds / 60),
			formattedSessionTime: formatDuration(currentSessionSeconds),
			formattedTotalTime: formatDuration(totalSeconds),
			autoWatch: config.viewerAutoWatch
		};
	}
}
