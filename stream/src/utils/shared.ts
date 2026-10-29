import { Message, ActivityOptions } from "discord.js-selfbot-v13";
import config from "../config.js";
import logger from "./logger.js";
import fs from "fs";

export const DiscordUtils = {
	status_idle(): ActivityOptions {
		return {
			name: `${config.prefix}help`,
			type: "WATCHING"
		};
	},

	status_watch(name: string): ActivityOptions {
		return {
			name,
			type: "WATCHING"
		};
	},

	async sendError(message?: Message, error?: string): Promise<void> {
		if (!message || !error) return;
		await message.react("❌").catch(() => {});
		await message.reply(`❌ **Error**: ${error}`).catch(() => {});
	},

	async sendSuccess(message?: Message, description?: string): Promise<void> {
		if (!message || !description) return;
		await message.react("✅").catch(() => {});
		await message.channel.send(`✅ **Success**: ${description}`).catch(() => {});
	},

	async sendInfo(message?: Message, title?: string, description?: string): Promise<void> {
		if (!message || !title || !description) return;
		await message.react("ℹ️").catch(() => {});
		await message.channel.send(`ℹ️ **${title}**: ${description}`).catch(() => {});
	},

	async sendPlaying(message?: Message, title?: string): Promise<void> {
		if (!message || !title) return;
		await Promise.all([
			message.react("▶️").catch(() => {}),
			message.reply(`📽 **Now Playing**: \`${title}\``).catch(() => {})
		]);
	},

	async sendFinishMessage(message?: Message): Promise<void> {
		if (!message) return;
		await message.channel.send("⏹️ **Finished**: Finished playing video.").catch(() => {});
	},

	async sendList(message?: Message, items?: string[], type?: string): Promise<void> {
		if (!message || !items) return;
		await message.react("📋").catch(() => {});
		if (type === "ytsearch") {
			await message.reply(`📋 **Search Results**:\n${items.join("\n")}`).catch(() => {});
		} else if (type === "refresh") {
			await message.reply(`📋 **Video list refreshed**:\n${items.join("\n")}`).catch(() => {});
		} else {
			await message.channel.send(`📋 **Local Videos List**:\n${items.join("\n")}`).catch(() => {});
		}
	}
};

export const ErrorUtils = {
	async handleError(error: unknown, context: string, message?: Message): Promise<void> {
		const errorMessage = error instanceof Error ? error.message : String(error);
		const stack = error instanceof Error ? error.stack : undefined;
		logger.error(`Error in ${context}: ${stack || errorMessage}`);

		if (message) {
			await DiscordUtils.sendError(message, `An error occurred: ${errorMessage}`);
		}
	},

	async withErrorHandling<T>(
		operation: () => Promise<T>,
		context: string,
		message?: Message
	): Promise<T | null> {
		try {
			return await operation();
		} catch (error) {
			await this.handleError(error, context, message);
			return null;
		}
	}
};

export const GeneralUtils = {
	isValidUrl(input: string): boolean {
		if (!input || typeof input !== "string") {
			return false;
		}

		return (
			input.includes("youtube.com/") ||
			input.includes("youtu.be/") ||
			input.includes("twitch.tv/") ||
			input.startsWith("http://") ||
			input.startsWith("https://")
		);
	},

	isLocalFile(filePath: string): boolean {
		try {
			if (!filePath || typeof filePath !== "string") return false;
			if (filePath.startsWith("http://") || filePath.startsWith("https://")) return false;
			return fs.existsSync(filePath) && fs.lstatSync(filePath).isFile();
		} catch {
			return false;
		}
	}
};
