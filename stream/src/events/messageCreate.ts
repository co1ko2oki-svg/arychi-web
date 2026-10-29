import { Message } from "discord.js-selfbot-v13";
import { CommandManager } from "../commands/manager.js";
import { CommandContext, Video, StreamStatus, IStreamingService } from "../types/index.js";
import config from "../config.js";

export async function handleMessageCreate(
	message: Message,
	videos: Video[],
	streamStatus: StreamStatus,
	streamingService: IStreamingService,
	commandManager: CommandManager
): Promise<void> {
	if (
		message.author.bot ||
		message.author.id === message.client.user?.id ||
		!message.content.startsWith(config.prefix)
	) {
		return;
	}

	if (config.cmdChannelId && message.channel.id !== config.cmdChannelId) {
		return;
	}

	const args = message.content.slice(config.prefix.length).trim().split(/\s+/);
	if (args.length === 0 || !args[0]) {
		return;
	}

	const commandName = args.shift()!.toLowerCase();

	const context: CommandContext = {
		message,
		args,
		videos,
		streamStatus,
		streamingService
	};

	const executed = await commandManager.executeCommand(commandName, context);
	if (!executed) {
		await message.react("❌").catch(() => {});
		await message.reply(`❌ **Error**: Unknown command. Use \`${config.prefix}help\` to see available commands.`);
	}
}
