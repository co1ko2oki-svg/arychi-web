import { APIApplication } from 'discord-api-types/v10';
import { solveCaptcha } from './captcha';
import { ClientQuest } from './client';
import type {
	AllQuestsResponse,
	CaptchaDataFromRequest,
	QuestTaskConfigType,
} from './interface';
import { Quest } from './quest';
import { Utils, addLog } from './utils';
import { buildConnector, Client } from 'undici';

export interface QuestProgressEvent {
	questId: string;
	questName: string;
	taskType: string;
	currentSeconds: number;
	targetSeconds: number;
	progressPercent: number;
	remainingMinutes: number;
	status: 'enrolling' | 'running' | 'completed' | 'cancelled' | 'error';
	message?: string;
}

export type QuestProgressCallback = (event: QuestProgressEvent) => void;

export class QuestManager implements Iterable<Quest> {
	private readonly quests = new Map<string, Quest>();
	public readonly client: ClientQuest;

	constructor(client: ClientQuest, quests: Quest[] = []) {
		this.client = client;
		quests.forEach((quest) => this.quests.set(quest.id, quest));
	}

	static async fromResponse(
		client: ClientQuest,
		response: AllQuestsResponse,
		fetchExcludedQuests = false,
	): Promise<QuestManager> {
		if (response.quest_enrollment_blocked_until !== null) {
			addLog('warn', `Quest enrollment is blocked until ${response.quest_enrollment_blocked_until}.`);
		}
		const questManager = new QuestManager(
			client,
			(response.quests || []).map((quest) => Quest.create(quest)),
		);
		if (fetchExcludedQuests && response.excluded_quests) {
			for (const quest of response.excluded_quests) {
				if (quest.id) {
					await questManager.addExcludedQuest(quest.id);
				}
			}
		}
		return questManager;
	}

	protected addExcludedQuest(questId: string): Promise<void> {
		return this.client.rest
			.get(`/quests/${questId}`)
			.then((response) => {
				const quest = Quest.create({
					id: questId,
					config: response as any,
					user_status: null,
					targeted_content: 0,
					preview: false,
				});
				addLog(
					'info',
					`Added excluded quest "${quest.config.messages.quest_name}" to manager.`,
					questId,
				);
				this.quests.set(quest.id, quest);
			})
			.catch((err) => {
				addLog(
					'warn',
					`Failed to fetch excluded quest "${questId}": ${err.message}`,
					questId,
				);
			});
	}

	[Symbol.iterator](): IterableIterator<Quest> {
		return this.quests.values();
	}

	get size(): number {
		return this.quests.size;
	}

	list(): Quest[] {
		return Array.from(this.quests.values());
	}

	get(id: string): Quest | undefined {
		return this.quests.get(id);
	}

	upsert(quest: Quest): void {
		this.quests.set(quest.id, quest);
	}

	remove(id: string): boolean {
		return this.quests.delete(id);
	}

	clear(): void {
		this.quests.clear();
	}

	getExpired(date: Date = new Date()): Quest[] {
		return this.list().filter((quest) => quest.isExpired(date));
	}

	getCompleted(): Quest[] {
		return this.list().filter((quest) => quest.isCompleted());
	}

	getClaimable(): Quest[] {
		return this.list().filter(
			(quest) => quest.isCompleted() && !quest.hasClaimedRewards(),
		);
	}

	hasQuest(id: string): boolean {
		return this.quests.has(id);
	}

	filterQuestsValidToDo(): Quest[] {
		return this.list().filter(
			(quest) => !quest.isCompleted() && !quest.isExpired(),
		);
	}

	filterQuestsValidToRedeem(): Quest[] {
		return this.list().filter(
			(quest) => quest.isCompleted() && !quest.hasClaimedRewards(),
		);
	}

