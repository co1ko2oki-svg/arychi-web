import { Constants } from './constants';
import { fetch } from 'undici';
import * as readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import type { ClientQuest } from './client';
import { EventEmitter } from 'node:events';

export interface LogEntry {
	timestamp: string;
	level: 'info' | 'warn' | 'error' | 'success';
	message: string;
	questId?: string;
}

class LogEmitter extends EventEmitter {}
export const logEmitter = new LogEmitter();
export const logBuffer: LogEntry[] = [];
const MAX_LOG_BUFFER = 300;

export function addLog(level: LogEntry['level'], message: string, questId?: string) {
	const entry: LogEntry = {
		timestamp: new Date().toISOString(),
		level,
		message,
		questId,
	};
	logBuffer.push(entry);
	if (logBuffer.length > MAX_LOG_BUFFER) {
		logBuffer.shift();
	}
	logEmitter.emit('log', entry);

	const prefix = `[${new Date().toLocaleTimeString()}] [${level.toUpperCase()}]`;
	if (level === 'error') {
		console.error(prefix, message);
	} else if (level === 'warn') {
		console.warn(prefix, message);
	} else {
		console.log(prefix, message);
	}
}

let inFlightBuildNumberPromise: Promise<number> | null = null;

export class Utils extends null {
	public static makeHeaders(
		init?: HeadersInit,
		customProperties?: Record<string, any>,
	): Headers {
		let myHeaders = new Headers(init);
		const isAndroidRequest = myHeaders.get('AndroidRequest') === 'true' || myHeaders.get('androidrequest') === 'true';
		myHeaders.delete('AndroidRequest');
		myHeaders.delete('androidrequest');

		const auth = myHeaders.get('Authorization');
		if (auth) {
			myHeaders.set('Authorization', auth.replace(/^Bot\s+/i, '').replace(/^Bearer\s+/i, '').trim());
		}

		myHeaders.set('accept-language', 'en-US,en;q=0.9');
		myHeaders.set('x-debug-options', 'bugReporterEnabled');
		myHeaders.set('x-discord-locale', 'en-US');
		myHeaders.set('x-discord-timezone', 'Asia/Saigon');

		if (isAndroidRequest) {
			myHeaders = Utils.mergeHeaders(
				myHeaders,
				Utils.makeAndroidHeaders(true, customProperties),
			);
		} else {
			myHeaders = Utils.mergeHeaders(
				myHeaders,
				Utils.makeDesktopHeaders(true, true, customProperties),
			);
		}
		return myHeaders;
	}

	public static makeDesktopHeaders(
		withDiscordClientProperties = true,
		withOriginAndReferer = true,
		customProperties?: Record<string, any>,
	): Headers {
		const myHeaders = new Headers();
		myHeaders.set('accept-language', 'en-US,en;q=0.9');
		myHeaders.set('User-Agent', Constants.USER_AGENT);
		if (withOriginAndReferer) {
			myHeaders.set('origin', 'https://discord.com');
			myHeaders.set('referer', 'https://discord.com/channels/@me');
		}
		myHeaders.set('pragma', 'no-cache');
		myHeaders.set('priority', 'u=1, i');
		myHeaders.set(
			'sec-ch-ua',
			'"Not)A;Brand";v="8", "Chromium";v="138"',
		);
		myHeaders.set('sec-ch-ua-mobile', '?0');
		myHeaders.set('sec-ch-ua-platform', '"Windows"');
		myHeaders.set('sec-fetch-dest', 'empty');
		myHeaders.set('sec-fetch-mode', 'cors');
		myHeaders.set('sec-fetch-site', 'same-origin');
		if (withDiscordClientProperties) {
			const props = customProperties || Constants.Properties;
			myHeaders.set(
				'x-super-properties',
				Buffer.from(JSON.stringify(props)).toString('base64'),
			);
		}
		return myHeaders;
	}

	public static makeAndroidHeaders(
		withDiscordClientProperties = true,
		customProperties?: Record<string, any>,
	): Headers {
		const myHeaders = new Headers();
		myHeaders.set('accept-language', 'en-US,en;q=0.9');
		myHeaders.set('User-Agent', Constants.ANDROID_USER_AGENT);
		if (withDiscordClientProperties) {
			const props = customProperties || Constants.ANDROID_Properties;
			myHeaders.set(
				'x-super-properties',
				Buffer.from(JSON.stringify(props)).toString('base64'),
			);
		}
		return myHeaders;
	}

	public static mergeHeaders(a: Headers, b: Headers): Headers {
		const result = new Headers(a);
		b.forEach((value, key) => {
			result.set(key, value);
		});
		return result;
	}

	public static getAppIconUrl(appId: string, iconHash?: string | null): string | null {
		if (!appId || !iconHash) return null;
		return `https://cdn.discordapp.com/app-icons/${appId}/${iconHash}.png?size=256`;
	}

	public static getQuestAssetUrl(questId: string, assetHash?: string | null): string | null {
		if (!questId || !assetHash) return null;
		return `https://cdn.discordapp.com/quest-assets/${questId}/${assetHash}.png`;
	}

	public static async getProxyTicket(
		applicationId: string,
		client: ClientQuest,
	): Promise<string> {
		const ticket = (await client.rest.post(
			`/applications/${applicationId}/proxy-tickets`,
			{
				body: {},
			},
		)) as {
			ticket: string;
			expires_at: string;
			application_id: string;
			user_id: string;
		};
		return ticket.ticket;
	}

	public static async getActivityReferrer(
		applicationId: string,
		client: ClientQuest,
	): Promise<string> {
		const proxyTicket = await Utils.getProxyTicket(applicationId, client);
		const referrer = new URL(`https://${applicationId}.discordsays.com/`);
		referrer.searchParams.set('instance_id', 'example-cl-instance');
		referrer.searchParams.set('platform', 'desktop');
		referrer.searchParams.set('discord_proxy_ticket', proxyTicket);
		return referrer.toString();
	}

