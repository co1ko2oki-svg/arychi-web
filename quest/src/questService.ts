import { EventEmitter } from 'node:events';
import { fetch } from 'undici';
import { ClientQuest, DiscordUser } from './client';
import { QuestManager, QuestProgressEvent } from './questManager';
import { QuestDTO } from './quest';
import { addLog } from './utils';
import { createHash } from 'node:crypto';

export interface QuestJob {
	questId: string;
	tokenKey: string;
	tokenMasked: string;
	questName: string;
	taskType: string;
	status: 'idle' | 'enrolling' | 'running' | 'completed' | 'cancelled' | 'error';
	progressPercent: number;
	currentSeconds: number;
	targetSeconds: number;
	remainingMinutes: number;
	message: string;
	startedAt: number;
	completedAt?: number;
	abortController: AbortController;
}

const MAX_JOBS_HISTORY = 150;

export class QuestService extends EventEmitter {
	private readonly clients = new Map<string, ClientQuest>();
	private readonly jobs = new Map<string, QuestJob>();

	private hashToken(token: string): string {
		return createHash('sha256').update(token.trim()).digest('hex').slice(0, 16);
	}

	private maskToken(token: string): string {
		const clean = token.replace(/^Bot\s+/i, '').replace(/^Bearer\s+/i, '').trim();
		if (clean.length < 12) return '***';
		return `${clean.slice(0, 6)}...${clean.slice(-4)}`;
	}

	private pruneJobs() {
		if (this.jobs.size <= MAX_JOBS_HISTORY) return;
		const now = Date.now();
		for (const [key, job] of this.jobs.entries()) {
			if (
				(job.status === 'completed' || job.status === 'cancelled' || job.status === 'error') &&
				now - (job.completedAt || job.startedAt) > 3600_000
			) {
				this.jobs.delete(key);
			}
			if (this.jobs.size <= MAX_JOBS_HISTORY) break;
		}
	}

	getOrCreateClient(token: string): ClientQuest {
		const tokenKey = this.hashToken(token);
		let client = this.clients.get(tokenKey);
		if (!client) {
			client = new ClientQuest(token);
			this.clients.set(tokenKey, client);
		}
		return client;
	}

	async verifyToken(
		rawToken: string,
		preferredType?: 'bot' | 'user',
	): Promise<{ valid: boolean; user?: DiscordUser; error?: string }> {
		const cleanToken = rawToken.replace(/^Bot\s+/i, '').replace(/^Bearer\s+/i, '').trim();
		if (!cleanToken) {
			return { valid: false, error: 'Token không được để trống.' };
		}

		const isExplicitBot = preferredType === 'bot' || rawToken.trim().startsWith('Bot ');

		const formatAvatar = (data: any): string => {
			if (data.avatar) {
				return `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png?size=256`;
			}
			const index = (parseInt(data.discriminator || '0', 10) || parseInt(data.id.slice(-4), 10) || 0) % 5;
			return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
		};

		// 1. Try bot auth if requested or explicit
		if (isExplicitBot) {
			try {
				const botRes = await fetch('https://discord.com/api/v10/users/@me', {
					headers: {
						Authorization: `Bot ${cleanToken}`,
						'User-Agent': 'DiscordBot (https://discord.com, v10)',
					},
				});
				if (botRes.ok) {
					const data: any = await botRes.json();
					const user: DiscordUser = {
						id: data.id,
						username: data.username,
						discriminator: data.discriminator || '0000',
						avatar: data.avatar || null,
						avatarUrl: formatAvatar(data),
						email: data.email,
						bot: true,
						type: 'bot',
					};
					addLog('success', `Đã xác thực thành công Bot Discord @${user.username} (${user.id})`);
					return { valid: true, user };
				}
			} catch (err: any) {
				addLog('warn', `Bot verification error: ${err.message}`);
			}
		}

		// 2. Try user auth
		try {
			const client = this.getOrCreateClient(cleanToken);
			const user = await client.getUserInfo();
			user.bot = false;
			user.type = 'user';
			addLog('info', `Verified token for user @${user.username} (${user.id})`);
			return { valid: true, user };
		} catch (error: any) {
			// 3. Fallback: If user auth failed, try bot auth if not tried yet
			if (!isExplicitBot) {
				try {
					const botRes = await fetch('https://discord.com/api/v10/users/@me', {
						headers: {
							Authorization: `Bot ${cleanToken}`,
							'User-Agent': 'DiscordBot (https://discord.com, v10)',
						},
					});
					if (botRes.ok) {
						const data: any = await botRes.json();
						const user: DiscordUser = {
							id: data.id,
							username: data.username,
							discriminator: data.discriminator || '0000',
							avatar: data.avatar || null,
							avatarUrl: formatAvatar(data),
							email: data.email,
							bot: true,
							type: 'bot',
						};
						addLog('success', `Đã tự động xác thực Bot Discord @${user.username} (${user.id})`);
						return { valid: true, user };
					}
				} catch {}
			}

			const msg = error?.message || 'Token không hợp lệ hoặc đã hết hạn.';
			addLog('error', `Token verification failed: ${msg}`);
			return { valid: false, error: msg };
		}
	}