	getApplicationData(ids: string[]) {
		const query = new URLSearchParams();
		ids.forEach((id) => query.append('application_ids', id));
		return this.client.rest.get(`/applications/public`, {
			query,
		}) as Promise<
			{
				id: string;
				name: string;
				icon: string;
				description: string;
				executables: {
					os: string;
					name: string;
					is_launcher: boolean;
				}[];
			}[]
		>;
	}

	/**
	 * Enroll in a quest.
	 */
	acceptQuest(quest: Quest, isAndroid = false): Promise<Quest | undefined> {
		return this.client.rest
			.post(`/quests/${quest.id}/enroll`, {
				body: {
					location: isAndroid ? 12 : 11,
					is_targeted: false,
					metadata_sealed: null,
					traffic_metadata_raw: quest.raw.traffic_metadata_raw,
					traffic_metadata_sealed: quest.raw.traffic_metadata_sealed,
				},
				headers: {
					AndroidRequest: isAndroid ? 'true' : 'false',
				},
			})
			.then((r) => {
				quest.updateUserStatus(r as any);
				const q = this.get(quest.id);
				q?.updateUserStatus(r as any);
				return q || quest;
			});
	}

	private async timeout(ms: number, signal?: AbortSignal): Promise<void> {
		return new Promise((resolve) => {
			if (signal?.aborted) return resolve();
			const timer = setTimeout(resolve, ms);
			signal?.addEventListener(
				'abort',
				() => {
					clearTimeout(timer);
					resolve();
				},
				{ once: true },
			);
		});
	}

	async redeemQuest(
		quest: Quest,
		retry = 0,
		captchaHeaders?: Record<string, string>,
	): Promise<void> {
		if (retry === 3) {
			addLog(
				'error',
				`Failed to redeem quest "${quest.config.messages.quest_name}" after ${retry} attempts.`,
				quest.id,
			);
			return;
		}
		if (!quest.isCompleted()) {
			addLog('warn', `Cannot redeem rewards for incomplete quest "${quest.config.messages.quest_name}".`, quest.id);
			return;
		}
		if (quest.hasClaimedRewards()) {
			addLog('info', `Rewards for quest "${quest.config.messages.quest_name}" already claimed.`, quest.id);
			return;
		}
		try {
			const agent = new Client('https://discord.com', {
				connect: buildConnector({
					ciphers: [
						'TLS_AES_128_GCM_SHA256',
						'TLS_AES_256_GCM_SHA384',
						'TLS_CHACHA20_POLY1305_SHA256',
						'ECDHE-ECDSA-AES128-GCM-SHA256',
						'ECDHE-RSA-AES128-GCM-SHA256',
						'ECDHE-ECDSA-AES256-GCM-SHA384',
						'ECDHE-RSA-AES256-GCM-SHA384',
						'ECDHE-ECDSA-CHACHA20-POLY1305',
						'ECDHE-RSA-CHACHA20-POLY1305',
						'ECDHE-RSA-AES128-SHA',
						'ECDHE-RSA-AES256-SHA',
						'AES128-GCM-SHA256',
						'AES256-GCM-SHA384',
						'AES128-SHA',
						'AES256-SHA',
					].join(':'),
				}),
			});
			const res = (await this.client.rest.post(
				`/quests/${quest.id}/claim-reward`,
				{
					body: {
						platform: quest.raw.config.rewards_config.platforms[0],
						location: 11,
						is_targeted: false,
						metadata_raw: null,
						metadata_sealed: null,
						traffic_metadata_raw: quest.raw.traffic_metadata_raw,
						traffic_metadata_sealed:
							quest.raw.traffic_metadata_sealed,
					},
					headers: captchaHeaders,
					dispatcher: agent,
				},
			)) as any;
			addLog(
				'success',
				`Claimed rewards for quest "${quest.config.messages.quest_name}"!`,
				quest.id,
			);
			quest.updateUserStatus(res);
		} catch (err: any) {
			const rawError = err.rawError as CaptchaDataFromRequest;
			if (rawError && rawError['captcha_key'] && rawError['captcha_sitekey']) {
				addLog(
					'warn',
					`Captcha required to redeem rewards for "${quest.config.messages.quest_name}".`,
					quest.id,
				);
				try {
					const solvedCaptchaKey = await solveCaptcha(rawError);
					return this.redeemQuest(quest, retry + 1, {
						'x-captcha-key': solvedCaptchaKey,
						'x-captcha-rqtoken': rawError['captcha_rqtoken'],
						'x-captcha-session-id': rawError['captcha_session_id'],
					});
				} catch (captchaErr: any) {
					addLog(
						'error',
						`Captcha solving failed: ${captchaErr.message}`,
						quest.id,
					);
				}
			} else {
				addLog(
					'error',
					`Failed to redeem rewards for "${quest.config.messages.quest_name}": ${err.message}`,
					quest.id,
				);
			}
		}
	}

