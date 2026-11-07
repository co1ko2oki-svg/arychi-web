import ffmpeg from "fluent-ffmpeg";
import { PassThrough } from "node:stream";
import "../utils/polyfill.js";
import { Client, Message } from "discord.js-selfbot-v13";
import { Streamer, Utils, prepareStream, playStream, Encoders, PrepareStreamOptions } from "@dank074/discord-video-stream";
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

type StreamConfiguration = Partial<PrepareStreamOptions>;

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
	private isCleaningUp = false;

	constructor(client: Client, streamStatus: StreamStatus, queueService?: QueueService, viewerService?: ViewerService) {
		this.streamer = new Streamer(client);
		this.mediaService = new MediaService();
		this.queueService = queueService || new QueueService();
		this.viewerService = viewerService;
		this.streamStatus = streamStatus;
		this.syncQueueStatus();

		this.streamer.client.on("raw", (packet: any) => {
			if (packet?.t === "STREAM_CREATE") {
				const d = packet.d;
				const myUserId = this.streamer.client.user?.id;
				if (d && d.stream_key && myUserId && d.stream_key.endsWith(`:${myUserId}`)) {
					logger.info(`[Viewer Farm] Stream active confirmed via STREAM_CREATE (${d.stream_key}). Initiating stream watcher...`);
					if (this.viewerService && config.viewerAutoWatch && this.viewerService.isConfigured() && !this.streamStatus.manualStop) {
						const targetGuild = this.streamStatus.channelInfo.guildId || config.guildId;
						const targetChannel = this.streamStatus.channelInfo.channelId || config.videoChannelId;
						if (targetGuild && targetChannel) {
							void this.viewerService.watchStream(targetGuild, targetChannel, myUserId);
						}
					}
				}
			}
		});
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
				queueItem = await this.queueService.addToQueue(mediaSource, authorUsername, videoSource);
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

			let nextItem = this.queueService.getNext();
			if (!nextItem && this.queueService.getLength() > 0) {
				this.queueService.resetCurrentIndex();
				nextItem = this.queueService.getNext();
			}

			if (!nextItem) {
				if (message) {
					await DiscordUtils.sendError(message, "Queue is empty.");
				}
				return false;
			}

			this.queueService.setPlaying(true);
			this.syncQueueStatus();
			void this.playVideoFromQueueItem(message, nextItem).catch(err => {
				logger.error("Error in playVideoFromQueueItem:", err);
			});
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
				void this.playVideoFromQueueItem(message, nextItem).catch(err => {
					logger.error("Error playing next item after skip:", err);
				});
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
		const itemIdx = this.queueService.getQueue().findIndex(it => it.id === queueItem.id);
		if (itemIdx !== -1) {
			this.queueService.setCurrentIndex(itemIdx);
		}
		this.syncQueueStatus();

		const originalInput = queueItem.originalInput || queueItem.url;
		let sourceUrl = queueItem.url;
		let audioUrl = queueItem.audioUrl;

		// Refresh live stream URL if it's YouTube or Twitch to ensure manifest/tokens are fresh
		if (originalInput && (originalInput.includes("youtube.com/") || originalInput.includes("youtu.be/") || originalInput.includes("twitch.tv/"))) {
			try {
				const freshSource = await this.mediaService.resolveMediaSource(originalInput);
				if (freshSource && freshSource.url) {
					sourceUrl = freshSource.url;
					audioUrl = freshSource.audioUrl;
					queueItem.url = freshSource.url;
					queueItem.audioUrl = freshSource.audioUrl;
					logger.info(`Refreshed live media manifest URL for ${queueItem.title}`);
				}
			} catch (refreshErr) {
				logger.warn(`Could not refresh stream URL for ${queueItem.title}, continuing with stored URL:`, refreshErr);
			}
		}

		let videoParams: { width: number; height: number; fps?: number; bitrate?: number } | undefined;
		if (config.respect_video_params) {
			videoParams = await this.getVideoParameters(sourceUrl);
		}

		logger.info(`Playing from queue: ${queueItem.title} (${sourceUrl})`);
		await this.playVideo(message, sourceUrl, queueItem.title, videoParams, audioUrl);
	}

	private async getVideoParameters(videoUrl: string): Promise<{ width: number; height: number; fps?: number; bitrate?: number } | undefined> {
		try {
			const resolution = await getVideoParams(videoUrl);
			logger.info(`Video parameters: ${resolution.width}x${resolution.height}, FPS: ${resolution.fps || "unknown"}, Bitrate: ${resolution.bitrate || "unknown"}`);

			let bitrateKbps: number | undefined;
			if (resolution.bitrate) {
				bitrateKbps = Math.round(Number(resolution.bitrate));
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
			const channel = await this.streamer.client.channels.fetch(channelId).catch(() => null);
			if (!channel) {
				throw new Error(`Không tìm thấy Voice Channel ${channelId} hoặc tài khoản chưa tham gia Server ${guildId}.`);
			}
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

		try {
			this.streamer.client.user?.presence.set({ activities: [], status: "online" });
		} catch {}

		if (!this.streamer.voiceConnection) {
			throw new Error("Voice connection could not be established.");
		}
	}

	private setupStreamConfiguration(
		inputUrl: string,
		videoParams?: { width: number; height: number; fps?: number; bitrate?: number }
	): StreamConfiguration {
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

		const streamConfig: StreamConfiguration = {
			width,
			height,
			frameRate,
			bitrateVideo,
			bitrateVideoMax: config.maxBitrateKbps,
			videoCodec: Utils.normalizeVideoCodec(config.videoCodec),
			hardwareAcceleratedDecoding: config.hardwareAcceleratedDecoding,
			minimizeLatency: false,
			encoder: Encoders.software({
				x264: { preset: config.h26xPreset },
				x265: { preset: config.h26xPreset }
			})
		};

		const isNetwork = inputUrl.startsWith("http://") || inputUrl.startsWith("https://");
		const isHls = inputUrl.includes("m3u");

		// Only add custom reconnect options for non-HLS network streams.
		// For HLS streams (e.g. YouTube Live), -reconnect_at_eof causes ffmpeg to stall indefinitely on segment EOFs.
		if (isNetwork && !isHls) {
			streamConfig.customInputOptions = [
				"-reconnect", "1",
				"-reconnect_at_eof", "1",
				"-reconnect_streamed", "1",
				"-reconnect_delay_max", "5"
			];
		}

		return streamConfig;
	}

	
	private prepareCustomStream(
		inputVideo: string,
		inputAudio: string | undefined,
		options: StreamConfiguration,
		cancelSignal?: AbortSignal
	) {
		cancelSignal?.throwIfAborted();
		const output = new PassThrough();

		const command = ffmpeg(inputVideo);
		const isNetwork = inputVideo.startsWith("http://") || inputVideo.startsWith("https://");
		const isHls = inputVideo.includes("m3u");

		if (isNetwork) {
			command.inputOption("-headers", "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)\r\nConnection: keep-alive\r\n");
			if (!isHls) {
				command.inputOptions([
					"-reconnect 1",
					"-reconnect_at_eof 1",
					"-reconnect_streamed 1",
					"-reconnect_delay_max 5"
				]);
			}
		}

		if (inputAudio) {
			command.input(inputAudio);
			if (inputAudio.startsWith("http://") || inputAudio.startsWith("https://")) {
				command.inputOption("-headers", "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)\r\nConnection: keep-alive\r\n");
			}
		}

		if (options.customInputOptions && options.customInputOptions.length > 0) {
			command.inputOptions(options.customInputOptions);
		}

		if (options.hardwareAcceleratedDecoding) {
			command.inputOption("-hwaccel", "auto");
		}
		if (options.minimizeLatency) {
			command.addOptions(["-fflags nobuffer", "-analyzeduration 0"]);
		}

		command.output(output).outputFormat("nut");

		// Video setup
		command.addOutputOption("-map", "0:v:0");
		command.videoFilter(`scale=${options.width || 1280}:${options.height || 720}`);
		if (options.frameRate) {
			command.fpsOutput(options.frameRate);
		}
		command.addOutputOption([
			"-b:v", `${options.bitrateVideo || 2000}k`,
			"-maxrate:v", `${options.bitrateVideoMax || 2500}k`,
			"-bufsize:v", `${Math.round((options.bitrateVideo || 2000) / 2)}k`,
			"-bf", "0",
			"-pix_fmt", "yuv420p",
			"-force_key_frames", "expr:gte(t,n_forced*1)"
		]);

		command.videoCodec("libx264").outputOptions(["-preset", config.h26xPreset, "-tune", "zerolatency"]);

		// Audio setup: if separate audio stream is given (e.g. YouTube Live), map from input 1; otherwise map from input 0
		if (inputAudio) {
			command.addOutputOption("-map", "1:a:0");
		} else {
			command.addOutputOption("-map", "0:a:0?");
		}

		command
			.audioChannels(2)
			.audioFrequency(48000)
			.audioCodec("libopus")
			.audioBitrate("128k")
			.audioFilters("volume@internal_lib=1.0");

		cancelSignal?.addEventListener("abort", () => {
			try {
				command.kill("SIGTERM");
			} catch {}
		}, { once: true });

		command.run();

		return { command, output };
	}

	private async executeStream(inputForFfmpeg: string, streamOpts: StreamConfiguration, message: Message | undefined, title: string, videoSource: string, audioForFfmpeg?: string): Promise<void> {
		const { command, output: ffmpegOutput } = this.prepareCustomStream(inputForFfmpeg, audioForFfmpeg, streamOpts, this.controller!.signal);

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
				const originalInput = finishedItem.originalInput || finishedItem.url;
				await this.queueService.add(
					originalInput,
					finishedItem.title,
					finishedItem.requestedBy,
					finishedItem.type,
					finishedItem.isLive,
					originalInput,
					finishedItem.audioUrl
				);
				logger.info(`[Loop Farm] Re-enqueued finished video for endless farm: ${finishedItem.title}`);
			}
		}

		let nextItem = this.queueService.getNext();
		if (!nextItem && this.streamStatus.isLooping && this.queueService.getLength() > 0) {
			this.queueService.resetCurrentIndex();
			nextItem = this.queueService.getNext();
		}

		this.syncQueueStatus();

		if (nextItem) {
			logger.info(`Auto-playing next item from queue: ${nextItem.title}`);
			setTimeout(() => {
				this.playVideoFromQueueItem(message, nextItem).catch(async (err) => {
					logger.error("Error auto-playing next item:", err);
					if (this.streamStatus.isLooping && !this.streamStatus.manualStop) {
						logger.info("[Loop Farm] Will retry auto-playing next item in 5 seconds...");
						setTimeout(() => {
							if (this.streamStatus.isLooping && !this.streamStatus.manualStop && !this.streamStatus.playing) {
								void this.playVideoFromQueueItem(message, nextItem);
							}
						}, 5000);
					}
				});
			}, 1500);
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

	private async prepareVideoSource(message: Message | undefined, videoSource: string, title?: string, audioSource?: string): Promise<{ inputForFfmpeg: string; audioForFfmpeg?: string; tempFilePath: string | null }> {
		const mediaSource = await this.mediaService.resolveMediaSource(videoSource);

		if (mediaSource && mediaSource.type === "youtube" && !mediaSource.isLive) {
			const tempFilePath = await this.handleDownload(message, videoSource, title);
			if (tempFilePath) {
				return { inputForFfmpeg: tempFilePath, tempFilePath };
			}
			throw new Error("Failed to prepare video source due to download failure.");
		}

		if (mediaSource && mediaSource.url) {
			return {
				inputForFfmpeg: mediaSource.url,
				audioForFfmpeg: mediaSource.audioUrl || audioSource,
				tempFilePath: null
			};
		}

		if (videoSource.includes("youtube.com/") || videoSource.includes("youtu.be/")) {
			throw new Error("Không thể trích xuất luồng video/live từ YouTube. Vui lòng thử lại với link khác.");
		}

		return {
			inputForFfmpeg: videoSource,
			audioForFfmpeg: audioSource,
			tempFilePath: null
		};
	}

	private async finalizeStream(message: Message | undefined, tempFile: string | null): Promise<void> {
		if (this.streamStatus.manualStop) {
			logger.info("Stream playback stopped manually by user/command.");
			this.queueService.setPlaying(false);
			this.queueService.resetCurrentIndex();
			this.syncQueueStatus();
			await this.cleanupStreamStatus();
		} else {
			// Stream ended naturally or encountered an unexpected interruption/error.
			// Advance queue or loop for 24/7 continuous stream farm.
			await this.handleQueueAdvancement(message);
		}

		if (tempFile && fs.existsSync(tempFile) && path.basename(tempFile).startsWith("ytdlp_temp_")) {
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
		videoParams?: { width: number; height: number; fps?: number; bitrate?: number },
		audioSource?: string
	): Promise<void> {
		const [guildId, channelId] = [config.guildId, config.videoChannelId];
		this.streamStatus.manualStop = false;

		if (!this.streamer.client.user || !this.streamer.client.isReady()) {
			throw new Error("Tài khoản phát Stream chính chưa kết nối Discord (Token 1 không hợp lệ hoặc đã hết hạn).");
		}
		if (!guildId || !channelId) {
			throw new Error("Chưa cấu hình Server ID hoặc Voice Channel ID hợp lệ trong Cài đặt Stream.");
		}

		if (title) {
			const currentQueueItem = this.queueService.getCurrent();
			if (currentQueueItem?.title === title) {
				this.queueService.setPlaying(true);
				this.syncQueueStatus();
			}
		}

		let tempFile: string | null = null;
		try {
			const { inputForFfmpeg, audioForFfmpeg, tempFilePath } = await this.prepareVideoSource(message, videoSource, title, audioSource);
			tempFile = tempFilePath;

			await this.ensureVoiceConnection(guildId, channelId, title);
			await DiscordUtils.sendPlaying(message, title || videoSource);

			if (this.viewerService && config.viewerAutoWatch && this.viewerService.isConfigured()) {
				const streamerId = this.streamer.client.user?.id;
				if (streamerId) {
					setTimeout(() => {
						if (!this.streamStatus.manualStop && this.viewerService && !this.viewerService.getFarmStats().isWatching) {
							logger.info("[Viewer Farm] Fallback trigger: starting stream watcher...");
							void this.viewerService.watchStream(guildId, channelId, streamerId);
						}
					}, 4000);
				}
			}

			const streamOpts = this.setupStreamConfiguration(inputForFfmpeg, videoParams);
			this.controller = new AbortController();
			await this.executeStream(inputForFfmpeg, streamOpts, message, title || videoSource, videoSource, audioForFfmpeg);
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
		if (this.isCleaningUp) return;
		this.isCleaningUp = true;
		try {
			this.controller?.abort();
			this.streamer.stopStream();

			if (this.viewerService) {
				this.viewerService.stopWatching(forceLeave);
			}

			if (forceLeave) {
				this.streamer.leaveVoice();
				const targetGuild = this.streamStatus.channelInfo.guildId || config.guildId;
				if (targetGuild && (this.streamer.client as any)?.ws?.broadcast) {
					try {
						(this.streamer.client as any).ws.broadcast({
							op: 4,
							d: {
								guild_id: targetGuild,
								channel_id: null,
								self_mute: false,
								self_deaf: false,
								self_video: false
							}
						});
					} catch {}
				}
				this.streamStatus.joined = false;
				this.streamStatus.joinsucc = false;
				this.streamStatus.channelInfo = {
					guildId: config.guildId,
					channelId: config.videoChannelId,
					cmdChannelId: config.cmdChannelId
				};
			}

			try {
			this.streamer.client.user?.presence.set({ activities: [], status: "online" });
		} catch {}

			this.streamStatus.playing = false;
			this.streamStatus.manualStop = false;
			this.syncQueueStatus();
		} catch (error) {
			await ErrorUtils.handleError(error, "cleanup stream status");
		} finally {
			this.isCleaningUp = false;
		}
	}

	public async stopAndClearQueue(message?: Message): Promise<boolean> {
		this.isVoiceActionInProgress = false;

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
