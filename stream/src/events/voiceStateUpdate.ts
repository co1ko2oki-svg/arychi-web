import { VoiceState, Client } from "discord.js-selfbot-v13";
import logger from "../utils/logger.js";
import { StreamStatus, IStreamingService } from "../types/index.js";

let isDisconnecting = false;

export async function handleVoiceStateUpdate(
	oldState: VoiceState,
	newState: VoiceState,
	streamStatus: StreamStatus,
	client: Client,
	streamingService: IStreamingService
): Promise<void> {
	const currentUserId = client.user?.id;
	if (!currentUserId) return;

	const targetUserId = newState.member?.user?.id || newState.id || oldState.member?.user?.id || oldState.id;
	if (targetUserId !== currentUserId) return;

	if (oldState.channelId && !newState.channelId) {
		if (isDisconnecting || !streamStatus.joined) {
			return;
		}
		isDisconnecting = true;
		try {
			const shouldAutoReconnect = !streamStatus.manualStop && streamStatus.isLooping;
			logger.info("Streamer bot disconnected from voice channel, cleaning up active stream...");
			await streamingService.cleanupStreamStatus(true);

			if (shouldAutoReconnect) {
				logger.info("[Auto-Reconnect] Streamer disconnected unexpectedly during endless farm. Reconnecting in 5s...");
				setTimeout(async () => {
					if (!streamStatus.manualStop && !streamStatus.playing) {
						try {
							logger.info("[Auto-Reconnect] Resuming stream from queue...");
							await streamingService.playFromQueue();
						} catch (reconnectErr) {
							logger.error("[Auto-Reconnect] Failed to auto-reconnect:", reconnectErr);
						}
					}
				}, 5000);
			}
		} finally {
			setTimeout(() => {
				isDisconnecting = false;
			}, 2000);
		}
		return;
	}

	if (
		oldState.channelId &&
		newState.channelId &&
		oldState.channelId !== newState.channelId
	) {
		logger.info(`Bot voice channel moved: ${oldState.channelId} -> ${newState.channelId}`);
		await streamingService.handleChannelMove(newState.channelId);
		return;
	}

	if (newState.channelId && !oldState.channelId) {
		streamStatus.joined = true;
		if (
			newState.guild.id === streamStatus.channelInfo.guildId &&
			newState.channelId === streamStatus.channelInfo.channelId
		) {
			streamStatus.joinsucc = true;
		}
	}
}