	async doingQuest(
		quest: Quest,
		abortSignal?: AbortSignal,
		onProgress?: QuestProgressCallback,
	): Promise<void> {
		const questName = quest.config.messages.quest_name;
		const isAndroid =
			Boolean(quest.config.task_config_v2.tasks.WATCH_VIDEO_ON_MOBILE) &&
			!Boolean(quest.config.task_config_v2.tasks.WATCH_VIDEO);

		if (abortSignal?.aborted) {
			onProgress?.({
				questId: quest.id,
				questName,
				taskType: 'UNKNOWN',
				currentSeconds: 0,
				targetSeconds: 0,
				progressPercent: 0,
				remainingMinutes: 0,
				status: 'cancelled',
				message: 'Task cancelled before start.',
			});
			return;
		}

		if (!quest.isEnrolledQuest()) {
			addLog(
				'info',
				`Enrolling in quest "${questName}" (${isAndroid ? 'Android' : 'Desktop'})...`,
				quest.id,
			);
			onProgress?.({
				questId: quest.id,
				questName,
				taskType: 'ENROLL',
				currentSeconds: 0,
				targetSeconds: 0,
				progressPercent: 0,
				remainingMinutes: 0,
				status: 'enrolling',
				message: `Enrolling in quest...`,
			});
			try {
				await this.acceptQuest(quest, isAndroid);
			} catch (err: any) {
				addLog(
					'error',
					`Failed to enroll in quest "${questName}": ${err?.message}`,
					quest.id,
				);
				onProgress?.({
					questId: quest.id,
					questName,
					taskType: 'ENROLL',
					currentSeconds: 0,
					targetSeconds: 0,
					progressPercent: 0,
					remainingMinutes: 0,
					status: 'error',
					message: `Enrollment failed: ${err?.message}`,
				});
				return;
			}
		} else {
			addLog('info', `Already enrolled in quest "${questName}".`, quest.id);
		}

		const applicationName = quest.config.application.name;
		const taskConfig = quest.config.task_config_v2;
		const taskName = [
			'WATCH_VIDEO',
			'PLAY_ON_DESKTOP',
			'PLAY_ON_DESKTOP_V2',
			'PLAY_ON_XBOX',
			'PLAY_ON_PLAYSTATION',
			'STREAM_ON_DESKTOP',
			'PLAY_ACTIVITY',
			'WATCH_VIDEO_ON_MOBILE',
			'ACHIEVEMENT_IN_ACTIVITY',
		].find(
			(x) => taskConfig.tasks[x as QuestTaskConfigType] != null,
		) as QuestTaskConfigType;

		if (!taskName || !taskConfig.tasks[taskName]) {
			addLog('warn', `Unknown or unsupported task type for quest "${questName}".`, quest.id);
			onProgress?.({
				questId: quest.id,
				questName,
				taskType: 'UNKNOWN',
				currentSeconds: 0,
				targetSeconds: 0,
				progressPercent: 0,
				remainingMinutes: 0,
				status: 'error',
				message: `Unsupported task type.`,
			});
			return;
		}

		const secondsNeeded = taskConfig.tasks[taskName].target;
		const secondsDone = quest.userStatus?.progress?.[taskName]?.value ?? 0;

		switch (taskName) {
			case 'WATCH_VIDEO':
			case 'WATCH_VIDEO_ON_MOBILE': {
				await this.doingWatchVideoQuest(
					quest,
					questName,
					secondsNeeded,
					secondsDone,
					abortSignal,
					onProgress,
				);
				break;
			}
			case 'PLAY_ON_XBOX':
			case 'PLAY_ON_PLAYSTATION':
			case 'PLAY_ON_DESKTOP':
			case 'PLAY_ON_DESKTOP_V2' as any: {
				await this.doingPlayOnPlatformQuest(
					quest,
					questName,
					secondsNeeded,
					taskName,
					applicationName,
					abortSignal,
					onProgress,
				);
				break;
			}
			case 'PLAY_ACTIVITY': {
				await this.doingPlayActivityQuest(
					quest,
					questName,
					secondsNeeded,
					taskName,
					applicationName,
					abortSignal,
					onProgress,
				);
				break;
			}
			case 'STREAM_ON_DESKTOP': {
				addLog(
					'warn',
					`STREAM_ON_DESKTOP is not supported via selfbot node. Complete in desktop app: ${questName}`,
					quest.id,
				);
				onProgress?.({
					questId: quest.id,
					questName,
					taskType: 'STREAM_ON_DESKTOP',
					currentSeconds: secondsDone,
					targetSeconds: secondsNeeded,
					progressPercent: 0,
					remainingMinutes: 0,
					status: 'error',
					message: `STREAM_ON_DESKTOP requires Discord Desktop Client.`,
				});
				break;
			}
			case 'ACHIEVEMENT_IN_ACTIVITY': {
				await this.doingAchievementInActivityQuest(
					quest,
					questName,
					abortSignal,
					onProgress,
				);
				break;
			}
			default: {
				addLog(
					'warn',
					`Unsupported quest type. Use Discord app for: ${questName}`,
					quest.id,
				);
			}
		}
	}

