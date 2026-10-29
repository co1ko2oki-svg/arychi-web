import { Client, Message } from "discord.js-selfbot-v13";
import { Streamer, Utils, prepareStream, playStream } from "@dank074/discord-video-stream";
import fs from "fs";
import path from "path";
import config from "../config.js";
import { MediaService } from "./media.js";
import { QueueService } from "./queue.js";
import { ViewerService } from "./viewer.js";
import { getVideoParams } from "../utils/ffmpeg.js";
import logger from "../utils/logger.js";
import { DiscordUtils, ErrorUtils } from "../utils/shared.js";
import { QueueItem, StreamStatus, IStreamingService, SupportedVideoCodec, H26xPreset } from "../types/index.js";

interface StreamConfiguration {
	width: number;
	height: number;
	frameRate: number;
	bitrateVideo: number;
	bitrateVideoMax: number;
	videoCodec: SupportedVideoCodec;
	hardwareAcceleratedDecoding: boolean;
	minimizeLatency: boolean;
	h26xPreset: H26xPreset;
}

export class StreamingService implements IStreamingService {
	private streamer: Streamer;
	private mediaService: MediaService;
	private queueService: QueueService;
	private viewerService?: ViewerService;
	private controller: AbortController | null = null;
	private streamStatus: StreamStatus;
	private isSkipping: boolean = false;

	private lastVoiceActionTime = 0;
	private readonly VOICE_ACTION_COOLDOWN_MS = 1500;
	private isVoiceActionInProgress = false;

	constructor(client: Client, streamStatus: StreamStatus, queueService?: QueueService, viewerService?: ViewerService) {
		this.streamer = new Streamer(client);
		this.mediaService = new MediaService();
		this.queueService = queueService || new QueueService();
		this.viewerService = viewerService;
		this.streamStatus = streamStatus;
		this.syncQueueStatus();
	}

	public getQueueService(): QueueService {
		return this.queueService;
	}

	public getViewerService(): ViewerService | undefined {
		return this.viewerService;
	}

	public setLoop(loop: boolean): void {
		this.streamStatus.isLooping = loop;
		logger.info(`Stream loop mode set to: ${loop}`);
	}

	public isLoopActive(): boolean {
		return Boolean(this.streamStatus.isLooping);
	}

	private syncQueueStatus(): void {
		this.streamStatus.queue = this.queueService.getQueueStatus();
	}

	private checkAndAcquireVoiceLock(message?: Message): boolean {
		const now = Date.now();
		const elapsed = now - this.lastVoiceActionTime;

		if (this.isVoiceActionInProgress) {
			if (message) {
				void DiscordUtils.sendError(message, "A voice action is currently in progress. Please wait.");
			}
			return false;
		}

		if (elapsed < this.VOICE_ACTION_COOLDOWN_MS) {
			const remainingSeconds = ((this.VOICE_ACTION_COOLDOWN_MS - elapsed) / 1000).toFixed(1);
			if (message) {
				void DiscordUtils.sendError(message, `Voice commands are throttled to protect Gateway. Please wait ${remainingSeconds}s.`);
			}
			return false;
		}

		this.isVoiceActionInProgress = true;
		this.lastVoiceActionTime = now;
		return true;
	}

	private releaseVoiceLock(): void {
		this.isVoiceActionInProgress = false;
		this.lastVoiceActionTime = Date.now();
	}

	public async addToQueue(
		message?: Message,
		videoSource: string = "",
		title?: string,
		username: string = "Dashboard"
	): Promise<boolean> {
		if (!videoSource) return false;
		try {
			const authorUsername = message?.author?.username || username;
			const mediaSource = await this.mediaService.resolveMediaSource(videoSource);

			let queueItem: QueueItem;
			if (mediaSource) {
				queueItem = await this.queueService.addToQueue(mediaSource, authorUsername);
			} else {
				queueItem = await this.queueService.add(
					videoSource,
					title || videoSource,
					authorUsername,
					"url",
					false,
					videoSource
				);
			}

			this.syncQueueStatus();
			if (message) {
				await DiscordUtils.sendSuccess(message, `Added to queue: \`${queueItem.title}\``);
			}
			return true;
		} catch (error) {
			await ErrorUtils.handleError(error, `adding to queue: ${videoSource}`, message);
			return false;
		}
	}