	public static getActivityHeaders(
		questId: string,
		authToken: string = '',
		activityReferrer?: string,
	): Record<string, string> {
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			'X-Auth-Token': authToken,
			'X-Discord-Quest-ID': questId,
		};
		if (activityReferrer) {
			headers.Referer = activityReferrer;
		}
		return headers;
	}

	public static async authorizeDiscordSays(
		applicationId: string,
		questId: string,
		authCode: string,
		client: ClientQuest,
	): Promise<{
		token: string | false;
		error: any;
		activityReferrer: string;
	}> {
		let error = null;
		const headers = Utils.makeDesktopHeaders(false, false);
		const activityReferrer = await Utils.getActivityReferrer(
			applicationId,
			client,
		);
		const discordSaysHeaders = Utils.getActivityHeaders(
			questId,
			'',
			activityReferrer,
		);
		for (const [key, value] of Object.entries(discordSaysHeaders)) {
			headers.set(key, value);
		}
		const token = await fetch(
			`https://${applicationId}.discordsays.com/.proxy/acf/authorize`,
			{
				body: JSON.stringify({ code: authCode }),
				method: 'POST',
				headers,
			},
		)
			.then(
				(res) =>
					res.json() as any as {
						token: string;
					},
			)
			.then((data) => data.token)
			.catch((e) => {
				addLog('error', `Error authorizing with Discord Says: ${e.message}`, questId);
				error = e instanceof Error ? e.message : String(e);
				return '';
			});
		return { token, error, activityReferrer };
	}

	public static async progressDiscordSays(
		applicationId: string,
		questId: string,
		token: string,
		questTarget: number,
		activityReferrer: string,
	): Promise<{ success: boolean; error: any }> {
		let error = null;
		const headers = Utils.makeDesktopHeaders(false, false);
		const discordSaysHeaders = Utils.getActivityHeaders(
			questId,
			token,
			activityReferrer,
		);
		for (const [key, value] of Object.entries(discordSaysHeaders)) {
			headers.set(key, value);
		}
		const success = await fetch(
			`https://${applicationId}.discordsays.com/.proxy/acf/quest/progress`,
			{
				headers,
				body: JSON.stringify({ progress: questTarget }),
				method: 'POST',
			},
		)
			.then((res) => res.ok)
			.catch((e) => {
				error = e instanceof Error ? e.message : String(e);
				return false;
			});
		return { success, error };
	}

	public static async askQuestion(promptText: string): Promise<string> {
		const rl = readline.createInterface({ input, output });
		try {
			const answer = await rl.question(promptText);
			return answer;
		} finally {
			rl.close();
		}
	}

	/**
	 * Caches build number for 1 hour to prevent unnecessary requests on every operation.
	 * Deduplicates concurrent in-flight requests.
	 */
	public static async updateLatestBuildVersion(force = false): Promise<number> {
		const now = Date.now();
		const oneHour = 60 * 60 * 1000;
		if (!force && Constants.buildNumberLastFetched && now - Constants.buildNumberLastFetched < oneHour) {
			return Constants.client_build_number;
		}

		if (inFlightBuildNumberPromise) {
			return inFlightBuildNumberPromise;
		}

		inFlightBuildNumberPromise = (async () => {
			try {
				addLog('info', 'Fetching latest Discord build number...');
				const response = await fetch('https://discord.com/app', {
					headers: { 'User-Agent': Constants.USER_AGENT },
				});
				if (!response.ok) {
					addLog('warn', `Failed to fetch Discord app page (${response.status})`);
					return Constants.client_build_number;
				}
				const html = await response.text();
				const scripts = Array.from(
					html.match(/\/assets\/[a-zA-Z0-9_\.\-]+\.js/g) || [],
				);
				if (!scripts || scripts.length === 0) {
					return Constants.client_build_number;
				}

				for (const scriptPath of scripts) {
					try {
						const assetUrl = `https://discord.com${scriptPath}`;
						const assetResponse = await fetch(assetUrl, {
							headers: { 'User-Agent': Constants.USER_AGENT },
						});
						if (!assetResponse.ok) continue;
						const jsContent = await assetResponse.text();
						const match = jsContent.match(
							/buildNumber["\s:]+["\s]*(\d{5,7})/,
						);
						if (match) {
							const buildNumber = parseInt(match[1], 10);
							Constants.client_build_number = buildNumber;
							Constants.buildNumberLastFetched = Date.now();
							addLog('success', `Discord build number updated: ${buildNumber}`);
							return buildNumber;
						}
					} catch {
						continue;
					}
				}
				return Constants.client_build_number;
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				addLog('error', `Error fetching build number: ${errorMessage}`);
				return Constants.client_build_number;
			} finally {
				inFlightBuildNumberPromise = null;
			}
		})();

		return inFlightBuildNumberPromise;
	}

	public static async extractWebhookInfo(): Promise<{
		id: string;
		token: string;
	} | null> {
		const webhookUrl = process.env.WEBHOOK_URL;
		if (!webhookUrl) {
			return null;
		}
		try {
			const req = await fetch(webhookUrl);
			if (!req.ok) return null;
			const cleanUrl = webhookUrl.split('?')[0].trim();
			const parts = cleanUrl.split('/');
			const webhookPathIndex = parts.findIndex((part) => part === 'webhooks');
			if (webhookPathIndex === -1 || parts.length < webhookPathIndex + 3) {
				return null;
			}
			const id = parts[webhookPathIndex + 1];
			const token = parts[webhookPathIndex + 2];
			return { id, token };
		} catch {
			return null;
		}
	}
}