	async doingWatchVideoQuest(
		quest: Quest,
		questName: string,
		secondsNeeded: number,
		initialSecondsDone: number,
		abortSignal?: AbortSignal,
		onProgress?: QuestProgressCallback,
	) {
		const maxFuture = 10;
		const speed = 7;
		const interval = 7;
		let enrolledAt = quest.userStatus?.enrolled_at
			? new Date(quest.userStatus.enrolled_at).getTime()
			: Date.now();
		if (isNaN(enrolledAt)) {
			enrolledAt = Date.now();
		}

		let secondsDone = initialSecondsDone;
		let completed = false;
		let consecutiveErrors = 0;

		addLog('info', `Spoofing video watching for "${questName}" (${secondsNeeded}s required).`, quest.id);

		while (true) {
			if (abortSignal?.aborted) {
				addLog('warn', `Watch video quest "${questName}" stopped by user.`, quest.id);
				onProgress?.({
					questId: quest.id,
					questName,
					taskType: 'WATCH_VIDEO',
					currentSeconds: secondsDone,
					targetSeconds: secondsNeeded,
					progressPercent: Math.min(100, Math.round((secondsDone / secondsNeeded) * 100)),
					remainingMinutes: Math.ceil((secondsNeeded - secondsDone) / 60),
					status: 'cancelled',
					message: 'Task stopped by user.',
				});
				return;
			}

			const maxAllowed =
				Math.floor((Date.now() - enrolledAt) / 1000) + maxFuture;
			const diff = maxAllowed - secondsDone;
			const timestamp = secondsDone + speed;

			if (diff >= speed) {
				try {
					const res = (await this.client.rest.post(
						`/quests/${quest.id}/video-progress`,
						{
							body: {
								timestamp: Math.min(
									secondsNeeded,
									timestamp + Math.random(),
								),
							},
						},
					)) as any;
					consecutiveErrors = 0;
					completed = res.completed_at != null;
					secondsDone = Math.min(secondsNeeded, timestamp);
					quest.updateUserStatus(res);

					const percent = Math.min(100, Math.round((secondsDone / secondsNeeded) * 100));
					onProgress?.({
						questId: quest.id,
						questName,
						taskType: 'WATCH_VIDEO',
						currentSeconds: secondsDone,
						targetSeconds: secondsNeeded,
						progressPercent: percent,
						remainingMinutes: Math.ceil((secondsNeeded - secondsDone) / 60),
						status: completed ? 'completed' : 'running',
						message: `Watching video: ${secondsDone}/${secondsNeeded}s (${percent}%)`,
					});
				} catch (err: any) {
					consecutiveErrors++;
					addLog('warn', `Video progress error for "${questName}" (attempt ${consecutiveErrors}/3): ${err?.message}`, quest.id);
					if (consecutiveErrors >= 3) {
						addLog('error', `Aborting video quest "${questName}" after 3 consecutive errors.`, quest.id);
						onProgress?.({
							questId: quest.id,
							questName,
							taskType: 'WATCH_VIDEO',
							currentSeconds: secondsDone,
							targetSeconds: secondsNeeded,
							progressPercent: Math.min(100, Math.round((secondsDone / secondsNeeded) * 100)),
							remainingMinutes: Math.ceil((secondsNeeded - secondsDone) / 60),
							status: 'error',
							message: `Failed after 3 network errors: ${err?.message}`,
						});
						return;
					}
				}
			}

			if (timestamp >= secondsNeeded || completed) {
				break;
			}
			await this.timeout(interval * 1000, abortSignal);
		}

		if (!completed && !abortSignal?.aborted) {
			try {
				const res = await this.client.rest.post(
					`/quests/${quest.id}/video-progress`,
					{
						body: { timestamp: secondsNeeded },
					},
				);
				quest.updateUserStatus(res as any);
			} catch {}
		}

		addLog('success', `Quest "${questName}" completed!`, quest.id);
		this.client.emitQuestCompleted(quest.id);
		onProgress?.({
			questId: quest.id,
			questName,
			taskType: 'WATCH_VIDEO',
			currentSeconds: secondsNeeded,
			targetSeconds: secondsNeeded,
			progressPercent: 100,
			remainingMinutes: 0,
			status: 'completed',
			message: `Quest completed successfully!`,
		});
	}

