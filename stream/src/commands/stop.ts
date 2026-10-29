import { BaseCommand } from "./base.js";
import { CommandContext } from "../types/index.js";
import logger from "../utils/logger.js";
import { ErrorUtils } from "../utils/shared.js";

export default class StopCommand extends BaseCommand {
	name = "stop";
	description = "Stop current video playback and clear queue";
	usage = "stop";
	aliases = ["leave", "s"];

	async execute(context: CommandContext): Promise<void> {
		if (!context.streamStatus.joined) {
			await this.sendError(context.message, "**Already Stopped!**");
			return;
		}

		try {
			context.streamStatus.manualStop = true;
			const stopped = await context.streamingService.stopAndClearQueue(context.message);
			if (stopped) {
				await this.sendSuccess(context.message, "Stopped playing video and cleared queue.");
				logger.info("Stopped playing video and cleared queue.");
			}
		} catch (error) {
			await ErrorUtils.handleError(error, "stopping video playback", context.message);
		}
	}
}
