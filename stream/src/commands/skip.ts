import { BaseCommand } from "./base.js";
import { CommandContext } from "../types/index.js";

export default class SkipCommand extends BaseCommand {
	name = "skip";
	description = "Skip the currently playing video";
	usage = "skip";
	aliases = ["next"];

	async execute(context: CommandContext): Promise<void> {
		if (!context.streamStatus.playing) {
			await this.sendError(context.message, "No video is currently playing.");
			return;
		}

		await context.streamingService.skipCurrent(context.message);
	}
}