	public async playFromQueue(message?: Message): Promise<boolean> {
		if (!this.checkAndAcquireVoiceLock(message)) {
			return false;
		}

		try {
			if (this.streamStatus.playing) {
				if (message) {
					await DiscordUtils.sendError(message, "Already playing a video. Use skip command to skip current video.");
				}
				return false;
			}

			const nextItem = this.queueService.getNext();
			if (!nextItem) {
				if (message) {
					await DiscordUtils.sendError(message, "Queue is empty.");
				}
				return false;
			}

			this.queueService.setPlaying(true);
			this.syncQueueStatus();
			await this.playVideoFromQueueItem(message, nextItem);
			return true;
		} finally {
			this.releaseVoiceLock();
		}
	}

	public async skipCurrent(message?: Message): Promise<boolean> {
		if (!this.checkAndAcquireVoiceLock(message)) {
			return false;
		}

		try {
			if (!this.streamStatus.playing) {
				if (message) {
					await DiscordUtils.sendError(message, "No video is currently playing.");
				}
				return false;
			}

			const isLastItem = this.queueService.getLength() <= 1;
			if (this.isSkipping && !isLastItem) {
				if (message) {
					await DiscordUtils.sendError(message, "Skip already in progress.");
				}
				return false;
			}

			this.isSkipping = true;

			try {
				this.streamStatus.manualStop = true;
				this.controller?.abort();
				this.streamer.stopStream();

				const currentItem = this.queueService.getCurrent();
				const nextItem = this.queueService.skip();
				this.syncQueueStatus();

				if (!nextItem) {
					if (message) {
						await DiscordUtils.sendInfo(message, "Queue", "No more videos in queue.");
					}
					this.queueService.setPlaying(false);
					this.syncQueueStatus();
					await this.cleanupStreamStatus();
					return true;
				}

				const currentTitle = currentItem ? currentItem.title : "current video";
				if (message) {
					await DiscordUtils.sendInfo(message, "Skipping", `Skipping \`${currentTitle}\`. Playing next: \`${nextItem.title}\``);
				}

				this.streamStatus.manualStop = false;
				await this.playVideoFromQueueItem(message, nextItem);
				return true;
			} finally {
				this.isSkipping = false;
			}
		} finally {
			this.releaseVoiceLock();
		}
	}

	public async handleChannelMove(newChannelId: string): Promise<void> {
		this.streamStatus.channelInfo.channelId = newChannelId;

		if (this.streamer.voiceConnection) {
			this.streamer.voiceConnection.channelId = newChannelId;
			if (this.streamer.voiceConnection.streamConnection) {
				this.streamer.voiceConnection.streamConnection.channelId = newChannelId;
				this.streamer.signalStream();
			}
		}

		if (this.viewerService && this.viewerService.isConfigured() && this.streamStatus.channelInfo.guildId) {
			const streamerId = this.streamer.client.user?.id;
			if (streamerId) {
				void this.viewerService.watchStream(this.streamStatus.channelInfo.guildId, newChannelId, streamerId);
			}
		}

		logger.info(`Stream routed to new voice channel: ${newChannelId}`);
	}

	private async playVideoFromQueueItem(message: Message | undefined, queueItem: QueueItem): Promise<void> {
		this.queueService.setPlaying(true);
		this.syncQueueStatus();

		let videoParams: { width: number; height: number; fps?: number; bitrate?: number } | undefined;
		if (config.respect_video_params) {
			videoParams = await this.getVideoParameters(queueItem.url);
		}

		logger.info(`Playing from queue: ${queueItem.title} (${queueItem.url})`);
		await this.playVideo(message, queueItem.url, queueItem.title, videoParams);
	}