	async doingPlayOnPlatformQuest(
		quest: Quest,
		questName: string,
		secondsNeeded: number,
		taskName: string,
		applicationName: string,
		abortSignal?: AbortSignal,
		onProgress?: QuestProgressCallback,
	) {
		const interval = 20;
		let consecutiveErrors = 0;
		addLog(
			'info',
			`Spoofing game play for "${questName}" (${applicationName}). Target: ${Math.ceil(secondsNeeded / 60)} minutes.`,
			quest.id,
		);

		while (!quest.isCompleted()) {
			if (abortSignal?.aborted) {
				addLog('warn', `Stopping game spoofing for "${questName}"... Sending terminal heartbeat.`, quest.id);
				try {
					await this.client.rest.post(
						`/quests/${quest.id}/heartbeat`,
						{
							body: {
								application_id: quest.config.application.id,
								terminal: true,
							},
						},
					);
				} catch {}
				onProgress?.({
					questId: quest.id,
					questName,
					taskType: taskName,
					currentSeconds: (quest.userStatus?.progress?.[taskName]?.value as number) || 0,
					targetSeconds: secondsNeeded,
					progressPercent: Math.min(100, Math.round((((quest.userStatus?.progress?.[taskName]?.value as number) || 0) / secondsNeeded) * 100)),
					remainingMinutes: Math.ceil((secondsNeeded - (((quest.userStatus?.progress?.[taskName]?.value as number) || 0))) / 60),
					status: 'cancelled',
					message: 'Game spoofing stopped by user.',
				});
				return;
			}

			const secondsDone =
				(quest.userStatus?.progress?.[taskName]?.value as number) || 0;

			try {
				const res = await this.client.rest.post(
					`/quests/${quest.id}/heartbeat`,
					{
						body: {
							application_id: quest.config.application.id,
							terminal: false,
						},
					},
				);
				consecutiveErrors = 0;
				quest.updateUserStatus(res as any);
			} catch (err: any) {
				consecutiveErrors++;
				addLog('warn', `Heartbeat error for "${questName}" (fail ${consecutiveErrors}/5): ${err?.message}`, quest.id);
				if (consecutiveErrors >= 5) {
					addLog('error', `Aborting game spoofing for "${questName}" after 5 consecutive errors.`, quest.id);
					onProgress?.({
						questId: quest.id,
						questName,
						taskType: taskName,
						currentSeconds: secondsDone,
						targetSeconds: secondsNeeded,
						progressPercent: Math.min(100, Math.round((secondsDone / secondsNeeded) * 100)),
						remainingMinutes: Math.ceil((secondsNeeded - secondsDone) / 60),
						status: 'error',
						message: `Heartbeat failed repeatedly: ${err?.message}`,
					});
					return;
				}
			}

			const currentDone =
				(quest.userStatus?.progress?.[taskName]?.value as number) || secondsDone;
			const remainingMinutes = Math.max(0, Math.ceil((secondsNeeded - currentDone) / 60));
			const progressPercent = Math.min(100, Math.round((currentDone / secondsNeeded) * 100));

			addLog(
				'info',
				`Spoofing game [${applicationName}]: ${Math.floor(currentDone / 60)}/${Math.ceil(secondsNeeded / 60)}m (${progressPercent}%). Remaining: ${remainingMinutes}m`,
				quest.id,
			);

			onProgress?.({
				questId: quest.id,
				questName,
				taskType: taskName,
				currentSeconds: currentDone,
				targetSeconds: secondsNeeded,
				progressPercent,
				remainingMinutes,
				status: 'running',
				message: `Playing ${applicationName}: ${Math.floor(currentDone / 60)}/${Math.ceil(secondsNeeded / 60)} min (${progressPercent}%)`,
			});

			if (quest.isCompleted() || currentDone >= secondsNeeded) {
				break;
			}
			await this.timeout(interval * 1000, abortSignal);
		}

		// Send terminal heartbeat when completed
		try {
			const res = await this.client.rest.post(
				`/quests/${quest.id}/heartbeat`,
				{
					body: {
						application_id: quest.config.application.id,
						terminal: true,
					},
				},
			);
			quest.updateUserStatus(res as any);
		} catch {}

		addLog('success', `Quest "${questName}" completed!`, quest.id);
		this.client.emitQuestCompleted(quest.id);
		onProgress?.({
			questId: quest.id,
			questName,
			taskType: taskName,
			currentSeconds: secondsNeeded,
			targetSeconds: secondsNeeded,
			progressPercent: 100,
			remainingMinutes: 0,
			status: 'completed',
			message: `Quest completed successfully!`,
		});
	}

