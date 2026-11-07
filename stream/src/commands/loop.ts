import { BaseCommand } from "./base.js";
import { CommandContext } from "../types/index.js";

export default class LoopCommand extends BaseCommand {
	name = "loop";
	description = "Toggle endless stream loop mode for AFK farming";
	usage = "loop [on|off]";
	aliases = ["repeat"];

	async execute(context: CommandContext): Promise<void> {
		const arg = context.args[0]?.toLowerCase();
		let newLoopState = !context.streamingService.isLoopActive();

		if (arg === "on" || arg === "true" || arg === "1") {
			newLoopState = true;
		} else if (arg === "off" || arg === "false" || arg === "0") {
			newLoopState = false;
		}

		context.streamingService.setLoop(newLoopState);
		await this.sendSuccess(
			context.message,
			`Stream loop mode is now **${newLoopState ? "ENABLED (Will repeat videos endlessly)" : "DISABLED"}**.`
		);
	}
}