	private async getVideoParameters(videoUrl: string): Promise<{ width: number; height: number; fps?: number; bitrate?: number } | undefined> {
		try {
			const resolution = await getVideoParams(videoUrl);
			logger.info(`Video parameters: ${resolution.width}x${resolution.height}, FPS: ${resolution.fps || "unknown"}, Bitrate: ${resolution.bitrate || "unknown"}`);

			let bitrateKbps: number | undefined;
			if (resolution.bitrate) {
				bitrateKbps = Math.round(Number.parseInt(resolution.bitrate, 10) / 1000);
			}

			return {
				width: resolution.width,
				height: resolution.height,
				fps: resolution.fps,
				bitrate: bitrateKbps
			};
		} catch (error) {
			await ErrorUtils.handleError(error, "determining video parameters");
			return undefined;
		}
	}

	private async ensureVoiceConnection(guildId: string, channelId: string, title?: string): Promise<void> {
		if (!this.streamStatus.joined || !this.streamer.voiceConnection) {
			const connectionTimeoutMs = 10000;
			let timeoutHandle: NodeJS.Timeout | undefined;

			const timeoutPromise = new Promise<never>((_, reject) => {
				timeoutHandle = setTimeout(() => {
					reject(new Error(`Voice connection timed out after ${connectionTimeoutMs}ms`));
				}, connectionTimeoutMs);
			});

			try {
				await Promise.race([
					this.streamer.joinVoice(guildId, channelId),
					timeoutPromise
				]);
			} catch (error) {
				this.streamer.leaveVoice();
				this.streamStatus.joined = false;
				this.streamStatus.joinsucc = false;
				throw error;
			} finally {
				if (timeoutHandle) {
					clearTimeout(timeoutHandle);
				}
			}

			this.streamStatus.joined = true;
		}

		this.streamStatus.playing = true;
		this.streamStatus.channelInfo = {
			guildId,
			channelId,
			cmdChannelId: config.cmdChannelId
		};

		if (title) {
			this.streamer.client.user?.setActivity(DiscordUtils.status_watch(title));
		}

		if (!this.streamer.voiceConnection) {
			throw new Error("Voice connection could not be established.");
		}
	}

	private setupStreamConfiguration(videoParams?: { width: number; height: number; fps?: number; bitrate?: number }): StreamConfiguration {
		let width = videoParams?.width || config.width;
		let height = videoParams?.height || config.height;
		const frameRate = videoParams?.fps || config.fps;
		let bitrateVideo = config.bitrateKbps;

		if (videoParams?.bitrate && !config.bitrateOverride) {
			bitrateVideo = videoParams.bitrate;
		}

		if (config.maxWidth > 0 || config.maxHeight > 0) {
			const ratio = width / height;
			if (config.maxWidth > 0 && width > config.maxWidth) {
				width = config.maxWidth;
				height = Math.round(width / ratio);
			}
			if (config.maxHeight > 0 && height > config.maxHeight) {
				height = config.maxHeight;
				width = Math.round(height * ratio);
			}
			width = Math.round(width / 2) * 2;
			height = Math.round(height / 2) * 2;
		}

		return {
			width,
			height,
			frameRate,
			bitrateVideo,
			bitrateVideoMax: config.maxBitrateKbps,
			videoCodec: Utils.normalizeVideoCodec(config.videoCodec),
			hardwareAcceleratedDecoding: config.hardwareAcceleratedDecoding,
			minimizeLatency: false,
			h26xPreset: config.h26xPreset
		};
	}

