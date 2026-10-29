import http from "http";
import path from "path";
import fs from "fs";
import express, { Request, Response, NextFunction } from "express";
import multer from "multer";
import { WebSocketServer, WebSocket } from "ws";
import { Client } from "discord.js-selfbot-v13";
import config, { parseVideoCodec, parsePreset, parseBoolean } from "../config.js";
import logger, { logBuffer, logEmitter, LogEntry } from "../utils/logger.js";
import { StreamingService } from "../services/streaming.js";
import { QueueService } from "../services/queue.js";
import { ViewerService } from "../services/viewer.js";
import { StreamStatus, SupportedVideoCodec, H26xPreset } from "../types/index.js";
import { ffmpegScreenshot, getVideoParams } from "../utils/ffmpeg.js";
import { GeneralUtils } from "../utils/shared.js";
import { exec as ytdlExec } from "../utils/yt-dlp.js";

function getParam(param: string | string[] | undefined): string {
	if (!param) return "";
	return Array.isArray(param) ? param[0] : param;
}

function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 Bytes";
	const k = 1024;
	const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function startServer(
	client: Client,
	streamStatus: StreamStatus,
	streamingService: StreamingService,
	queueService: QueueService,
	viewerService: ViewerService
): http.Server {
	const app = express();
	const server = http.createServer(app);
	const wss = new WebSocketServer({ server, path: "/ws" });

	app.use((_req: Request, res: Response, next: NextFunction) => {
		res.header("Access-Control-Allow-Origin", "*");
		res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
		res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
		if (_req.method === "OPTIONS") {
			res.sendStatus(200);
			return;
		}
		next();
	});

	app.use(express.json());
	app.use(express.urlencoded({ extended: true }));

	const storage = multer.diskStorage({
		destination: (_req, _file, cb) => {
			if (!fs.existsSync(config.videosDir)) {
				fs.mkdirSync(config.videosDir, { recursive: true });
			}
			cb(null, config.videosDir);
		},
		filename: (_req, file, cb) => {
			const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
			cb(null, safeName);
		}
	});
	const upload = multer({ storage });

	const getFullStatus = () => {
		const farmStats = viewerService.getFarmStats();
		return {
			bot: {
				tag: client.user?.tag || "Not Logged In",
				id: client.user?.id || "",
				isReady: client.isReady(),
				ping: client.ws?.ping ?? -1
			},
			stream: {
				joined: streamStatus.joined,
				playing: streamStatus.playing,
				isLooping: streamingService.isLoopActive(),
				channelInfo: streamStatus.channelInfo,
				currentQueueItem: queueService.getCurrent()
			},
			farm: {
				...farmStats,
				autoWatch: config.viewerAutoWatch
			},
			queue: queueService.getQueueStatus(),
			config: {
				guildId: config.guildId,
				videoChannelId: config.videoChannelId,
				cmdChannelId: config.cmdChannelId,
				width: config.width,
				height: config.height,
				fps: config.fps,
				bitrateKbps: config.bitrateKbps,
				maxBitrateKbps: config.maxBitrateKbps,
				videoCodec: config.videoCodec,
				h26xPreset: config.h26xPreset,
				hardwareAcceleration: config.hardwareAcceleratedDecoding,
				streamLoop: config.streamLoop,
				viewerAutoWatch: config.viewerAutoWatch,
				serverPort: config.serverPort
			}
		};
	};

	const broadcast = (data: unknown) => {
		const payload = JSON.stringify(data);
		for (const clientWs of wss.clients) {
			if (clientWs.readyState === WebSocket.OPEN) {
				clientWs.send(payload);
			}
		}
	};

	logEmitter.on("log", (entry: LogEntry) => {
		broadcast({ type: "log", data: entry });
	});

	setInterval(() => {
		if (wss.clients.size > 0) {
			broadcast({ type: "status", data: getFullStatus() });
		}
	}, 3000);

	wss.on("connection", (ws: WebSocket) => {
		ws.send(JSON.stringify({
			type: "init",
			status: getFullStatus(),
			logs: logBuffer.slice(-150)
		}));

		ws.on("message", async (msg: string) => {
			try {
				const parsed = JSON.parse(msg.toString());
				if (parsed.type === "ping") {
					ws.send(JSON.stringify({ type: "pong" }));
				}
			} catch {}
		});
	});

	app.get("/api/status", (_req: Request, res: Response) => {
		res.json(getFullStatus());
	});

	app.post("/api/player/play", async (req: Request, res: Response) => {
		const { source, title } = req.body;
		if (!source || typeof source !== "string") {
			res.status(400).json({ success: false, message: "Missing video source parameter" });
			return;
		}

		try {
			let videoPathOrSource = source.trim();
			let resolvedTitle = title || videoPathOrSource;

			if (fs.existsSync(config.videosDir)) {
				const files = fs.readdirSync(config.videosDir);
				const match = files.find(f => path.parse(f).name.toLowerCase() === videoPathOrSource.toLowerCase() || f.toLowerCase() === videoPathOrSource.toLowerCase());
				if (match) {
					videoPathOrSource = path.join(config.videosDir, match);
					resolvedTitle = path.parse(match).name;
				}
			}

			const added = await streamingService.addToQueue(undefined, videoPathOrSource, resolvedTitle, "Web Dashboard");
			if (!added) {
				res.status(500).json({ success: false, message: "Failed to add source to queue" });
				return;
			}

			if (!streamStatus.playing) {
				void streamingService.playFromQueue(undefined);
			}

			broadcast({ type: "status", data: getFullStatus() });
			res.json({ success: true, message: `Successfully requested: ${resolvedTitle}`, current: queueService.getCurrent() });
		} catch (error) {
			logger.error("[API play error]:", error);
			res.status(500).json({ success: false, message: error instanceof Error ? error.message : String(error) });
		}
	});

	app.post("/api/player/stop", async (_req: Request, res: Response) => {
		try {
			streamStatus.manualStop = true;
			const stopped = await streamingService.stopAndClearQueue(undefined);
			broadcast({ type: "status", data: getFullStatus() });
			res.json({ success: stopped, message: "Stream stopped and queue cleared" });
		} catch (error) {
			logger.error("[API stop error]:", error);
			res.status(500).json({ success: false, message: error instanceof Error ? error.message : String(error) });
		}
	});

	app.post("/api/player/skip", async (_req: Request, res: Response) => {
		try {
			const skipped = await streamingService.skipCurrent(undefined);
			broadcast({ type: "status", data: getFullStatus() });
			res.json({ success: skipped, message: "Skipped to next video" });
		} catch (error) {
			logger.error("[API skip error]:", error);
			res.status(500).json({ success: false, message: error instanceof Error ? error.message : String(error) });
		}
	});

	app.post("/api/player/loop", (req: Request, res: Response) => {
		const { loop } = req.body;
		const newState = typeof loop === "boolean" ? loop : !streamingService.isLoopActive();
		streamingService.setLoop(newState);
		config.streamLoop = newState;
		broadcast({ type: "status", data: getFullStatus() });
		res.json({ success: true, isLooping: newState });
	});

	app.get("/api/queue", (_req: Request, res: Response) => {
		res.json(queueService.getQueueStatus());
	});

	app.post("/api/queue/add", async (req: Request, res: Response) => {
		const { source, title } = req.body;
		if (!source) {
			res.status(400).json({ success: false, message: "Missing source" });
			return;
		}

		const success = await streamingService.addToQueue(undefined, source, title, "Web Dashboard");
		broadcast({ type: "status", data: getFullStatus() });
		res.json({ success, queue: queueService.getQueueStatus() });
	});

	app.delete("/api/queue/:id", (req: Request, res: Response) => {
		const id = getParam(req.params.id);
		const success = queueService.removeFromQueue(id);
		broadcast({ type: "status", data: getFullStatus() });
		res.json({ success, queue: queueService.getQueueStatus() });
	});

	app.delete("/api/queue", (_req: Request, res: Response) => {
		queueService.clearQueue();
		broadcast({ type: "status", data: getFullStatus() });
		res.json({ success: true, queue: queueService.getQueueStatus() });
	});

	app.post("/api/queue/move", (req: Request, res: Response) => {
		const { fromIndex, toIndex } = req.body;
		if (typeof fromIndex !== "number" || typeof toIndex !== "number") {
			res.status(400).json({ success: false, message: "Invalid indices" });
			return;
		}
		const success = queueService.moveItem(fromIndex, toIndex);
		broadcast({ type: "status", data: getFullStatus() });
		res.json({ success, queue: queueService.getQueueStatus() });
	});

	app.get("/api/farm", (_req: Request, res: Response) => {
		res.json({
			...viewerService.getFarmStats(),
			autoWatch: config.viewerAutoWatch
		});
	});

	app.post("/api/farm/watch", async (_req: Request, res: Response) => {
		if (!viewerService.isConfigured()) {
			res.status(400).json({ success: false, message: "VIEWER_TOKEN is not configured" });
			return;
		}

		if (!streamStatus.playing || !streamStatus.joined) {
			res.status(400).json({ success: false, message: "Stream is not currently playing. Start stream first." });
			return;
		}

		const guildId = streamStatus.channelInfo.guildId || config.guildId;
		const channelId = streamStatus.channelInfo.channelId || config.videoChannelId;
		const streamerId = client.user?.id;

		if (!guildId || !channelId || !streamerId) {
			res.status(400).json({ success: false, message: "Missing channel or streamer info" });
			return;
		}

		const success = await viewerService.watchStream(guildId, channelId, streamerId);
		broadcast({ type: "status", data: getFullStatus() });
		res.json({ success, message: success ? "Viewer is watching the stream" : "Failed to join stream watch" });
	});

	app.post("/api/farm/stop", (_req: Request, res: Response) => {
		viewerService.stopWatching();
		broadcast({ type: "status", data: getFullStatus() });
		res.json({ success: true, message: "Viewer stopped watching" });
	});

	app.post("/api/farm/toggle-auto", (req: Request, res: Response) => {
		const { autoWatch } = req.body;
		config.viewerAutoWatch = typeof autoWatch === "boolean" ? autoWatch : !config.viewerAutoWatch;
		broadcast({ type: "status", data: getFullStatus() });
		res.json({ success: true, viewerAutoWatch: config.viewerAutoWatch });
	});

	app.get("/api/videos", (_req: Request, res: Response) => {
		try {
			if (!fs.existsSync(config.videosDir)) {
				fs.mkdirSync(config.videosDir, { recursive: true });
			}

			const files = fs.readdirSync(config.videosDir);
			const videoList = files
				.filter(f => !f.startsWith("ytdlp_temp_"))
				.map(file => {
					const fullPath = path.join(config.videosDir, file);
					const stats = fs.statSync(fullPath);
					const ext = path.extname(file).toLowerCase();
					return {
						name: file,
						baseName: path.parse(file).name,
						size: stats.size,
						formattedSize: formatBytes(stats.size),
						ext,
						mtime: stats.mtime,
						thumbnailUrl: `/api/videos/${encodeURIComponent(file)}/preview`
					};
				});

			res.json({ videos: videoList });
		} catch (error) {
			logger.error("[API videos error]:", error);
			res.status(500).json({ success: false, message: "Failed to read videos directory" });
		}
	});

	app.post("/api/videos/upload", upload.single("file"), (req: Request, res: Response) => {
		if (!req.file) {
			res.status(400).json({ success: false, message: "No file uploaded" });
			return;
		}

		logger.info(`Video uploaded successfully: ${req.file.filename} (${formatBytes(req.file.size)})`);
		res.json({
			success: true,
			filename: req.file.filename,
			size: req.file.size,
			formattedSize: formatBytes(req.file.size)
		});
	});

	app.post("/api/videos/download", async (req: Request, res: Response) => {
		const { url } = req.body;
		if (!url || typeof url !== "string") {
			res.status(400).json({ success: false, message: "Missing URL parameter" });
			return;
		}

		try {
			logger.info(`Starting download request from UI for: ${url}`);
			const targetFilename = `video_${Date.now()}.mp4`;
			const outputPath = path.join(config.videosDir, targetFilename);

			const ytdlProcess = ytdlExec(url, {
				output: outputPath,
				format: "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
				noPlaylist: true
			});

			res.json({
				success: true,
				message: "Download process started in background",
				filename: targetFilename
			});

			ytdlProcess.on("close", (code) => {
				if (code === 0) {
					logger.info(`Download completed: ${targetFilename}`);
					broadcast({ type: "status", data: getFullStatus() });
				} else {
					logger.error(`Download process exited with code ${code}`);
				}
			});
			ytdlProcess.on("error", (err) => {
				logger.error(`Download error for ${url}:`, err);
			});
		} catch (error) {
			logger.error("[API download error]:", error);
			res.status(500).json({ success: false, message: error instanceof Error ? error.message : String(error) });
		}
	});

	app.delete("/api/videos/:filename", (req: Request, res: Response) => {
		const filename = getParam(req.params.filename);
		const fullPath = path.join(config.videosDir, filename);

		try {
			if (fs.existsSync(fullPath)) {
				fs.unlinkSync(fullPath);
				const preview1 = path.join(config.previewCacheDir, `${filename}-1.jpg`);
				if (fs.existsSync(preview1)) {
					fs.unlinkSync(preview1);
				}
				logger.info(`Video deleted: ${filename}`);
				res.json({ success: true, message: `Deleted ${filename}` });
			} else {
				res.status(404).json({ success: false, message: "File not found" });
			}
		} catch (error) {
			logger.error("[API delete error]:", error);
			res.status(500).json({ success: false, message: "Failed to delete file" });
		}
	});

	app.get("/api/videos/:filename/preview", async (req: Request, res: Response) => {
		const filename = getParam(req.params.filename);
		const videoPath = path.join(config.videosDir, filename);

		if (!fs.existsSync(videoPath)) {
			res.status(404).send("Video file not found");
			return;
		}

		const cachedPreview = path.resolve(config.previewCacheDir, `${filename}-1.jpg`);
		if (fs.existsSync(cachedPreview)) {
			res.sendFile(cachedPreview);
			return;
		}

		try {
			await ffmpegScreenshot(filename);
			if (fs.existsSync(cachedPreview)) {
				res.sendFile(cachedPreview);
			} else {
				res.status(404).send("Preview could not be generated");
			}
		} catch (error) {
			logger.error(`Failed to generate preview for ${filename}:`, error);
			res.status(500).send("Error generating preview");
		}
	});

	app.get("/api/videos/:filename/info", async (req: Request, res: Response) => {
		const filename = getParam(req.params.filename);
		const videoPath = path.join(config.videosDir, filename);

		if (!fs.existsSync(videoPath)) {
			res.status(404).json({ success: false, message: "File not found" });
			return;
		}

		try {
			const params = await getVideoParams(videoPath);
			res.json({ success: true, params });
		} catch (error) {
			res.status(500).json({ success: false, message: "Failed to extract video parameters" });
		}
	});

	app.get("/api/config", (_req: Request, res: Response) => {
		res.json({
			guildId: config.guildId,
			videoChannelId: config.videoChannelId,
			cmdChannelId: config.cmdChannelId,
			width: config.width,
			height: config.height,
			fps: config.fps,
			bitrateKbps: config.bitrateKbps,
			maxBitrateKbps: config.maxBitrateKbps,
			videoCodec: config.videoCodec,
			h26xPreset: config.h26xPreset,
			hardwareAcceleratedDecoding: config.hardwareAcceleratedDecoding,
			viewerAutoWatch: config.viewerAutoWatch,
			streamLoop: config.streamLoop,
			serverPort: config.serverPort
		});
	});

	app.post("/api/config", (req: Request, res: Response) => {
		try {
			const body = req.body;
			if (body.guildId !== undefined) config.guildId = String(body.guildId).trim();
			if (body.videoChannelId !== undefined) config.videoChannelId = String(body.videoChannelId).trim();
			if (body.cmdChannelId !== undefined) config.cmdChannelId = String(body.cmdChannelId).trim();
			if (body.width !== undefined) config.width = Number(body.width);
			if (body.height !== undefined) config.height = Number(body.height);
			if (body.fps !== undefined) config.fps = Number(body.fps);
			if (body.bitrateKbps !== undefined) config.bitrateKbps = Number(body.bitrateKbps);
			if (body.maxBitrateKbps !== undefined) config.maxBitrateKbps = Number(body.maxBitrateKbps);
			if (body.videoCodec !== undefined) config.videoCodec = parseVideoCodec(body.videoCodec);
			if (body.h26xPreset !== undefined) config.h26xPreset = parsePreset(body.h26xPreset);
			if (body.hardwareAcceleratedDecoding !== undefined) config.hardwareAcceleratedDecoding = parseBoolean(body.hardwareAcceleratedDecoding);
			if (body.viewerAutoWatch !== undefined) config.viewerAutoWatch = parseBoolean(body.viewerAutoWatch);
			if (body.streamLoop !== undefined) {
				config.streamLoop = parseBoolean(body.streamLoop);
				streamingService.setLoop(config.streamLoop);
			}

			const envPath = path.resolve(process.cwd(), ".env");
			if (fs.existsSync(envPath)) {
				let envContent = fs.readFileSync(envPath, "utf-8");
				const updateEnv = (key: string, val: string) => {
					const regex = new RegExp(`^${key}\\s*=.*$`, "m");
					if (regex.test(envContent)) {
						envContent = envContent.replace(regex, `${key} = "${val}"`);
					} else {
						envContent += `\n${key} = "${val}"`;
					}
				};

				if (body.guildId) updateEnv("GUILD_ID", config.guildId);
				if (body.videoChannelId) updateEnv("VIDEO_CHANNEL_ID", config.videoChannelId);
				if (body.cmdChannelId) updateEnv("COMMAND_CHANNEL_ID", config.cmdChannelId);
				if (body.width) updateEnv("STREAM_WIDTH", String(config.width));
				if (body.height) updateEnv("STREAM_HEIGHT", String(config.height));
				if (body.fps) updateEnv("STREAM_FPS", String(config.fps));
				if (body.bitrateKbps) updateEnv("STREAM_BITRATE_KBPS", String(config.bitrateKbps));
				if (body.videoCodec) updateEnv("STREAM_VIDEO_CODEC", config.videoCodec);
				if (body.h26xPreset) updateEnv("STREAM_H26X_PRESET", config.h26xPreset);
				if (body.viewerAutoWatch !== undefined) updateEnv("VIEWER_AUTO_WATCH", String(config.viewerAutoWatch));
				if (body.streamLoop !== undefined) updateEnv("STREAM_LOOP", String(config.streamLoop));

				fs.writeFileSync(envPath, envContent, "utf-8");
				logger.info(".env updated with new configuration parameters.");
			}

			broadcast({ type: "status", data: getFullStatus() });
			res.json({ success: true, message: "Configuration updated successfully", config });
		} catch (error) {
			logger.error("[API update config error]:", error);
			res.status(500).json({ success: false, message: "Failed to update configuration" });
		}
	});

	app.get("/api/logs", (_req: Request, res: Response) => {
		res.json({ logs: logBuffer });
	});

	const possibleDistPaths = [
		path.resolve(process.cwd(), "../frontend/dist"),
		path.resolve(process.cwd(), "dist/public")
	];

	for (const distPath of possibleDistPaths) {
		if (fs.existsSync(distPath)) {
			logger.info(`Serving static Web UI from: ${distPath}`);
			app.use(express.static(distPath));
			app.use((req: Request, res: Response, next: NextFunction) => {
				if (req.path.startsWith("/api") || req.path.startsWith("/ws")) {
					return next();
				}
				const indexPath = path.join(distPath, "index.html");
				if (fs.existsSync(indexPath)) {
					res.sendFile(indexPath);
				} else {
					next();
				}
			});
			break;
		}
	}

	server.listen(config.serverPort, () => {
		logger.info(`[Web Server] StreamBot & Farm Dashboard API running at: http://localhost:${config.serverPort}`);
	});

	return server;
}
