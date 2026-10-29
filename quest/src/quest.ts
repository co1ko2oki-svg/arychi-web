import {
	Quest as QuestShape,
	QuestTaskConfigType,
} from './interface';
import { Utils } from './utils';

export interface QuestDTO {
	id: string;
	name: string;
	application: {
		id: string;
		name: string;
		iconUrl: string | null;
	};
	task: {
		type: string;
		targetSeconds: number;
		currentSeconds: number;
		progressPercent: number;
		remainingSeconds: number;
		remainingMinutes: number;
	};
	rewards: {
		name: string;
		assetUrl: string | null;
	};
	assets: {
		hero: string | null;
		banner: string | null;
	};
	status: {
		enrolled: boolean;
		completed: boolean;
		claimed: boolean;
		expired: boolean;
		expiresAt: string;
	};
}

export class Quest {
	private readonly data: QuestShape;

	private constructor(data: QuestShape) {
		this.data = data;
	}

	static create(data: QuestShape): Quest {
		return new Quest(data);
	}

	get id(): string {
		return this.data.id;
	}

	get config() {
		return this.data.config;
	}

	get userStatus() {
		return this.data.user_status;
	}

	get targetedContent() {
		return this.data.targeted_content;
	}

	get preview(): boolean {
		return this.data.preview;
	}

	get raw(): QuestShape {
		return this.data;
	}

	isExpired(reference: Date = new Date()): boolean {
		if (!this.data.config?.expires_at) return false;
		const exp = new Date(this.data.config.expires_at).getTime();
		return !isNaN(exp) && reference.getTime() > exp;
	}

	isCompleted(): boolean {
		return Boolean(this.userStatus?.completed_at);
	}

	isEnrolledQuest(): boolean {
		return Boolean(this.userStatus?.enrolled_at);
	}

	hasClaimedRewards(): boolean {
		return Boolean(this.userStatus?.claimed_at);
	}

	updateUserStatus(userStatus: QuestShape['user_status']) {
		this.data.user_status = userStatus;
	}

	toDTO(): QuestDTO {
		const config = this.data.config;
		const taskConfig = (config?.task_config_v2?.tasks || {}) as Record<string, any>;
		const taskNames: string[] = [
			QuestTaskConfigType.WATCH_VIDEO,
			QuestTaskConfigType.PLAY_ON_DESKTOP,
			QuestTaskConfigType.PLAY_ON_DESKTOP_V2,
			QuestTaskConfigType.PLAY_ON_XBOX,
			QuestTaskConfigType.PLAY_ON_PLAYSTATION,
			QuestTaskConfigType.STREAM_ON_DESKTOP,
			QuestTaskConfigType.PLAY_ACTIVITY,
			QuestTaskConfigType.WATCH_VIDEO_ON_MOBILE,
			QuestTaskConfigType.ACHIEVEMENT_IN_ACTIVITY,
		];

		const activeTaskName = taskNames.find((name) => taskConfig[name] != null) || 'UNKNOWN';
		const targetSeconds = (activeTaskName !== 'UNKNOWN' && taskConfig[activeTaskName]?.target) || 0;
		const currentSeconds = (this.userStatus?.progress?.[activeTaskName as any]?.value as number) || 0;
		const remainingSeconds = Math.max(0, targetSeconds - currentSeconds);
		const progressPercent = targetSeconds > 0 ? Math.min(100, Math.round((currentSeconds / targetSeconds) * 100)) : 0;

		const appId = config?.application?.id || '';
		const appIcon = (config?.application as any)?.icon || null;
		const iconUrl = Utils.getAppIconUrl(appId, appIcon);

		const heroAsset = config?.assets?.hero || (config?.assets as any)?.quest_bar_hero || null;
		const bannerAsset = (config?.assets as any)?.banner || config?.assets?.hero || null;

		const rewardName =
			config?.rewards_config?.rewards?.[0]?.messages?.name ||
			(config?.rewards_config?.rewards?.[0] as any)?.name ||
			'Reward';
		const rewardAsset = config?.rewards_config?.rewards?.[0]?.asset || null;

		return {
			id: this.id,
			name: config?.messages?.quest_name || 'Unnamed Quest',
			application: {
				id: appId,
				name: config?.application?.name || 'Unknown Game',
				iconUrl,
			},
			task: {
				type: activeTaskName,
				targetSeconds,
				currentSeconds,
				progressPercent,
				remainingSeconds,
				remainingMinutes: Math.ceil(remainingSeconds / 60),
			},
			rewards: {
				name: rewardName,
				assetUrl: Utils.getQuestAssetUrl(this.id, rewardAsset),
			},
			assets: {
				hero: Utils.getQuestAssetUrl(this.id, heroAsset),
				banner: Utils.getQuestAssetUrl(this.id, bannerAsset),
			},
			status: {
				enrolled: this.isEnrolledQuest(),
				completed: this.isCompleted(),
				claimed: this.hasClaimedRewards(),
				expired: this.isExpired(),
				expiresAt: config?.expires_at || '',
			},
		};
	}
}
