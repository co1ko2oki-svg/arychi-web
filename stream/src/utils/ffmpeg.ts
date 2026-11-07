import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import config from "../config.js";
import ffmpeg from "fluent-ffmpeg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function getFFmpegExecutablePath(): string | null {
	const binName = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
	const candidates = [
		path.resolve(process.cwd(), "scripts", binName),
		path.resolve(process.cwd(), "bin", binName),
		path.resolve(process.cwd(), "..", "bin", binName),
		path.resolve(__dirname, "../../scripts", binName),
		path.resolve(__dirname, "../../../bin", binName),
		path.resolve(process.cwd(), "node_modules", "node-av", "binary", binName),
	];
	for (const candidate of candidates) {
		if (fs.existsSync(candidate)) {
			return candidate;
		}
	}
	return null;
}

export function getFFprobeExecutablePath(): string | null {
	const binName = process.platform === "win32" ? "ffprobe.exe" : "ffprobe";
	const candidates = [
		path.resolve(process.cwd(), "scripts", binName),
		path.resolve(process.cwd(), "bin", binName),
		path.resolve(process.cwd(), "..", "bin", binName),
		path.resolve(__dirname, "../../scripts", binName),
		path.resolve(__dirname, "../../../bin", binName),
	];
	for (const candidate of candidates) {
		if (fs.existsSync(candidate)) {
			return candidate;
		}
	}
	return null;
}

const ffmpegBinary = getFFmpegExecutablePath();
if (ffmpegBinary) {
	ffmpeg.setFfmpegPath(ffmpegBinary);
}

const ffprobeBinary = getFFprobeExecutablePath();
if (ffprobeBinary) {
	ffmpeg.setFfprobePath(ffprobeBinary);
}

const activeScreenshots = new Map<string, Promise<string[]>>();

export async function ffmpegScreenshot(video: string): Promise<string[]> {
	const existing = activeScreenshots.get(video);
	if (existing) {
		return existing;
	}

	const task = new Promise<string[]>((resolve, reject) => {
		const timestamps = ["10%", "30%", "50%", "70%", "90%"];
		const images: string[] = [];
		const inputPath = path.join(config.videosDir, video);

		const captureNext = (index: number) => {
			if (index >= timestamps.length) {
				resolve(images);
				return;
			}

			const filename = `${video}-${index + 1}.jpg`;
			ffmpeg(inputPath)
				.on("end", () => {
					images.push(path.join(config.previewCacheDir, filename));
					captureNext(index + 1);
				})
				.on("error", (err: Error) => {
					reject(err);
				})
				.screenshots({
					count: 1,
					timemarks: [timestamps[index]],
					folder: config.previewCacheDir,
					filename
				});
		};

		captureNext(0);
	}).finally(() => {
		activeScreenshots.delete(video);
	});

	activeScreenshots.set(video, task);
	return task;
}

export async function getVideoParams(videoPath: string): Promise<{ width: number; height: number; fps?: number; bitrate?: number }> {
	return new Promise((resolve, reject) => {
		ffmpeg.ffprobe(videoPath, (err, metadata) => {
			if (err) {
				return reject(err);
			}

			const videoStream = metadata.streams.find(s => s.codec_type === "video");
			if (!videoStream) {
				return reject(new Error("No video stream found"));
			}

			let fps: number | undefined;
			if (videoStream.r_frame_rate) {
				const [num, den] = videoStream.r_frame_rate.split("/").map(Number);
				if (num && den) {
					fps = Math.round(num / den);
				}
			}

			resolve({
				width: videoStream.width || 1280,
				height: videoStream.height || 720,
				fps: fps || 30,
				bitrate: videoStream.bit_rate ? Math.round(Number(videoStream.bit_rate) / 1000) : undefined
			});
		});
	});
}
