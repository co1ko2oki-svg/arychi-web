import crypto from "crypto";
import { VideoQueue, QueueItem, MediaSource } from "../types/index.js";
import logger from "../utils/logger.js";

export class QueueService {
	private queue: VideoQueue;

	constructor() {
		this.queue = {
			items: [],
			currentIndex: -1,
			isPlaying: false
		};
	}

	public async addToQueue(
		mediaSource: MediaSource,
		requestedBy: string,
		originalInput?: string
	): Promise<QueueItem> {
		return this.add(
			mediaSource.url,
			mediaSource.title,
			requestedBy,
			mediaSource.type,
			mediaSource.isLive,
			originalInput || mediaSource.url
		);
	}

	public async add(
		url: string,
		title: string,
		requestedBy: string,
		type: MediaSource["type"] = "url",
		isLive: boolean = false,
		originalInput?: string
	): Promise<QueueItem> {
		const queueItem: QueueItem = {
			id: crypto.randomUUID(),
			url,
			title,
			type,
			isLive,
			requestedBy,
			addedAt: new Date(),
			originalInput: originalInput || url,
			resolved: originalInput === url
		};

		this.queue.items.push(queueItem);
		logger.info(`Added to queue: ${title} (requested by ${requestedBy})`);

		return queueItem;
	}

	public getNext(): QueueItem | null {
		if (this.queue.items.length === 0) {
			this.queue.currentIndex = -1;
			return null;
		}

		if (this.queue.currentIndex < this.queue.items.length - 1) {
			this.queue.currentIndex++;
			return this.queue.items[this.queue.currentIndex];
		}

		this.queue.currentIndex = -1;
		return null;
	}

	public getCurrent(): QueueItem | null {
		if (this.queue.items.length === 0) {
			return null;
		}

		if (this.queue.currentIndex >= 0 && this.queue.currentIndex < this.queue.items.length) {
			return this.queue.items[this.queue.currentIndex];
		}

		return null;
	}

	public skip(): QueueItem | null {
		const currentItem = this.getCurrent();
		if (currentItem) {
			this.removeFromQueue(currentItem.id);
		}

		return this.getNext();
	}

	public removeFromQueue(id: string): boolean {
		const index = this.queue.items.findIndex(item => item.id === id);
		if (index === -1) {
			return false;
		}

		this.queue.items.splice(index, 1);

		if (index <= this.queue.currentIndex) {
			this.queue.currentIndex--;
		}
		return true;
	}

	public clearQueue(): void {
		this.queue.items = [];
		this.queue.currentIndex = -1;
		this.queue.isPlaying = false;
		logger.info("Queue cleared");
	}

	public resetCurrentIndex(): void {
		this.queue.currentIndex = -1;
	}

	public getQueue(): QueueItem[] {
		return [...this.queue.items];
	}

	public getQueueStatus(): VideoQueue {
		return {
			items: [...this.queue.items],
			currentIndex: this.queue.currentIndex,
			isPlaying: this.queue.isPlaying
		};
	}

	public setPlaying(isPlaying: boolean): void {
		this.queue.isPlaying = isPlaying;
	}

	public isEmpty(): boolean {
		return this.queue.items.length === 0;
	}

	public getLength(): number {
		return this.queue.items.length;
	}

	public moveItem(fromIndex: number, toIndex: number): boolean {
		if (
			fromIndex < 0 ||
			fromIndex >= this.queue.items.length ||
			toIndex < 0 ||
			toIndex >= this.queue.items.length
		) {
			return false;
		}

		const [item] = this.queue.items.splice(fromIndex, 1);
		this.queue.items.splice(toIndex, 0, item);

		if (fromIndex === this.queue.currentIndex) {
			this.queue.currentIndex = toIndex;
		} else if (fromIndex < this.queue.currentIndex && toIndex >= this.queue.currentIndex) {
			this.queue.currentIndex--;
		} else if (fromIndex > this.queue.currentIndex && toIndex <= this.queue.currentIndex) {
			this.queue.currentIndex++;
		}

		return true;
	}
}
