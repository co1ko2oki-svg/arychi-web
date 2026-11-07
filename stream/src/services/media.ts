import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getStream, getVod } from "twitch-m3u8";
import { TwitchStream, MediaSource, YTResponse } from "../types/index.js";
import config from "../config.js";
import logger from "../utils/logger.js";
import { Youtube } from "../utils/youtube.js";
import ytdl, { downloadToTempFile } from "../utils/yt-dlp.js";
import { GeneralUtils } from "../utils/shared.js";

export class MediaService {
	private youtube: Youtube;

	constructor() {
		this.youtube = new Youtube();
	}

	public async resolveMediaSource(url: string): Promise<MediaSource | null> {
		try {
			if (url.includes("youtube.com/") || url.includes("youtu.be/")) {
				return await this._resolveYouTubeSource(url);
			}
			if (url.includes("twitch.tv/")) {
				return await this._resolveTwitchSource(url);
			}
			if (GeneralUtils.isLocalFile(url)) {
				return this._resolveLocalSource(url);
			}
			if (GeneralUtils.isValidUrl(url)) {
				return await this._resolveDirectUrlSource(url);
			}
			return await this.searchAndPlayYouTube(url);
		} catch (error) {
			logger.error("Failed to resolve media source:", error);
			return null;
		}
	}

	private async _resolveYouTubeSource(url: string): Promise<MediaSource | null> {
		const videoDetails = await this.youtube.getVideoInfo(url);
		if (!videoDetails) return null;

		const isLive = videoDetails.videoDetails?.isLiveContent || false;
		if (isLive) {
			const liveStream = await this.youtube.getLiveStreamUrls(url);
			if (liveStream) {
				return {
					url: liveStream.videoUrl,
					audioUrl: liveStream.audioUrl,
					title: videoDetails.title,
					type: "youtube",
					isLive: true
				};
			}
			return null;
		}

		return {
			url,
			title: videoDetails.title,
			type: "youtube",
			isLive: false
		};
	}

	public async getTwitchStreamUrl(url: string): Promise<string | null> {
		try {
			if (url.includes("/videos/")) {
				const vodId = url.split("/videos/").pop() as string;
				const vodInfo = await getVod(vodId);
				const targetResolution = `${config.width}x${config.height}`;
				const vod = vodInfo.find((s: TwitchStream) => s.resolution === targetResolution) || vodInfo[0];
				if (vod?.url) {
					return vod.url;
				}
				logger.error("No VOD URL found for Twitch video");
				return null;
			}

			const twitchId = url.split("/").pop() as string;
			const streams = await getStream(twitchId);
			const targetResolution = `${config.width}x${config.height}`;
			const stream = streams.find((s: TwitchStream) => s.resolution === targetResolution) || streams[0];
			if (stream?.url) {
				return stream.url;
			}
			logger.error("No stream URL found for Twitch channel");
			return null;
		} catch (error) {
			logger.error("Failed to get Twitch stream URL:", error);
			return null;
		}
	}

	public async downloadYouTubeVideo(url: string): Promise<string | null> {
		try {
			const videoIdMatch = url.match(/(?:v=|youtu\.be\/)([^&]+)/);
			const videoId = videoIdMatch ? videoIdMatch[1] : crypto.randomBytes(6).toString("hex");

			const cachedFilePath = path.join(config.videosDir, `${videoId}.mp4`);
			if (fs.existsSync(cachedFilePath)) {
				logger.info(`Found cached video: ${cachedFilePath}`);
				return cachedFilePath;
			}

			const ytDlpDownloadOptions = {
				format: `bestvideo[height<=${config.height || 720}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=${config.height || 720}]+bestaudio/best[height<=${config.height || 720}]/best`,
				noPlaylist: true,
				concurrentFragments: 5
			};

			return await downloadToTempFile(url, ytDlpDownloadOptions, cachedFilePath);
		} catch (error) {
			logger.error("Failed to download YouTube video:", error);
			return null;
		}
	}

	private async _resolveTwitchSource(url: string): Promise<MediaSource | null> {
		const streamUrl = await this.getTwitchStreamUrl(url);
		if (streamUrl) {
			const twitchId = url.split("/").pop() as string;
			return {
				url: streamUrl,
				title: `twitch.tv/${twitchId}`,
				type: "twitch"
			};
		}
		return null;
	}

	private _resolveLocalSource(url: string): MediaSource {
		return {
			url,
			title: path.basename(url, path.extname(url)),
			type: "local"
		};
	}

	private async _resolveDirectUrlSource(url: string): Promise<MediaSource> {
		try {
			const metadata = (await ytdl(url, {
				dumpJson: true,
				skipDownload: true,
				noWarnings: true,
				quiet: true
			})) as YTResponse;

			if (metadata && metadata.title) {
				let streamUrl = url;
				if (Array.isArray(metadata.formats) && metadata.formats.length > 0) {
					const bestFormat = metadata.formats
						.filter(format => format.url && format.ext !== "m3u8")
						.sort((a, b) => {
							const aScore = (a.vcodec && a.vcodec !== "none" ? 1 : 0) + (a.acodec && a.acodec !== "none" ? 1 : 0) + (a.height || 0) / 1000;
							const bScore = (b.vcodec && b.vcodec !== "none" ? 1 : 0) + (b.acodec && b.acodec !== "none" ? 1 : 0) + (b.height || 0) / 1000;
							return bScore - aScore;
						})[0];

					if (bestFormat?.url) {
						streamUrl = bestFormat.url;
					}
				}

				return {
					url: streamUrl,
					title: metadata.title,
					type: "url"
				};
			}
		} catch (error) {
			logger.debug("yt-dlp metadata extraction failed for URL, falling back to URL parsing:", error);
		}

		let title = "Direct URL";
		try {
			const urlObj = new URL(url);
			const pathname = urlObj.pathname;
			const lastSegment = pathname.split("/").filter(Boolean).pop();

			if (lastSegment) {
				const decoded = decodeURIComponent(lastSegment);
				title = decoded.includes(".") ? decoded.replace(/\.[^/.]+$/, "") : decoded;
			}
		} catch {
			logger.debug(`Could not parse URL for title extraction: ${url}`);
		}

		return {
			url,
			title,
			type: "url"
		};
	}

	public async searchYouTube(query: string, limit: number = 5): Promise<string[]> {
		try {
			return await this.youtube.search(query, limit);
		} catch (error) {
			logger.error("Failed to search YouTube:", error);
			return [];
		}
	}

	public async searchAndPlayYouTube(query: string): Promise<MediaSource | null> {
		try {
			const searchResult = await this.youtube.searchAndGetPageUrl(query);
			if (searchResult.pageUrl && searchResult.title) {
				return {
					url: searchResult.pageUrl,
					title: searchResult.title,
					type: "youtube"
				};
			}
			return null;
		} catch (error) {
			logger.error("Failed to search and play YouTube:", error);
			return null;
		}
	}
}
