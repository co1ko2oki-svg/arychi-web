import dotenv from "dotenv";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { SupportedVideoCodec, H26xPreset } from "./types/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Always locate and load the single root .env file
const rootEnvCandidates = [
	path.resolve(process.cwd(), ".env"),
	path.resolve(process.cwd(), "../.env"),
	path.resolve(process.cwd(), "../../.env"),
];
const foundEnv = rootEnvCandidates.find((p) => fs.existsSync(p));
if (foundEnv) {
	dotenv.config({ path: foundEnv, quiet: true });
} else {
	dotenv.config({ quiet: true });
}

const VALID_VIDEO_CODECS: readonly SupportedVideoCodec[] = ["H264", "H265", "VP8", "VP9", "AV1"];
const VALID_PRESETS: readonly H26xPreset[] = [
	"ultrafast",
	"superfast",
	"veryfast",
	"faster",
	"fast",
	"medium",
	"slow",
	"slower",
	"veryslow"
];

export function parseVideoCodec(value: unknown): SupportedVideoCodec {
	if (typeof value === "string") {
		const normalized = value.trim().toUpperCase() as SupportedVideoCodec;
		if (VALID_VIDEO_CODECS.includes(normalized)) {
			return normalized;
		}
	}
	return "H264";
}

export function parsePreset(value: unknown): H26xPreset {
	if (typeof value === "string") {
		const normalized = value.trim().toLowerCase() as H26xPreset;
		if (VALID_PRESETS.includes(normalized)) {
			return normalized;
		}
	}
	return "ultrafast";
}

export function parseBoolean(value: unknown): boolean {
	if (typeof value === "string") {
		return value.trim().toLowerCase() === "true";
	}
	return Boolean(value);
}

function parseAdminIds(value: string | undefined): string[] {
	if (!value) return [];

	const trimmed = value.trim();
	if (!trimmed) return [];

	try {
		const parsed = JSON.parse(trimmed);
		if (Array.isArray(parsed)) {
			return parsed
				.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
				.map(id => id.trim());
		}
	} catch {
		if (trimmed.includes(",")) {
			return trimmed
				.split(",")
				.map(id => id.trim())
				.filter(id => id.length > 0);
		}
	}

	return [trimmed];
}

function loadTokensFromDatabase(): { token: string; viewerToken: string; guildId?: string; videoChannelId?: string } {
	try {
		const dbCandidates = [
			path.resolve(__dirname, '../../database/commercial_db.json'),
			path.resolve(process.cwd(), 'database/commercial_db.json'),
			path.resolve(process.cwd(), '../database/commercial_db.json'),
		];
		for (const dbFile of dbCandidates) {
			if (!fs.existsSync(dbFile)) continue;
			try {
				const content = fs.readFileSync(dbFile, "utf-8");
				const parsed = JSON.parse(content);
				if (Array.isArray(parsed?.accounts)) {
					const accountWithTokens = parsed.accounts.find(
						(a: any) => (a?.tokens?.streamMainToken && a.tokens.streamMainToken.trim().length > 0) ||
						            (a?.tokens?.streamViewerToken && a.tokens.streamViewerToken.trim().length > 0)
					);
					if (accountWithTokens?.tokens) {
						return {
							token: accountWithTokens.tokens.streamMainToken || "",
							viewerToken: accountWithTokens.tokens.streamViewerToken || "",
							guildId: accountWithTokens.tokens.streamGuildId || undefined,
							videoChannelId: accountWithTokens.tokens.streamChannelId || undefined,
						};
					}
				}
			} catch {}
		}
	} catch {}
	return { token: "", viewerToken: "" };
}

const dbTokens = loadTokensFromDatabase();

const config = {
	token: dbTokens.token || process.env.TOKEN || "",
	prefix: process.env.PREFIX || "$",
	guildId: dbTokens.guildId || process.env.GUILD_ID || "",
	cmdChannelId: process.env.COMMAND_CHANNEL_ID || "",
	videoChannelId: dbTokens.videoChannelId || process.env.VIDEO_CHANNEL_ID || "",
	adminIds: parseAdminIds(process.env.ADMIN_IDS),

	videosDir: process.env.VIDEOS_DIR || "./videos",
	previewCacheDir: process.env.PREVIEW_CACHE_DIR || "./tmp/preview-cache",

	ytdlpCookiesPath: process.env.YTDLP_COOKIES_PATH || "",

	respect_video_params: parseBoolean(process.env.STREAM_RESPECT_VIDEO_PARAMS),
	bitrateOverride: parseBoolean(process.env.STREAM_BITRATE_OVERRIDE),
	width: Number.parseInt(process.env.STREAM_WIDTH || "1280", 10),
	height: Number.parseInt(process.env.STREAM_HEIGHT || "720", 10),
	fps: Number.parseInt(process.env.STREAM_FPS || "30", 10),
	bitrateKbps: Number.parseInt(process.env.STREAM_BITRATE_KBPS || "1000", 10),
	maxBitrateKbps: Number.parseInt(process.env.STREAM_MAX_BITRATE_KBPS || "2500", 10),
	maxWidth: Number.parseInt(process.env.STREAM_MAX_WIDTH || "0", 10),
	maxHeight: Number.parseInt(process.env.STREAM_MAX_HEIGHT || "0", 10),
	hardwareAcceleratedDecoding: parseBoolean(process.env.STREAM_HARDWARE_ACCELERATION),
	h26xPreset: parsePreset(process.env.STREAM_H26X_PRESET),
	videoCodec: parseVideoCodec(process.env.STREAM_VIDEO_CODEC),

	viewerToken: dbTokens.viewerToken || process.env.VIEWER_TOKEN || "",
	viewerAutoWatch: process.env.VIEWER_AUTO_WATCH !== undefined ? parseBoolean(process.env.VIEWER_AUTO_WATCH) : true,
	streamLoop: process.env.STREAM_LOOP !== undefined ? parseBoolean(process.env.STREAM_LOOP) : true,

	serverEnabled: process.env.SERVER_ENABLED !== undefined ? parseBoolean(process.env.SERVER_ENABLED) : true,
	serverPort: Number.parseInt(process.env.SERVER_PORT || "3000", 10),
	serverUsername: process.env.SERVER_USERNAME || "admin",
	serverPassword: process.env.SERVER_PASSWORD || "admin"
};

export default config;
