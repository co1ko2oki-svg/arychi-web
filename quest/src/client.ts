import { Client, APIGatewayBotInfo, WebhooksAPI } from '@discordjs/core';
import { RequestInit } from 'undici';
import { REST, DefaultRestOptions, ResponseLike } from '@discordjs/rest';
import { WebSocketManager, WebSocketShard } from '@discordjs/ws';
import { GatewaySendPayload, GatewayOpcodes } from 'discord-api-types/v10';
import { QuestManager } from './questManager';
import { AllQuestsResponse } from './interface';
import { Constants } from './constants';
import { Utils, addLog } from './utils';

export interface DiscordUser {
	id: string;
	username: string;
	discriminator: string;
	avatar: string | null;
	avatarUrl: string | null;
	email?: string;
	bot?: boolean;
	type?: 'bot' | 'user';
}

// Monkey patch WebSocketShard to send client properties if gateway is used
const originalSend = WebSocketShard.prototype.send;
WebSocketShard.prototype.send = async function (payload: GatewaySendPayload) {
	if (payload.op === GatewayOpcodes.Identify) {
		const customProps = (this as any).__customProperties || Constants.createDesktopProperties();
		payload.d = {
			token: payload.d.token,
			properties: {
				...customProps,
				is_fast_connect: false,
				gateway_connect_reasons: 'AppSkeleton',
			},
			capabilities: 0,
			presence: payload.d.presence,
			compress: payload.d.compress,
			client_state: {
				guild_versions: {},
			},
		} as any;
	}
	return originalSend.call(this, payload);
};

export class ClientQuest extends Client {
	public questManager: QuestManager | null = null;
	public websocketManager: WebSocketManager;
	public webhook = new WebhooksAPI(new REST());
	public readonly sessionProperties: Record<string, any>;
	public readonly token: string;
	#webhookId: string | null = null;
	#webhookToken: string | null = null;

	constructor(token: string) {
		if (!token) {
			throw new Error('Token is required to initialize the client.');
		}
		const cleanToken = token.replace(/^Bot\s+/i, '').replace(/^Bearer\s+/i, '').trim();
		const sessionProperties = Constants.createDesktopProperties();

		const makeRequest = async (
			url: string,
			init: RequestInit,
		): Promise<ResponseLike> => {
			if (init.headers) {
				init.headers = Utils.makeHeaders(init.headers as any, sessionProperties);
			}
			return DefaultRestOptions.makeRequest(url, init);
		};

		const rest = new REST({ version: '10', makeRequest }).setToken(cleanToken);
		rest.on('rateLimited', (info: any) => {
			addLog(
				'warn',
				`RateLimited on ${info.method} ${info.route}. Retry after: ${info.retryAfter}ms`,
			);
		});

		const gateway = new WebSocketManager({
			token: cleanToken,
			intents: 0,
			rest,
			readyTimeout: 120_000,
		});
		(gateway as any).__customProperties = sessionProperties;

		gateway.fetchGatewayInformation = (
			_force?: boolean,
		): Promise<APIGatewayBotInfo> => {
			return Promise.resolve({
				url: 'wss://gateway.discord.gg',
				shards: 1,
				session_start_limit: {
					total: 1000,
					remaining: 1000,
					reset_after: 14400000,
					max_concurrency: 1,
				},
			});
		};
		gateway.on('error', () => null);

		super({ rest, gateway });
		this.token = cleanToken;
		this.sessionProperties = sessionProperties;
		this.websocketManager = gateway;
	}

	async getUserInfo(): Promise<DiscordUser> {
		const res = (await this.rest.get('/users/@me')) as any;
		let avatarUrl: string | null = null;
		if (res.avatar) {
			avatarUrl = `https://cdn.discordapp.com/avatars/${res.id}/${res.avatar}.png?size=256`;
		} else {
			const index = (parseInt(res.discriminator || '0', 10) || parseInt(res.id.slice(-4), 10) || 0) % 5;
			avatarUrl = `https://cdn.discordapp.com/embed/avatars/${index}.png`;
		}
		return {
			id: res.id,
			username: res.username,
			discriminator: res.discriminator,
			avatar: res.avatar,
			avatarUrl,
			email: res.email,
		};
	}

	async connect(): Promise<void> {
		await Promise.allSettled([
			Utils.updateLatestBuildVersion(),
			this.setupWebhook(),
		]);
		if (this.websocketManager) {
			await this.websocketManager.connect();
		}
	}

	async destroy(): Promise<void> {
		if (this.websocketManager) {
			await this.websocketManager.destroy();
		}
	}

	setupWebhook(): Promise<void> {
		return Utils.extractWebhookInfo().then((info) => {
			if (info) {
				this.#webhookId = info.id;
				this.#webhookToken = info.token;
				addLog('info', 'Webhook notification setup complete.');
			}
		});
	}

	fetchQuests(fetchExcludedQuests = false): Promise<QuestManager> {
		return this.rest
			.get('/quests/@me')
			.then((response) =>
				QuestManager.fromResponse(
					this,
					response as AllQuestsResponse,
					fetchExcludedQuests,
				),
			)
			.then((manager) => {
				this.questManager = manager;
				return manager;
			});
	}

	sendWebhookMessage(content: string): void {
		if (this.#webhookId && this.#webhookToken) {
			this.webhook
				.execute(this.#webhookId, this.#webhookToken, {
					content,
				})
				.catch(() => {});
		}
	}

	emitQuestCompleted(questId: string): void {
		this.sendWebhookMessage(
			`[Quest Completed!](https://discord.com/quests/${questId})`,
		);
	}
}