	async fetchQuests(token: string): Promise<{
		quests: QuestDTO[];
		questEnrollmentBlockedUntil: string | null;
	}> {
		if (token.startsWith('Bot ')) {
			return { quests: [], questEnrollmentBlockedUntil: null };
		}
		const client = this.getOrCreateClient(token);
		const manager = await client.fetchQuests(false);
		const dtos = manager.list().map((q) => q.toDTO());
		return {
			quests: dtos,
			questEnrollmentBlockedUntil: (manager as any).quest_enrollment_blocked_until ?? null,
		};
	}

	async enrollQuest(token: string, questId: string): Promise<QuestDTO> {
		const client = this.getOrCreateClient(token);
		if (!client.questManager) {
			await client.fetchQuests(false);
		}
		const quest = client.questManager?.get(questId);
		if (!quest) {
			throw new Error(`Quest ID "${questId}" not found.`);
		}
		const isAndroid =
			Boolean(quest.config.task_config_v2.tasks.WATCH_VIDEO_ON_MOBILE) &&
			!Boolean(quest.config.task_config_v2.tasks.WATCH_VIDEO);

		await client.questManager!.acceptQuest(quest, isAndroid);
		addLog('success', `Enrolled in quest "${quest.config.messages.quest_name}"`, questId);
		return quest.toDTO();
	}

	async startQuest(token: string, questId: string): Promise<QuestJob> {
		this.pruneJobs();
		const tokenKey = this.hashToken(token);
		const jobKey = `${tokenKey}:${questId}`;

		const existingJob = this.jobs.get(jobKey);
		if (existingJob && (existingJob.status === 'running' || existingJob.status === 'enrolling')) {
			return existingJob;
		}

		const client = this.getOrCreateClient(token);
		if (!client.questManager) {
			await client.fetchQuests(false);
		}

		const quest = client.questManager?.get(questId);
		if (!quest) {
			throw new Error(`Quest with ID ${questId} was not found.`);
		}

		const abortController = new AbortController();
		const questName = quest.config.messages.quest_name || 'Quest';
		const dto = quest.toDTO();

		const job: QuestJob = {
			questId,
			tokenKey,
			tokenMasked: this.maskToken(token),
			questName,
			taskType: dto.task.type,
			status: 'idle',
			progressPercent: dto.task.progressPercent,
			currentSeconds: dto.task.currentSeconds,
			targetSeconds: dto.task.targetSeconds,
			remainingMinutes: dto.task.remainingMinutes,
			message: 'Starting quest...',
			startedAt: Date.now(),
			abortController,
		};

		this.jobs.set(jobKey, job);
		this.emit('job:update', job);

		// Execute asynchronously in background
		(async () => {
			try {
				await client.questManager!.doingQuest(
					quest,
					abortController.signal,
					(event: QuestProgressEvent) => {
						job.status = event.status;
						job.progressPercent = event.progressPercent;
						job.currentSeconds = event.currentSeconds;
						job.targetSeconds = event.targetSeconds;
						job.remainingMinutes = event.remainingMinutes;
						if (event.message) job.message = event.message;

						this.emit('job:progress', {
							...job,
							tokenMasked: job.tokenMasked,
						});
					},
				);

				if (!abortController.signal.aborted && job.status !== 'error' && job.status !== 'cancelled') {
					job.status = 'completed';
					job.progressPercent = 100;
					job.remainingMinutes = 0;
					job.completedAt = Date.now();
					job.message = 'Quest completed successfully!';
				}
			} catch (err: any) {
				job.status = 'error';
				job.message = err?.message || 'Error occurred during quest execution';
				job.completedAt = Date.now();
				addLog('error', `Error in quest "${questName}": ${err.message}`, questId);
			} finally {
				this.emit('job:update', job);
			}
		})();

		return job;
	}

