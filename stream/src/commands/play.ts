import fs from "fs";
import path from "path";
import { BaseCommand } from "./base.js";
import { CommandContext, Video } from "../types/index.js";
import { ErrorUtils, GeneralUtils } from "../utils/shared.js";
import config from "../config.js";

export default class PlayCommand extends BaseCommand {
	name = "play";
	description = "Play local video, URL, or search YouTube videos";
	usage = "play <video_name|url|search_query>";

	async execute(context: CommandContext): Promise<void> {
		const input = context.args.join(" ").trim();

		if (!input) {
			await this.sendError(context.message, "Please provide a video name, URL, or search query.");
			return;
		}

		if (GeneralUtils.isValidUrl(input)) {
			await this.handleUrl(context, input);
			return;
		}

		if (fs.existsSync(config.videosDir)) {
			const videoFiles = fs.readdirSync(config.videosDir);
			const refreshedVideos = videoFiles.map(file => ({
				name: path.parse(file).name,
				path: path.join(config.videosDir, file)
			}));
			context.videos.length = 0;
			context.videos.push(...refreshedVideos);
		}

		const matchedVideo = context.videos.find(m => m.name.toLowerCase() === input.toLowerCase());
		if (matchedVideo) {
			await this.handleLocalVideo(context, matchedVideo);
		} else {
			await this.handleSearchQuery(context, input);
		}
	}

	private async handleLocalVideo(context: CommandContext, video: Video): Promise<void> {
		const success = await context.streamingService.addToQueue(context.message, video.path, video.name);
		if (success && !context.streamStatus.playing) {
			await context.streamingService.playFromQueue(context.message);
		}
	}

	private async handleUrl(context: CommandContext, url: string): Promise<void> {
		try {
			const success = await context.streamingService.addToQueue(context.message, url);
			if (success && !context.streamStatus.playing) {
				await context.streamingService.playFromQueue(context.message);
			}
		} catch (error) {
			await ErrorUtils.handleError(error, `processing URL: ${url}`, context.message);
		}
	}

	private async handleSearchQuery(context: CommandContext, query: string): Promise<void> {
		try {
			const success = await context.streamingService.addToQueue(context.message, query, `Search: ${query}`);
			if (success && !context.streamStatus.playing) {
				await context.streamingService.playFromQueue(context.message);
			}
		} catch (error) {
			await ErrorUtils.handleError(error, "adding search query to queue", context.message);
		}
	}
}
