import path from "path";
import { MessageAttachment } from "discord.js-selfbot-v13";
import { BaseCommand } from "./base.js";
import { CommandContext } from "../types/index.js";
import { ffmpegScreenshot } from "../utils/ffmpeg.js";
import logger from "../utils/logger.js";

export default class PreviewCommand extends BaseCommand {
	name = "preview";
	description = "Generate preview thumbnails for a video";
	usage = "preview <video_name>";

	async execute(context: CommandContext): Promise<void> {
		const targetName = context.args.join(" ").trim();

		if (!targetName) {
			await this.sendError(context.message, "Please provide a video name.");
			return;
		}

		const matchedVideo = context.videos.find(m => m.name.toLowerCase() === targetName.toLowerCase());
		if (!matchedVideo) {
			await this.sendError(context.message, "Video not found.");
			return;
		}

		await context.message.react("📸").catch(() => {});
		await context.message.reply("📸 **Generating preview thumbnails...**");

		try {
			const videoFilename = path.basename(matchedVideo.path);
			const thumbnails = await ffmpegScreenshot(videoFilename);

			if (thumbnails.length > 0) {
				const attachments = thumbnails.map(p => new MessageAttachment(p));
				await context.message.reply({
					content: `📸 **Preview**: \`${matchedVideo.name}\``,
					files: attachments
				});
			} else {
				await this.sendError(context.message, "Failed to generate preview thumbnails.");
			}
		} catch (error) {
			logger.error("Error generating preview thumbnails:", error);
			await this.sendError(context.message, "Failed to generate preview thumbnails.");
		}
	}
}