	stopQuest(token: string, questId: string): boolean {
		const tokenKey = this.hashToken(token);
		const jobKey = `${tokenKey}:${questId}`;
		const job = this.jobs.get(jobKey);
		if (job && (job.status === 'running' || job.status === 'enrolling' || job.status === 'idle')) {
			job.abortController.abort();
			job.status = 'cancelled';
			job.message = 'Cancelled by user request.';
			job.completedAt = Date.now();
			this.emit('job:update', job);
			return true;
		}
		return false;
	}

	async startAllQuests(token: string): Promise<QuestJob[]> {
		const client = this.getOrCreateClient(token);
		const manager = await client.fetchQuests(false);
		const questsValid = manager.filterQuestsValidToDo();

		addLog('info', `Found ${questsValid.length} valid quests to start for ${this.maskToken(token)}`);
		const jobs: QuestJob[] = [];

		for (const quest of questsValid) {
			const job = await this.startQuest(token, quest.id);
			jobs.push(job);
			// Stagger requests slightly to avoid burst rate-limits
			await new Promise((resolve) => setTimeout(resolve, 500));
		}
		return jobs;
	}

	stopAllQuests(token: string): number {
		const tokenKey = this.hashToken(token);
		let stoppedCount = 0;
		for (const [key, job] of this.jobs.entries()) {
			if (key.startsWith(`${tokenKey}:`)) {
				if (job.status === 'running' || job.status === 'enrolling' || job.status === 'idle') {
					job.abortController.abort();
					job.status = 'cancelled';
					job.message = 'Stopped as part of stop-all request.';
					job.completedAt = Date.now();
					this.emit('job:update', job);
					stoppedCount++;
				}
			}
		}
		return stoppedCount;
	}

	async claimQuestReward(token: string, questId: string): Promise<void> {
		const client = this.getOrCreateClient(token);
		if (!client.questManager) {
			await client.fetchQuests(false);
		}
		const quest = client.questManager?.get(questId);
		if (!quest) {
			throw new Error(`Quest ID "${questId}" not found.`);
		}
		await client.questManager!.redeemQuest(quest);
	}

	getJobs(token?: string): QuestJob[] {
		if (!token) {
			return Array.from(this.jobs.values()).map((j) => ({
				...j,
			}));
		}
		const tokenKey = this.hashToken(token);
		return Array.from(this.jobs.values()).filter((j) => j.tokenKey === tokenKey);
	}

	stopAllRunningJobsGlobally(): number {
		let count = 0;
		for (const job of this.jobs.values()) {
			if (job.status === 'running' || job.status === 'enrolling' || job.status === 'idle') {
				job.abortController.abort();
				job.status = 'cancelled';
				job.message = 'Terminated due to server shutdown.';
				count++;
			}
		}
		return count;
	}
}

export const questService = new QuestService();
