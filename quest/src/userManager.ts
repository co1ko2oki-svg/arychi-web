import fs from 'node:fs';
import path from 'node:path';
import { addLog } from './utils';

export interface StoredUser {
	id: string;
	username: string;
	discriminator?: string;
	avatarUrl: string | null;
	email?: string;
	token: string;
	type: 'bot' | 'user';
	bot: boolean;
	createdAt: string;
	lastActiveAt: string;
}

export interface UsersDatabase {
	activeUserId: string | null;
	users: StoredUser[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

export class UserManager {
	private db: UsersDatabase = {
		activeUserId: null,
		users: [],
	};

	constructor() {
		this.init();
	}

	private init() {
		try {
			if (!fs.existsSync(DATA_DIR)) {
				fs.mkdirSync(DATA_DIR, { recursive: true });
			}
			if (fs.existsSync(USERS_FILE)) {
				const content = fs.readFileSync(USERS_FILE, 'utf-8');
				this.db = JSON.parse(content);
				if (!Array.isArray(this.db.users)) {
					this.db.users = [];
				}
			} else {
				this.saveToFile();
			}
		} catch (err: any) {
			addLog('error', `Failed to initialize users database: ${err.message}`);
			this.db = { activeUserId: null, users: [] };
		}
	}

	private saveToFile() {
		try {
			if (!fs.existsSync(DATA_DIR)) {
				fs.mkdirSync(DATA_DIR, { recursive: true });
			}
			fs.writeFileSync(USERS_FILE, JSON.stringify(this.db, null, 2), 'utf-8');
		} catch (err: any) {
			addLog('error', `Failed to write users database: ${err.message}`);
		}
	}

	public getAllUsers(): StoredUser[] {
		return this.db.users;
	}

	public getActiveUser(): StoredUser | null {
		if (!this.db.activeUserId) {
			return this.db.users[0] || null;
		}
		return this.db.users.find((u) => u.id === this.db.activeUserId) || this.db.users[0] || null;
	}

	public getUserById(id: string): StoredUser | null {
		return this.db.users.find((u) => u.id === id) || null;
	}

	public saveUser(user: Omit<StoredUser, 'createdAt' | 'lastActiveAt'> & Partial<Pick<StoredUser, 'createdAt' | 'lastActiveAt'>>): StoredUser {
		const existingIndex = this.db.users.findIndex((u) => u.id === user.id);
		const now = new Date().toISOString();

		let savedUser: StoredUser;

		if (existingIndex >= 0) {
			savedUser = {
				...this.db.users[existingIndex],
				...user,
				lastActiveAt: now,
			};
			this.db.users[existingIndex] = savedUser;
			addLog('info', `Updated user in database: @${savedUser.username} (${savedUser.id}) [${savedUser.type.toUpperCase()}]`);
		} else {
			savedUser = {
				...user,
				createdAt: user.createdAt || now,
				lastActiveAt: now,
			};
			this.db.users.push(savedUser);
			addLog('success', `Saved new user into database: @${savedUser.username} (${savedUser.id}) [${savedUser.type.toUpperCase()}]`);
		}

		this.db.activeUserId = savedUser.id;
		this.saveToFile();
		return savedUser;
	}

	public setActiveUser(id: string): StoredUser | null {
		const user = this.getUserById(id);
		if (!user) return null;
		this.db.activeUserId = id;
		user.lastActiveAt = new Date().toISOString();
		this.saveToFile();
		addLog('info', `Switched active user in database to @${user.username} (${user.id})`);
		return user;
	}

	public deleteUser(id: string): boolean {
		const index = this.db.users.findIndex((u) => u.id === id);
		if (index === -1) return false;

		const deleted = this.db.users.splice(index, 1)[0];
		if (this.db.activeUserId === id) {
			this.db.activeUserId = this.db.users[0]?.id || null;
		}
		this.saveToFile();
		addLog('warn', `Removed user from database: @${deleted.username} (${deleted.id})`);
		return true;
	}
}

export const userManager = new UserManager();
