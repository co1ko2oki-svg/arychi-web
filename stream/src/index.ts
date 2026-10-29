if (!(Promise as unknown as { withResolvers?: unknown }).withResolvers) {
	(Promise as unknown as { withResolvers: <T>() => { promise: Promise<T>; resolve: (value: T | PromiseLike<T>) => void; reject: (reason?: unknown) => void } }).withResolvers = function <T>() {
		let resolve!: (value: T | PromiseLike<T>) => void;
		let reject!: (reason?: unknown) => void;
		const promise = new Promise<T>((res, rej) => {
			resolve = res;
			reject = rej;
		});
		return { promise, resolve, reject };
	};
}

import fs from "fs";
import path from "path";
import { Client } from "discord.js-selfbot-v13";
import config from "./config.js";
import logger from "./utils/logger.js";
import { downloadExecutable, checkForUpdatesAndUpdate } from "./utils/yt-dlp.js";
import { handleReady } from "./events/client/ready.js";
import { handleMessageCreate } from "./events/messageCreate.js";
import { handleVoiceStateUpdate } from "./events/voiceStateUpdate.js";
import { StreamingService } from "./services/streaming.js";
import { CommandManager } from "./commands/manager.js";
import { QueueService } from "./services/queue.js";
import { ViewerService } from "./services/viewer.js";
import { StreamStatus, Video } from "./types/index.js";
import { startServer } from "./server/index.js";

void (async () => {
	try {
		await downloadExecutable();
		await checkForUpdatesAndUpdate();
	} catch (error) {
		logger.error("Error during initial yt-dlp setup/update:", error);
	}
})();

const client = new Client();
const queueService = new QueueService();
const viewerService = new ViewerService();

void viewerService.start();

const streamStatus: StreamStatus = {
	joined: false,
	joinsucc: false,
	playing: false,
	manualStop: false,
	isLooping: config.streamLoop,
	channelInfo: {
		guildId: config.guildId,
		channelId: config.videoChannelId,
		cmdChannelId: config.cmdChannelId
	},
	queue: queueService.getQueueStatus()
};

const streamingService = new StreamingService(client, streamStatus, queueService, viewerService);
const commandManager = new CommandManager();

if (!fs.existsSync(config.videosDir)) {
	fs.mkdirSync(config.videosDir, { recursive: true });
}

if (!fs.existsSync(config.previewCacheDir)) {
	fs.mkdirSync(config.previewCacheDir, { recursive: true });
}

const videoFiles = fs.existsSync(config.videosDir) ? fs.readdirSync(config.videosDir) : [];
const videos: Video[] = videoFiles.map(file => ({
	name: path.parse(file).name,
	path: path.join(config.videosDir, file)
}));

if (videos.length > 0) {
	logger.info(`Available videos:\n${videos.map(m => m.name).join("\n")}`);
}

if (config.serverEnabled) {
	try {
		startServer(client, streamStatus, streamingService, queueService, viewerService);
	} catch (serverError) {
		logger.error("Failed to start Web API server:", serverError);
	}
}

client.on("ready", async () => {
	await handleReady(client);
});

client.on("voiceStateUpdate", async (oldState, newState) => {
	await handleVoiceStateUpdate(oldState, newState, streamStatus, client, streamingService);
});

client.on("messageCreate", async (message) => {
	await handleMessageCreate(message, videos, streamStatus, streamingService, commandManager);
});

process.on("uncaughtException", (error) => {
	if (error instanceof Error && error.message.includes("SIGTERM")) {
		return;
	}
	logger.error("Uncaught Exception:", error);
});

if (config.token && config.token.trim().length > 10) {
	client.login(config.token).catch((err) => {
		logger.warn(`Could not login to Discord: ${err?.message || err}. Web API server remains active.`);
	});
} else {
	logger.info(`Discord token not provided in stream/.env. Running Web API & Standby mode on port ${config.serverPort}.`);
}
