import { BaseCommand } from "./base.js";
import { CommandContext, SupportedVideoCodec, H26xPreset } from "../types/index.js";
import config, { parseBoolean, parseVideoCodec, parsePreset } from "../config.js";
import logger from "../utils/logger.js";

const VALID_CODECS: readonly SupportedVideoCodec[] = ["H264", "H265", "VP8", "VP9", "AV1"];
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

export default class ConfigCommand extends BaseCommand {
	name = "config";
	description = "View or adjust bot configuration parameters (Admin only)";
	usage = "config [parameter] [value]";
	aliases = ["cfg", "set"];

	async execute(context: CommandContext): Promise<void> {
		if (!this.isAdmin(context.message.author.id)) {
			await this.sendError(context.message, "You don't have permission to use this command. Admin access required.");
			logger.warn(`Unauthorized config command attempt by user ${context.message.author.id}`);
			return;
		}

		const args = context.args;

		if (args.length === 0) {
			await this.showConfig(context);
			return;
		}

		if (args.length === 1) {
			await this.showParameter(context, args[0]);
			return;
		}

		const parameter = args[0].toLowerCase();
		const value = args.slice(1).join(" ");
		await this.setParameter(context, parameter, value);
	}

	private async showConfig(context: CommandContext): Promise<void> {
		const configInfo = [
			"**Stream Options:**",
			`• respect_video_params: ${config.respect_video_params}`,
			`• bitrateOverride: ${config.bitrateOverride}`,
			`• width: ${config.width}`,
			`• height: ${config.height}`,
			`• fps: ${config.fps}`,
			`• bitrateKbps: ${config.bitrateKbps}`,
			`• maxBitrateKbps: ${config.maxBitrateKbps}`,
			`• maxWidth: ${config.maxWidth || "None"}`,
			`• maxHeight: ${config.maxHeight || "None"}`,
			`• hardwareAcceleratedDecoding: ${config.hardwareAcceleratedDecoding}`,
			`• h26xPreset: ${config.h26xPreset}`,
			`• videoCodec: ${config.videoCodec}`,
			"",
			"**General Options:**",
			`• videosDir: ${config.videosDir}`,
			`• previewCacheDir: ${config.previewCacheDir}`,
			"",
			"**yt-dlp Options:**",
			`• ytdlpCookiesPath: ${config.ytdlpCookiesPath || "(not set)"}`,
			"",
			"Use `config <parameter>` to view a specific parameter",
			"Use `config <parameter> <value>` to change a parameter"
		].join("\n");

		await this.sendInfo(context.message, "Bot Configuration", configInfo);
	}

	private async showParameter(context: CommandContext, parameter: string): Promise<void> {
		const key = Object.keys(config).find(k => k.toLowerCase() === parameter.toLowerCase()) as keyof typeof config | undefined;

		if (!key) {
			await this.sendError(context.message, `Unknown parameter: ${parameter}`);
			return;
		}

		const value = config[key];
		await this.sendInfo(context.message, `Config: ${key}`, `Current value: \`${value}\``);
	}

	private async setParameter(context: CommandContext, parameter: string, value: string): Promise<void> {
		const key = Object.keys(config).find(k => k.toLowerCase() === parameter.toLowerCase()) as keyof typeof config | undefined;

		if (!key) {
			await this.sendError(context.message, `Unknown parameter: ${parameter}`);
			return;
		}

		try {
			switch (key) {
				case "respect_video_params":
				case "bitrateOverride":
				case "hardwareAcceleratedDecoding": {
					const boolValue = parseBoolean(value);
					(config as Record<string, unknown>)[key] = boolValue;
					await this.sendSuccess(context.message, `Set ${key} to \`${boolValue}\``);
					logger.info(`Config updated: ${key} = ${boolValue}`);
					break;
				}

				case "width":
				case "height":
				case "fps":
				case "bitrateKbps":
				case "maxBitrateKbps":
				case "maxWidth":
				case "maxHeight": {
					const numValue = Number.parseInt(value, 10);
					if (Number.isNaN(numValue) || numValue < 0) {
						await this.sendError(context.message, `Invalid number value: ${value}. Must be non-negative.`);
						return;
					}

					const essentialParams = ["width", "height", "fps", "bitrateKbps", "maxBitrateKbps"];
					if (essentialParams.includes(key) && numValue === 0) {
						await this.sendError(context.message, `Invalid number value: ${value}. Must be greater than 0.`);
						return;
					}

					(config as Record<string, unknown>)[key] = numValue;
					await this.sendSuccess(context.message, `Set ${key} to \`${numValue}\``);
					logger.info(`Config updated: ${key} = ${numValue}`);
					break;
				}

				case "videoCodec": {
					const normalized = value.trim().toUpperCase() as SupportedVideoCodec;
					if (!VALID_CODECS.includes(normalized)) {
						await this.sendError(context.message, `Invalid video codec. Valid options: ${VALID_CODECS.join(", ")}`);
						return;
					}
					config.videoCodec = parseVideoCodec(normalized);
					await this.sendSuccess(context.message, `Set videoCodec to \`${config.videoCodec}\``);
					logger.info(`Config updated: videoCodec = ${config.videoCodec}`);
					break;
				}

				case "h26xPreset": {
					const normalized = value.trim().toLowerCase() as H26xPreset;
					if (!VALID_PRESETS.includes(normalized)) {
						await this.sendError(context.message, `Invalid preset. Valid options: ${VALID_PRESETS.join(", ")}`);
						return;
					}
					config.h26xPreset = parsePreset(normalized);
					await this.sendSuccess(context.message, `Set h26xPreset to \`${config.h26xPreset}\``);
					logger.info(`Config updated: h26xPreset = ${config.h26xPreset}`);
					break;
				}

				case "videosDir":
				case "previewCacheDir":
				case "ytdlpCookiesPath": {
					(config as Record<string, unknown>)[key] = value;
					await this.sendSuccess(context.message, `Set ${key} to \`${value}\``);
					logger.info(`Config updated: ${key} = ${value}`);
					break;
				}

				default:
					await this.sendError(context.message, `Cannot modify parameter: ${key}`);
					return;
			}
		} catch (error) {
			logger.error(`Error setting config parameter ${parameter}:`, error);
			await this.sendError(context.message, `Failed to set ${parameter}: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	private isAdmin(userId: string): boolean {
		if (!config.adminIds || config.adminIds.length === 0) {
			return true;
		}
		return config.adminIds.includes(userId);
	}
}