	async doingPlayActivityQuest(
		quest: Quest,
		questName: string,
		secondsNeeded: number,
		taskName: string,
		applicationName: string,
		abortSignal?: AbortSignal,
		onProgress?: QuestProgressCallback,
	) {
		const interval = 20;
		const streamKey = 'call:1:1';
		let consecutiveErrors = 0;
		addLog(
			'info',
			`Spoofing activity for "${questName}" (${applicationName}). Target: ${Math.ceil(secondsNeeded / 60)} minutes.`,
			quest.id,
		);

		while (!quest.isCompleted()) {
			if (abortSignal?.aborted) {
				addLog('warn', `Stopping activity spoofing for "${questName}"...`, quest.id);
				try {
					await this.client.rest.post(
						`/quests/${quest.id}/heartbeat`,
						{
							body: { stream_key: streamKey, terminal: true },
						},
					);
				} catch {}
				onProgress?.({
					questId: quest.id,
					questName,
					taskType: taskName,
					currentSeconds: (quest.userStatus?.progress?.[taskName]?.value as number) || 0,
					targetSeconds: secondsNeeded,
					progressPercent: 0,
					remainingMinutes: 0,
					status: 'cancelled',
					message: 'Activity stopped by user.',
				});
				return;
			}

			const secondsDone =
				(quest.userStatus?.progress?.[taskName]?.value as number) || 0;

			try {
				const res = await this.client.rest.post(
					`/quests/${quest.id}/heartbeat`,
					{
						body: { stream_key: streamKey, terminal: false },
					},
				);
				consecutiveErrors = 0;
				quest.updateUserStatus(res as any);
			} catch (err: any) {
				consecutiveErrors++;
				addLog('warn', `Activity heartbeat error for "${questName}" (fail ${consecutiveErrors}/5): ${err?.message}`, quest.id);
				if (consecutiveErrors >= 5) {
					addLog('error', `Aborting activity quest "${questName}" after 5 consecutive errors.`, quest.id);
					onProgress?.({
						questId: quest.id,
						questName,
						taskType: taskName,
						currentSeconds: secondsDone,
						targetSeconds: secondsNeeded,
						progressPercent: Math.min(100, Math.round((secondsDone / secondsNeeded) * 100)),
						remainingMinutes: Math.ceil((secondsNeeded - secondsDone) / 60),
						status: 'error',
						message: `Activity heartbeat failed: ${err?.message}`,
					});
					return;
				}
			}

			const currentDone =
				(quest.userStatus?.progress?.[taskName]?.value as number) || secondsDone;
			const remainingMinutes = Math.max(0, Math.ceil((secondsNeeded - currentDone) / 60));
			const progressPercent = Math.min(100, Math.round((currentDone / secondsNeeded) * 100));

			onProgress?.({
				questId: quest.id,
				questName,
				taskType: taskName,
				currentSeconds: currentDone,
				targetSeconds: secondsNeeded,
				progressPercent,
				remainingMinutes,
				status: 'running',
				message: `Activity ${applicationName}: ${Math.floor(currentDone / 60)}/${Math.ceil(secondsNeeded / 60)} min (${progressPercent}%)`,
			});

			if (quest.isCompleted() || currentDone >= secondsNeeded) {
				break;
			}
			await this.timeout(interval * 1000, abortSignal);
		}

		try {
			const res = await this.client.rest.post(
				`/quests/${quest.id}/heartbeat`,
				{
					body: { stream_key: streamKey, terminal: true },
				},
			);
			quest.updateUserStatus(res as any);
		} catch {}

		addLog('success', `Quest "${questName}" completed!`, quest.id);
		this.client.emitQuestCompleted(quest.id);
		onProgress?.({
			questId: quest.id,
			questName,
			taskType: taskName,
			currentSeconds: secondsNeeded,
			targetSeconds: secondsNeeded,
			progressPercent: 100,
			remainingMinutes: 0,
			status: 'completed',
			message: `Quest completed successfully!`,
		});
	}

