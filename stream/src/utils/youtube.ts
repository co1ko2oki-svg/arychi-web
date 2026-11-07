import ytdl_dlp from "./yt-dlp.js";
import logger from "./logger.js";
import yts from "play-dl";
import { YouTubeVideo, YTResponse } from "../types/index.js";

export class Youtube {
	async getVideoInfo(url: string): Promise<YouTubeVideo | null> {
		try {
			const videoData = (await ytdl_dlp(url, { dumpSingleJson: true, noPlaylist: true })) as YTResponse;

			if (videoData && typeof videoData === "object" && videoData.id && videoData.title) {
				return {
					id: videoData.id,
					title: videoData.title,
					formats: [],
					videoDetails: {
						isLiveContent: videoData.is_live === true || videoData.live_status === "is_live"
					}
				};
			}

			logger.warn(`Failed to parse video info from yt-dlp for URL: ${url}`);
			return null;
		} catch (error) {
			logger.error(`Failed to get video info using yt-dlp for URL ${url}:`, error);
			return null;
		}
	}

	async searchAndGetPageUrl(title: string): Promise<{ pageUrl: string | null; title: string | null }> {
		try {
			const results = await yts.search(title, { limit: 1 });
			if (results.length === 0 || !results[0]?.url) {
				logger.warn(`No video found on YouTube for title: "${title}"`);
				return { pageUrl: null, title: null };
			}

			return { pageUrl: results[0].url, title: results[0].title || null };
		} catch (error) {
			logger.error(`Video search for page URL failed for title "${title}":`, error);
			return { pageUrl: null, title: null };
		}
	}

	async search(query: string, limit: number = 5): Promise<string[]> {
		try {
			const searchResults = await yts.search(query, { limit });
			return searchResults.map((video, index) => `${index + 1}. \`${video.title}\``);
		} catch {
			logger.warn(`No videos found with query: "${query}"`);
			return [];
		}
	}

	async getLiveStreamUrls(youtubePageUrl: string): Promise<{ videoUrl: string; audioUrl?: string } | null> {
		try {
			const streamUrl = await ytdl_dlp(youtubePageUrl, {
				getUrl: true,
				noPlaylist: true,
				quiet: true
			});

			if (typeof streamUrl === "string" && streamUrl.trim()) {
				const lines = streamUrl.trim().split(/\r?\n/).filter(Boolean);
				if (lines.length >= 2) {
					logger.info(`Resolved dual-stream (video + audio) live URLs for ${youtubePageUrl}`);
					return {
						videoUrl: lines[0].trim(),
						audioUrl: lines[1].trim()
					};
				}
				const targetUrl = lines.find(l => l.includes(".m3u8")) || lines[0];
				logger.info(`Resolved live stream URL for ${youtubePageUrl}`);
				return { videoUrl: targetUrl.trim() };
			}

			logger.warn(`yt-dlp did not return a valid live stream URL for: ${youtubePageUrl}`);
			return null;
		} catch (error) {
			logger.error(`Failed to get live stream URL using yt-dlp for ${youtubePageUrl}:`, error);
			return null;
		}
	}

	async getLiveStreamUrl(youtubePageUrl: string): Promise<string | null> {
		const res = await this.getLiveStreamUrls(youtubePageUrl);
		return res ? res.videoUrl : null;
	}
}
