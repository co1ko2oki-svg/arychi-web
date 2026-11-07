import { BaseCommand } from "./base.js";
import { CommandContext } from "../types/index.js";
import { ViewerService } from "../services/viewer.js";
import config from "../config.js";

export default class FarmCommand extends BaseCommand {
	name = "farm";
	description = "Stream farming & badge watcher controls";
	usage = "farm [status|loop|watch|stop]";
	aliases = ["badge", "watcher"];

	async execute(context: CommandContext): Promise<void> {
		const subCommand = (context.args[0] || "status").toLowerCase();
		const viewerService = (context.streamingService as { getViewerService?: () => ViewerService | undefined }).getViewerService?.();

		switch (subCommand) {
			case "status": {
				await this.showStatus(context, viewerService);
				break;
			}

			case "loop": {
				const arg = context.args[1]?.toLowerCase();
				let newLoopState = !context.streamingService.isLoopActive();
				if (arg === "on" || arg === "true" || arg === "1") {
					newLoopState = true;
				} else if (arg === "off" || arg === "false" || arg === "0") {
					newLoopState = false;
				}

				context.streamingService.setLoop(newLoopState);
				await this.sendSuccess(
					context.message,
					`Stream loop mode for AFK farming is now **${newLoopState ? "ENABLED (Endless stream)" : "DISABLED"}**.`
				);
				break;
			}

			case "watch": {
				if (!viewerService || !viewerService.isConfigured()) {
					await this.sendError(
						context.message,
						"Viewer token is not configured. Add `VIEWER_TOKEN` in `.env` to enable stream watching."
					);
					return;
				}

				if (!context.streamStatus.playing || !context.streamStatus.joined) {
					await this.sendError(
						context.message,
						"Streamer is not currently streaming. Start a stream first with `$play`."
					);
					return;
				}

				const guildId = context.streamStatus.channelInfo.guildId || config.guildId;
				const channelId = context.streamStatus.channelInfo.channelId || config.videoChannelId;
				const streamerId = context.message.client.user?.id;

				if (!guildId || !channelId || !streamerId) {
					await this.sendError(context.message, "Missing stream channel information.");
					return;
				}

				await this.sendInfo(context.message, "Farm Watcher", "Viewer account is connecting to watch stream...");
				const success = await viewerService.watchStream(guildId, channelId, streamerId);
				if (success) {
					await this.sendSuccess(
						context.message,
						"Viewer account is now watching the stream! Stream hours are counting."
					);
				} else {
					await this.sendError(context.message, "Failed to connect viewer account to stream.");
				}
				break;
			}

			case "stop": {
				if (viewerService) {
					viewerService.stopWatching();
					await this.sendSuccess(context.message, "Viewer stopped watching the stream.");
				} else {
					await this.sendError(context.message, "Viewer service is not active.");
				}
				break;
			}

			default:
				await this.sendError(
					context.message,
					`Unknown sub-command: \`${subCommand}\`. Use \`${config.prefix}farm status\`, \`loop\`, \`watch\`, or \`stop\`.`
				);
		}
	}

	private async showStatus(context: CommandContext, viewerService?: ViewerService): Promise<void> {
		const stats = viewerService?.getFarmStats();
		const isConfigured = stats?.isConfigured ?? false;
		const isWatching = stats?.isWatching ?? false;
		const isLooping = context.streamingService.isLoopActive();

		let statusIcon = "🔴 Inactive";
		if (isWatching) {
			statusIcon = "🟢 Actively Watching & Farming";
		} else if (stats?.isOnline) {
			statusIcon = "🟡 Online & Standby (Auto-watch on stream)";
		} else if (!isConfigured) {
			statusIcon = "⚪ Not Configured (Missing VIEWER_TOKEN in .env)";
		}

		const lines = [
			"🌾 **Discord Stream Farming & Badge Status**",
			"",
			`• **Watcher Status**: ${statusIcon}`,
			`• **Viewer Account**: \`${stats?.viewerTag || "None"}\``,
			`• **Current Session**: \`${stats?.formattedSessionTime || "0m 0s"}\``,
			`• **Total Farmed Time**: \`${stats?.formattedTotalTime || "0m 0s"}\``,
			`• **Endless Loop Mode**: **${isLooping ? "ON (24/7 AFK Farm)" : "OFF"}**`,
			`• **Streamer State**: ${context.streamStatus.playing ? "🎬 Streaming" : "⏹️ Idle"}`,
			"",
			`*Tip: Use \`${config.prefix}farm loop on\` to loop playback endlessly for overnight farming.*`
		];

		await this.sendInfo(context.message, "Stream Farm", lines.join("\n"));
	}
}
