import fs from "node:fs";
import path from "node:path";
import config from "../config.js";
import ffmpeg from "fluent-ffmpeg";

export function getFFmpegExecutablePath(): string | null {
	const nodeAvBinary = path.resolve(process.cwd(), "node_modules", "node-av", "binary", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
	if (fs.existsSync(nodeAvBinary)) {
		return nodeAvBinary;
	}
	const scriptsBinary = path.resolve(process.cwd(), "scripts", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
	if (fs.existsSync(scriptsBinary)) {
		return scriptsBinary;
	}
	return null;
}

const ffmpegBinary = getFFmpegExecutablePath();
if (ffmpegBinary) {
	ffmpeg.setFfmpegPath(ffmpegBinary);
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
					filename,
					timestamps: [timestamps[index]],
					folder: config.previewCacheDir
				});
		};

		captureNext(0);
	}).finally(() => {
		activeScreenshots.delete(video);
	});

	activeScreenshots.set(video, task);
	return task;
}

export interface VideoParams {
	width: number;
	height: number;
	bitrate?: string;
	fps: number;
}

export async function getVideoParams(videoPath: string): Promise<VideoParams> {
	return new Promise((resolve, reject) => {
		ffmpeg.ffprobe(videoPath, (err, metadata) => {
			if (err) {
				return reject(err);
			}

			const videoStream = metadata.streams.find(stream => stream.codec_type === "video");
			if (!videoStream || !videoStream.width || !videoStream.height) {
				return reject(new Error("Unable to determine video stream dimensions."));
			}

			let fps = 0;
			const frameRateStr = videoStream.r_frame_rate || videoStream.avg_frame_rate;
			if (frameRateStr) {
				const [numerator, denominator] = frameRateStr.split("/").map(Number);
				if (denominator && !Number.isNaN(numerator) && !Number.isNaN(denominator)) {
					fps = numerator / denominator;
				}
			}

			const rawBitrate = videoStream.bit_rate || metadata.format?.bit_rate;
			const bitrate = rawBitrate ? String(rawBitrate) : undefined;

			resolve({
				width: videoStream.width,
				height: videoStream.height,
				bitrate,
				fps
			});
		});
	});
}
