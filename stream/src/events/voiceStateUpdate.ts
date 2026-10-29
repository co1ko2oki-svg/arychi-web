import { VoiceState, Client } from "discord.js-selfbot-v13";
import logger from "../utils/logger.js";
import { StreamStatus, IStreamingService } from "../types/index.js";

export async function handleVoiceStateUpdate(
	oldState: VoiceState,
	newState: VoiceState,
	streamStatus: StreamStatus,
	client: Client,
	streamingService: IStreamingService
): Promise<void> {
	const currentUserId = client.user?.id;
	if (!currentUserId) return;

	if (oldState.member?.user.id === currentUserId && oldState.channelId && !newState.channelId) {
		logger.info("Bot was disconnected from voice channel, terminating active stream and cleaning up...");
		await streamingService.cleanupStreamStatus(true);
		return;
	}

	if (
		oldState.member?.user.id === currentUserId &&
		oldState.channelId &&
		newState.channelId &&
		oldState.channelId !== newState.channelId
	) {
		logger.info(`Bot voice channel moved: ${oldState.channelId} -> ${newState.channelId}`);
		await streamingService.handleChannelMove(newState.channelId);
		return;
	}

	if (newState.member?.user.id === currentUserId && newState.channelId && !oldState.channelId) {
		streamStatus.joined = true;
		if (
			newState.guild.id === streamStatus.channelInfo.guildId &&
			newState.channelId === streamStatus.channelInfo.channelId
		) {
			streamStatus.joinsucc = true;
		}
	}
}