	async doingAchievementInActivityQuest(
		quest: Quest,
		questName: string,
		abortSignal?: AbortSignal,
		onProgress?: QuestProgressCallback,
	) {
		const applicationId = quest.config.application.id;
		const applicationName = quest.config.application.name;
		const questTarget =
			quest.config.task_config_v2.tasks.ACHIEVEMENT_IN_ACTIVITY.target;

		if (abortSignal?.aborted) return;

		onProgress?.({
			questId: quest.id,
			questName,
			taskType: 'ACHIEVEMENT_IN_ACTIVITY',
			currentSeconds: 0,
			targetSeconds: questTarget,
			progressPercent: 10,
			remainingMinutes: 1,
			status: 'running',
			message: `Authorizing application ${applicationName}...`,
		});

		try {
			const query = new URLSearchParams({
				response_type: 'code',
				client_id: applicationId,
				scope: 'identify applications.commands applications.entitlements',
				state: '',
			});
			const res2 = (await this.client.rest.post(`/oauth2/authorize`, {
				query,
				body: {
					permissions: '0',
					authorize: true,
					integration_type: 1,
					location_context: {
						guild_id: '10000',
						channel_id: '10000',
						channel_type: 10000,
					},
				},
			})) as Record<string, any>;

			addLog('info', `Authorized application ${applicationName}`, quest.id);
			const location = res2?.location;
			let authCode: string | null = null;
			if (location) {
				authCode = new URL(location).searchParams.get('code');
			}
			if (!authCode) {
				addLog(
					'error',
					`No auth code received for ${applicationName}. Cannot complete quest.`,
					quest.id,
				);
				onProgress?.({
					questId: quest.id,
					questName,
					taskType: 'ACHIEVEMENT_IN_ACTIVITY',
					currentSeconds: 0,
					targetSeconds: questTarget,
					progressPercent: 0,
					remainingMinutes: 0,
					status: 'error',
					message: `No auth code received from Discord OAuth.`,
				});
				return;
			}

			if (abortSignal?.aborted) return;

			const { token, error: authError, activityReferrer } = await Utils.authorizeDiscordSays(
				applicationId,
				quest.id,
				authCode,
				this.client,
			);
			if (authError || !token) {
				addLog(
					'error',
					`Failed to authorize with Discord Says for ${applicationName}: ${authError}`,
					quest.id,
				);
				onProgress?.({
					questId: quest.id,
					questName,
					taskType: 'ACHIEVEMENT_IN_ACTIVITY',
					currentSeconds: 0,
					targetSeconds: questTarget,
					progressPercent: 0,
					remainingMinutes: 0,
					status: 'error',
					message: `Discord Says authorization failed: ${authError}`,
				});
				return;
			}

			const { success, error: progressError } =
				await Utils.progressDiscordSays(
					applicationId,
					quest.id,
					token,
					questTarget,
					activityReferrer,
				);
			if (progressError || !success) {
				addLog(
					'error',
					`Failed to progress quest with Discord Says for ${applicationName}: ${progressError}`,
					quest.id,
				);
				onProgress?.({
					questId: quest.id,
					questName,
					taskType: 'ACHIEVEMENT_IN_ACTIVITY',
					currentSeconds: 0,
					targetSeconds: questTarget,
					progressPercent: 0,
					remainingMinutes: 0,
					status: 'error',
					message: `Progress update failed: ${progressError}`,
				});
				return;
			}

			// Deauthorize token cleanly
			try {
				const res3 = (await this.client.rest.get(`/oauth2/tokens`)) as {
					id: string;
					scopes: string[];
					application: APIApplication;
					disclosures: number[];
				}[];
				const tokenInfo = res3.find((t) => t.application.id === applicationId);
				if (tokenInfo) {
					await this.client.rest.delete(`/oauth2/tokens/${tokenInfo.id}`);
					addLog('info', `Deauthorized application ${applicationName}`, quest.id);
				}
			} catch (err: any) {
				addLog('warn', `Failed to deauthorize token for ${applicationName}: ${err.message}`, quest.id);
			}

			addLog('success', `Quest "${questName}" completed!`, quest.id);
			this.client.emitQuestCompleted(quest.id);
			onProgress?.({
				questId: quest.id,
				questName,
				taskType: 'ACHIEVEMENT_IN_ACTIVITY',
				currentSeconds: questTarget,
				targetSeconds: questTarget,
				progressPercent: 100,
				remainingMinutes: 0,
				status: 'completed',
				message: `Quest completed successfully!`,
			});
		} catch (err: any) {
			addLog('error', `Error executing activity quest "${questName}": ${err?.message}`, quest.id);
			onProgress?.({
				questId: quest.id,
				questName,
				taskType: 'ACHIEVEMENT_IN_ACTIVITY',
				currentSeconds: 0,
				targetSeconds: questTarget,
				progressPercent: 0,
				remainingMinutes: 0,
				status: 'error',
				message: `Unexpected error: ${err?.message}`,
			});
		}
	}
}