	private async executeStream(inputForFfmpeg: string, streamOpts: StreamConfiguration, message: Message | undefined, title: string, videoSource: string): Promise<void> {
		const { command, output: ffmpegOutput } = prepareStream(inputForFfmpeg, streamOpts, this.controller!.signal);

		command.on("error", (err, stdout, stderr) => {
			if (!this.streamStatus.manualStop && this.controller && !this.controller.signal.aborted) {
				logger.error(`An error occurred in ffmpeg: ${err.message || String(err)}`);
				if (stdout) logger.error(`ffmpeg stdout: ${stdout}`);
				if (stderr) logger.error(`ffmpeg stderr: ${stderr}`);
				this.controller.abort();
			}
		});

		await playStream(ffmpegOutput, this.streamer, undefined, this.controller!.signal).catch(err => {
			if (this.controller && !this.controller.signal.aborted) {
				logger.error("playStream error:", err);
				if (message) {
					DiscordUtils.sendError(message, `Stream error: ${err.message || "Unknown error"}`).catch(e =>
						logger.error("Failed to send error message:", e)
					);
				}
				this.controller.abort();
			}
		});

		if (this.controller && !this.controller.signal.aborted && !this.streamStatus.manualStop) {
			logger.info(`Finished playing: ${title || videoSource}`);
		} else if (this.streamStatus.manualStop) {
			logger.info(`Stopped playing: ${title || videoSource}`);
		} else {
			logger.info(`Failed playing: ${title || videoSource}`);
		}
	}

	private async handleQueueAdvancement(message?: Message): Promise<void> {
		if (message) {
			await DiscordUtils.sendFinishMessage(message);
		}

		const finishedItem = this.queueService.getCurrent();
		if (finishedItem) {
			this.queueService.removeFromQueue(finishedItem.id);
			if (this.streamStatus.isLooping) {
				void this.queueService.add(
					finishedItem.url,
					finishedItem.title,
					finishedItem.requestedBy,
					finishedItem.type,
					finishedItem.isLive,
					finishedItem.originalInput
				);
				logger.info(`[Loop Farm] Re-enqueued finished video for endless farm: ${finishedItem.title}`);
			}
		}

		const nextItem = this.queueService.getNext();
		this.syncQueueStatus();

		if (nextItem) {
			logger.info(`Auto-playing next item from queue: ${nextItem.title}`);
			setTimeout(() => {
				this.playVideoFromQueueItem(message, nextItem).catch(err =>
					ErrorUtils.handleError(err, "auto-playing next item")
				);
			}, 1000);
		} else {
			this.queueService.setPlaying(false);
			this.syncQueueStatus();
			logger.info("No more items in queue, playback stopped");
			await this.cleanupStreamStatus();
		}
	}

	private async handleDownload(message: Message | undefined, videoSource: string, title?: string): Promise<string | null> {
		let downloadMessage: Message | null = null;
		if (message) {
			downloadMessage = await message.reply(`📥 Downloading \`${title || "YouTube video"}\`...`).catch(e => {
				logger.warn("Failed to send 'Downloading...' message:", e);
				return null;
			});
		}

		try {
			logger.info(`Downloading ${title || videoSource}...`);
			const tempFilePath = await this.mediaService.downloadYouTubeVideo(videoSource);

			if (tempFilePath) {
				logger.info(`Finished downloading ${title || videoSource}`);
				if (downloadMessage) {
					await downloadMessage.delete().catch(e => logger.warn("Failed to delete 'Downloading...' message:", e));
				}
				return tempFilePath;
			}
			throw new Error("Download failed, no file path returned.");
		} catch (error) {
			logger.error(`Failed to download YouTube video: ${videoSource}`, error);
			const errorMessage = `❌ Failed to download \`${title || "YouTube video"}\`.`;
			if (downloadMessage) {
				await downloadMessage.edit(errorMessage).catch(e => logger.warn("Failed to edit 'Downloading...' message:", e));
			} else if (message) {
				await DiscordUtils.sendError(message, `Failed to download video: ${error instanceof Error ? error.message : String(error)}`);
			}
			return null;
		}
	}

