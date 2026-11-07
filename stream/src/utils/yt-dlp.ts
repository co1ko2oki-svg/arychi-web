import { existsSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import nodePath from "node:path";
import process from "node:process";
import os from "node:os";
import crypto from "node:crypto";
import got from "got";
import { YTFlags } from "../types/index.js";
import logger from "./logger.js";
import config from "../config.js";
import { spawn, SpawnOptions } from "node:child_process";
import { getFFmpegExecutablePath } from "./ffmpeg.js";

function getBinaryName(): string {
	const platform = process.platform;
	const arch = process.arch;

	if (platform === "win32") {
		return arch === "ia32" ? "yt-dlp_x86.exe" : "yt-dlp.exe";
	}
	if (platform === "darwin") {
		return "yt-dlp_macos";
	}
	if (platform === "linux") {
		if (arch === "arm64") return "yt-dlp_linux_aarch64";
		if (arch === "arm") return "yt-dlp_linux_armv7l";
		return "yt-dlp";
	}
	return "yt-dlp";
}

const filename = getBinaryName();
const scriptsPath = nodePath.resolve(process.cwd(), "scripts");
const exePath = nodePath.resolve(scriptsPath, filename);

function buildArgs(url: string, options: Partial<YTFlags>): string[] {
	const optArgs: string[] = [];

	if (config.ytdlpCookiesPath && existsSync(config.ytdlpCookiesPath)) {
		optArgs.push("--cookies", config.ytdlpCookiesPath);
	}

	const ffmpegBinary = getFFmpegExecutablePath();
	if (ffmpegBinary) {
		optArgs.push("--ffmpeg-location", ffmpegBinary);
	}

	for (const [key, val] of Object.entries(options)) {
		if (val === null || val === undefined) {
			continue;
		}

		const flag = key.replaceAll(/[A-Z]/gu, ms => `-${ms.toLowerCase()}`);

		if (typeof val === "boolean") {
			optArgs.push(val ? `--${flag}` : `--no-${flag}`);
		} else {
			optArgs.push(`--${flag}`, String(val));
		}
	}
	return [url, ...optArgs];
}

function parseJsonSafe(str: string): unknown {
	try {
		return JSON.parse(str);
	} catch {
		return str;
	}
}

interface GithubAsset {
	name: string;
	browser_download_url: string;
}

interface GithubRelease {
	tag_name: string;
	assets: GithubAsset[];
}

export async function downloadExecutable(): Promise<void> {
	if (existsSync(exePath)) return;

	logger.info("yt-dlp not found, downloading latest release...");
	const releases = await got.get("https://api.github.com/repos/yt-dlp/yt-dlp/releases?per_page=1").json<GithubRelease[]>();
	const release = releases[0];
	if (!release) {
		throw new Error("Failed to fetch yt-dlp release information from GitHub.");
	}

	const asset = release.assets.find(ast => ast.name === filename);
	if (!asset) {
		throw new Error(`Could not find suitable binary asset "${filename}" in release ${release.tag_name}.`);
	}

	const buffer = await got.get(asset.browser_download_url).buffer();
	mkdirSync(scriptsPath, { recursive: true });
	writeFileSync(exePath, buffer, { mode: 0o777 });
	logger.info(`yt-dlp ${release.tag_name} downloaded successfully.`);
}

export function exec(url: string, options: Partial<YTFlags> = {}, spawnOptions: SpawnOptions = {}) {
	return spawn(exePath, buildArgs(url, options), {
		windowsHide: true,
		...spawnOptions,
		stdio: ["ignore", "pipe", "pipe"]
	});
}

export default async function ytdl(
	url: string,
	options: Partial<YTFlags> = {},
	spawnOptions: SpawnOptions = {}
): Promise<unknown> {
	return new Promise((resolve, reject) => {
		let data = "";
		let errorData = "";

		const proc = exec(url, options, spawnOptions);

		proc.stdout?.on("data", chunk => {
			data += chunk.toString();
		});

		proc.stderr?.on("data", chunk => {
			errorData += chunk.toString();
		});

		proc.on("close", exitCode => {
			if (exitCode !== 0) {
				const errorMsg = `yt-dlp failed with exit code ${exitCode}: ${errorData || data}`;
				logger.error(errorMsg);
				reject(new Error(errorMsg));
			} else {
				resolve(parseJsonSafe(data));
			}
		});

		proc.on("error", error => {
			logger.error("yt-dlp process error:", error);
			reject(error);
		});
	});
}

export async function downloadToTempFile(
	url: string,
	options: Partial<YTFlags> = {},
	outputPath?: string
): Promise<string> {
	await downloadExecutable();

	const tempFilePath = outputPath || nodePath.join(os.tmpdir(), `ytdlp_temp_${crypto.randomBytes(6).toString("hex")}.mp4`);
	const downloadOptions: Partial<YTFlags> = {
		...options,
		output: tempFilePath,
		quiet: true,
		noWarnings: true
	};

	const proc = spawn(exePath, buildArgs(url, downloadOptions), {
		windowsHide: true,
		stdio: ["ignore", "ignore", "pipe"]
	});

	let errorData = "";
	proc.stderr?.on("data", chunk => {
		errorData += chunk.toString();
	});

	const exitCode = await new Promise<number>(resolve => {
		proc.on("close", code => resolve(code ?? 0));
		proc.on("error", () => resolve(1));
	});

	if (exitCode !== 0 || !existsSync(tempFilePath)) {
		if (existsSync(tempFilePath)) {
			try {
				unlinkSync(tempFilePath);
			} catch (cleanupError) {
				logger.warn(`Failed to cleanup temp file ${tempFilePath}:`, cleanupError);
			}
		}
		const errorMessage = `yt-dlp failed to download file. Exit code: ${exitCode}. ${errorData.trim()}`;
		logger.error(errorMessage);
		throw new Error(errorMessage);
	}

	return tempFilePath;
}

export async function checkForUpdatesAndUpdate(): Promise<void> {
	try {
		await downloadExecutable();
		const updateProc = spawn(exePath, ["--update"], {
			stdio: ["ignore", "pipe", "pipe"]
		});

		let stdoutData = "";
		let stderrData = "";

		updateProc.stdout?.on("data", chunk => {
			stdoutData += chunk.toString();
		});

		updateProc.stderr?.on("data", chunk => {
			stderrData += chunk.toString();
		});

		const exitCode = await new Promise<number>(resolve => {
			updateProc.on("close", code => resolve(code ?? 0));
			updateProc.on("error", () => resolve(1));
		});

		if (exitCode === 0 && stdoutData.includes("Updated yt-dlp to")) {
			logger.info(`yt-dlp updated successfully: ${stdoutData.trim()}`);
		} else if (exitCode !== 0) {
			logger.warn(`yt-dlp update check exited with code ${exitCode}. ${stderrData.trim()}`);
		}
	} catch (error) {
		logger.error("Error during yt-dlp update check:", error);
	}
}