	private async prepareVideoSource(message: Message | undefined, videoSource: string, title?: string): Promise<{ inputForFfmpeg: string; tempFilePath: string | null }> {
		const mediaSource = await this.mediaService.resolveMediaSource(videoSource);

		if (mediaSource && mediaSource.type === "youtube" && !mediaSource.isLive) {
			const tempFilePath = await this.handleDownload(message, videoSource, title);
			if (tempFilePath) {
				return { inputForFfmpeg: tempFilePath, tempFilePath };
			}
			throw new Error("Failed to prepare video source due to download failure.");
		}

		return {
			inputForFfmpeg: mediaSource ? mediaSource.url : videoSource,
			tempFilePath: null
		};
	}

	private async finalizeStream(message: Message | undefined, tempFile: string | null): Promise<void> {
		if (!this.streamStatus.manualStop && this.controller && !this.controller.signal.aborted) {
			await this.handleQueueAdvancement(message);
		} else {
			this.queueService.setPlaying(false);
			this.queueService.resetCurrentIndex();
			this.syncQueueStatus();
			await this.cleanupStreamStatus();
		}

		if (tempFile && path.basename(tempFile).startsWith("ytdlp_temp_")) {
			try {
				fs.unlinkSync(tempFile);
			} catch (cleanupError) {
				logger.error(`Failed to delete temp file ${tempFile}:`, cleanupError);
			}
		}
	}

	public async playVideo(
		message: Message | undefined,
		videoSource: string,
		title?: string,
		videoParams?: { width: number; height: number; fps?: number; bitrate?: number }
	): Promise<void> {
		const [guildId, channelId] = [config.guildId, config.videoChannelId];
		this.streamStatus.manualStop = false;

		if (title) {
			const currentQueueItem = this.queueService.getCurrent();
			if (currentQueueItem?.title === title) {
				this.queueService.setPlaying(true);
				this.syncQueueStatus();
			}
		}

		let tempFile: string | null = null;
		try {
			const { inputForFfmpeg, tempFilePath } = await this.prepareVideoSource(message, videoSource, title);
			tempFile = tempFilePath;

			await this.ensureVoiceConnection(guildId, channelId, title);
			await DiscordUtils.sendPlaying(message, title || videoSource);

			if (this.viewerService && config.viewerAutoWatch && this.viewerService.isConfigured()) {
				const streamerId = this.streamer.client.user?.id;
				if (streamerId) {
					void this.viewerService.watchStream(guildId, channelId, streamerId);
				}
			}

			const streamOpts = this.setupStreamConfiguration(videoParams);
			this.controller = new AbortController();
			await this.executeStream(inputForFfmpeg, streamOpts, message, title || videoSource, videoSource);
		} catch (error) {
			await ErrorUtils.handleError(error, `playing video: ${title || videoSource}`);
			if (this.controller && !this.controller.signal.aborted) {
				this.controller.abort();
			}
		} finally {
			await this.finalizeStream(message, tempFile);
		}
	}

	public async cleanupStreamStatus(forceLeave: boolean = false): Promise<void> {
		try {
			this.controller?.abort();
			this.streamer.stopStream();

			if (this.viewerService) {
				this.viewerService.stopWatching();
			}

			if (forceLeave || this.queueService.isEmpty() || !this.streamStatus.joined) {
				this.streamer.leaveVoice();
				this.streamStatus.joined = false;
				this.streamStatus.joinsucc = false;
			}

			this.streamer.client.user?.setActivity(DiscordUtils.status_idle());

			this.streamStatus.playing = false;
			this.streamStatus.manualStop = false;
			this.streamStatus.channelInfo = {
				guildId: "",
				channelId: "",
				cmdChannelId: ""
			};
			this.syncQueueStatus();
		} catch (error) {
			await ErrorUtils.handleError(error, "cleanup stream status");
		}
	}

	public async stopAndClearQueue(message?: Message): Promise<boolean> {
		if (!this.checkAndAcquireVoiceLock(message)) {
			return false;
		}

		try {
			this.queueService.clearQueue();
			this.syncQueueStatus();
			logger.info("Queue cleared by stop command");
			await this.cleanupStreamStatus(true);
			return true;
		} finally {
			this.releaseVoiceLock();
		}
	}
}
