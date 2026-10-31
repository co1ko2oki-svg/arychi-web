import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export const PLAN_MONTHLY_PRICE = 20000;
export const PLAN_DAYS_PER_MONTH = 30;
export const PLAN_ID = 'monthly_20k';
export const PLAN_NAME = 'Gói Full Tính Năng (20.000đ / 1 tháng)';

export interface AccountTokens {
	questToken: string;
	streamMainToken: string;
	streamViewerToken: string;
	streamGuildId?: string;
	streamChannelId?: string;
	prefix?: string;
	commandChannelId?: string;
	adminIds?: string;
}

export interface AccountRecord {
	id: string;
	provider: 'discord';
	username: string;
	email: string;
	avatarUrl: string | null;
	botConnected: boolean;
	sessionToken: string;
	subscriptionExpiresAt: string | null;
	activatedAt: string | null;
	totalMonthsPurchased: number;
	licenseKey: string | null;
	tokens: AccountTokens;
	createdAt: string;
	updatedAt: string;
}

export interface BankTransferInfo {
	bankId: string;
	bankName: string;
	accountNo: string;
	accountName: string;
}

export interface PaymentOrderRecord {
	orderCode: number;
	userId: string;
	username: string;
	provider: 'discord';
	months: number;
	amount: number;
	description: string;
	status: 'PENDING' | 'PAID' | 'CANCELLED';
	vietqrUrl: string;
	bankInfo: BankTransferInfo;
	payosCheckoutUrl: string | null;
	payosPaymentLinkId: string | null;
	payosQrCode: string | null;
	createdAt: string;
	paidAt?: string;
}

export interface SubscriptionDatabaseSchema {
	accounts: AccountRecord[];
	orders: PaymentOrderRecord[];
	transactions: Array<{
		id: string;
		orderCode: number;
		userId: string;
		amount: number;
		gateway: 'VIETQR' | 'PAYOS';
		reference?: string;
		createdAt: string;
	}>;
}

export interface SubscriptionStatusDTO {
	planId: string;
	planName: string;
	priceLabel: string;
	isActive: boolean;
	daysRemaining: number;
	totalMonthsPurchased: number;
	activatedAt: string | null;
	expiresAt: string | null;
	botConnected: boolean;
	licenseKey: string | null;
}

export class SubscriptionManager {
	private dataDir: string;
	private dbFile: string;
	private bakFile: string;
	private pool: any = null;
	private mysqlConnected: boolean = false;
	private db: SubscriptionDatabaseSchema = {
		accounts: [],
		orders: [],
		transactions: [],
	};

	constructor() {
		const isSubdir = process.cwd().endsWith('quest') || process.cwd().endsWith('stream');
		this.dataDir = path.resolve(process.cwd(), isSubdir ? '../database' : 'database');
		if (!fs.existsSync(this.dataDir)) {
			fs.mkdirSync(this.dataDir, { recursive: true });
		}

		this.dbFile = path.join(this.dataDir, 'commercial_db.json');
		this.bakFile = path.join(this.dataDir, 'commercial_db.json.bak');

		this.loadLocalBackup();
		void this.initMySql();
	}

	private async initMySql(): Promise<void> {
		const host = process.env.MYSQL_HOST || 'localhost';
		const port = parseInt(process.env.MYSQL_PORT || '3306', 10);
		const user = process.env.MYSQL_USER || 'root';
		const password = process.env.MYSQL_PASSWORD || '';
		const database = process.env.MYSQL_DATABASE || 'arychi_db';

		try {
			const mysql = await import('mysql2/promise');

			// Auto create database if not exists
			const initConn = await mysql.createConnection({
				host,
				port,
				user,
				password,
			});
			await initConn.query(
				`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
			);
			await initConn.end();

			this.pool = mysql.createPool({
				host,
				port,
				user,
				password,
				database,
				waitForConnections: true,
				connectionLimit: 10,
				queueLimit: 0,
			});

			await this.pool.query('SELECT 1');
			this.mysqlConnected = true;
			console.log(`[MySQL] Connected to database: ${database}@${host}:${port}`);

			await this.ensureTables();
			await this.syncWithMySql();
		} catch (err: any) {
			this.mysqlConnected = false;
			console.warn(
				`[MySQL] Connection skipped or failed (${err?.message || err}). Using local cache database.`
			);
		}
	}

	private async ensureTables(): Promise<void> {
		if (!this.pool) return;
		try {
			await this.pool.query(`
				CREATE TABLE IF NOT EXISTS \`accounts\` (
					\`id\` VARCHAR(64) NOT NULL PRIMARY KEY,
					\`provider\` VARCHAR(32) NOT NULL DEFAULT 'discord',
					\`username\` VARCHAR(128) NOT NULL,
					\`email\` VARCHAR(255) DEFAULT NULL,
					\`avatar_url\` TEXT DEFAULT NULL,
					\`bot_connected\` TINYINT(1) NOT NULL DEFAULT 0,
					\`session_token\` VARCHAR(128) NOT NULL UNIQUE,
					\`subscription_expires_at\` DATETIME DEFAULT NULL,
					\`activated_at\` DATETIME DEFAULT NULL,
					\`total_months_purchased\` INT NOT NULL DEFAULT 0,
					\`license_key\` VARCHAR(64) DEFAULT NULL,
					\`quest_token\` TEXT DEFAULT NULL,
					\`stream_main_token\` TEXT DEFAULT NULL,
					\`stream_viewer_token\` TEXT DEFAULT NULL,
					\`stream_guild_id\` VARCHAR(64) DEFAULT NULL,
					\`stream_channel_id\` VARCHAR(64) DEFAULT NULL,
					\`stream_prefix\` VARCHAR(16) DEFAULT '$',
					\`command_channel_id\` VARCHAR(64) DEFAULT NULL,
					\`admin_ids\` TEXT DEFAULT NULL,
					\`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
					\`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
					INDEX \`idx_accounts_session\` (\`session_token\`),
					INDEX \`idx_accounts_username\` (\`username\`)
				) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
			`);

			// Safe auto-migration for existing accounts table
			try { await this.pool.query('ALTER TABLE `accounts` ADD COLUMN `stream_prefix` VARCHAR(16) DEFAULT "$"'); } catch {}
			try { await this.pool.query('ALTER TABLE `accounts` ADD COLUMN `command_channel_id` VARCHAR(64) DEFAULT NULL'); } catch {}
			try { await this.pool.query('ALTER TABLE `accounts` ADD COLUMN `admin_ids` TEXT DEFAULT NULL'); } catch {}

			await this.pool.query(`
				CREATE TABLE IF NOT EXISTS \`orders\` (
					\`order_code\` BIGINT NOT NULL PRIMARY KEY,
					\`user_id\` VARCHAR(64) NOT NULL,
					\`username\` VARCHAR(128) NOT NULL,
					\`provider\` VARCHAR(32) NOT NULL DEFAULT 'discord',
					\`months\` INT NOT NULL DEFAULT 1,
					\`amount\` INT NOT NULL,
					\`description\` VARCHAR(255) NOT NULL,
					\`status\` ENUM('PENDING', 'PAID', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
					\`vietqr_url\` TEXT DEFAULT NULL,
					\`bank_id\` VARCHAR(64) DEFAULT NULL,
					\`bank_name\` VARCHAR(128) DEFAULT NULL,
					\`account_no\` VARCHAR(64) DEFAULT NULL,
					\`account_name\` VARCHAR(128) DEFAULT NULL,
					\`payos_checkout_url\` TEXT DEFAULT NULL,
					\`payos_payment_link_id\` VARCHAR(128) DEFAULT NULL,
					\`payos_qr_code\` TEXT DEFAULT NULL,
					\`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
					\`paid_at\` DATETIME DEFAULT NULL,
					INDEX \`idx_orders_user\` (\`user_id\`),
					INDEX \`idx_orders_status\` (\`status\`)
				) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
			`);

			await this.pool.query(`
				CREATE TABLE IF NOT EXISTS \`transactions\` (
					\`id\` VARCHAR(64) NOT NULL PRIMARY KEY,
					\`order_code\` BIGINT NOT NULL,
					\`user_id\` VARCHAR(64) NOT NULL,
					\`amount\` INT NOT NULL,
					\`gateway\` VARCHAR(32) NOT NULL,
					\`reference\` VARCHAR(255) DEFAULT NULL,
					\`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
					INDEX \`idx_transactions_order\` (\`order_code\`)
				) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
			`);
		} catch (err: any) {
			console.warn('[MySQL] Failed to ensure tables:', err?.message || err);
		}
	}

	private async syncWithMySql(): Promise<void> {
		if (!this.pool) return;
		try {
			const [accRows]: [any[], any] = await this.pool.query('SELECT * FROM accounts');
			if (accRows.length > 0) {
				const accounts: AccountRecord[] = accRows.map((r) => ({
					id: r.id,
					provider: 'discord',
					username: r.username,
					email: r.email,
					avatarUrl: r.avatar_url,
					botConnected: Boolean(r.bot_connected),
					sessionToken: r.session_token,
					subscriptionExpiresAt: r.subscription_expires_at
						? new Date(r.subscription_expires_at).toISOString()
						: null,
					activatedAt: r.activated_at ? new Date(r.activated_at).toISOString() : null,
					totalMonthsPurchased: Number(r.total_months_purchased) || 0,
					licenseKey: r.license_key,
					tokens: {
						questToken: r.quest_token || '',
						streamMainToken: r.stream_main_token || '',
						streamViewerToken: r.stream_viewer_token || '',
						streamGuildId: r.stream_guild_id || '',
						streamChannelId: r.stream_channel_id || '',
						prefix: r.stream_prefix || '$',
						commandChannelId: r.command_channel_id || '',
						adminIds: r.admin_ids || '',
					},
					createdAt: new Date(r.created_at).toISOString(),
					updatedAt: new Date(r.updated_at).toISOString(),
				}));

				const [orderRows]: [any[], any] = await this.pool.query(
					'SELECT * FROM orders ORDER BY created_at DESC LIMIT 500'
				);
				const orders: PaymentOrderRecord[] = orderRows.map((o) => ({
					orderCode: Number(o.order_code),
					userId: o.user_id,
					username: o.username,
					provider: 'discord',
					months: Number(o.months),
					amount: Number(o.amount),
					description: o.description,
					status: o.status,
					vietqrUrl: o.vietqr_url,
					bankInfo: {
						bankId: o.bank_id || 'MB',
						bankName: o.bank_name || 'MBBank',
						accountNo: o.account_no || '0388889999',
						accountName: o.account_name || 'ARYCHI SUITE SYSTEM',
					},
					payosCheckoutUrl: o.payos_checkout_url,
					payosPaymentLinkId: o.payos_payment_link_id,
					payosQrCode: o.payos_qr_code,
					createdAt: new Date(o.created_at).toISOString(),
					paidAt: o.paid_at ? new Date(o.paid_at).toISOString() : undefined,
				}));

				this.db.accounts = accounts;
				this.db.orders = orders;
				this.saveLocalBackup();
				console.log(
					`[MySQL] Loaded ${accounts.length} accounts and ${orders.length} orders from MySQL.`
				);
			} else if (this.db.accounts.length > 0) {
				console.log(
					`[MySQL] Migrating ${this.db.accounts.length} existing accounts into MySQL database...`
				);
				for (const acc of this.db.accounts) {
					await this.sqlSaveAccount(acc);
				}
				for (const order of this.db.orders) {
					await this.sqlSaveOrder(order);
				}
				console.log('[MySQL] Migration to MySQL completed.');
			}
		} catch (err: any) {
			console.error('[MySQL] Error syncing with MySQL:', err?.message || err);
		}
	}

	private loadLocalBackup(): void {
		try {
			if (fs.existsSync(this.dbFile)) {
				const raw = fs.readFileSync(this.dbFile, 'utf-8');
				const parsed = JSON.parse(raw);
				if (parsed && Array.isArray(parsed.accounts) && Array.isArray(parsed.orders)) {
					this.db = {
						accounts: parsed.accounts,
						orders: parsed.orders,
						transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
					};
				}
			}
		} catch (err) {
			console.error('[Database] Failed to read backup cache:', err);
		}
	}

	private saveLocalBackup(): void {
		try {
			const jsonStr = JSON.stringify(this.db, null, 2);
			const tmpFile = `${this.dbFile}.tmp`;
			fs.writeFileSync(tmpFile, jsonStr, 'utf-8');
			if (fs.existsSync(this.dbFile)) {
				try {
					fs.copyFileSync(this.dbFile, this.bakFile);
				} catch {}
			}
			fs.renameSync(tmpFile, this.dbFile);
		} catch (err) {
			console.error('[Database] Failed to save backup cache:', err);
		}
	}

	private async sqlSaveAccount(account: AccountRecord): Promise<void> {
		if (!this.pool || !this.mysqlConnected) return;
		try {
			const query = `
				INSERT INTO accounts (
					id, provider, username, email, avatar_url, bot_connected, session_token,
					subscription_expires_at, activated_at, total_months_purchased, license_key,
					quest_token, stream_main_token, stream_viewer_token, stream_guild_id, stream_channel_id,
					stream_prefix, command_channel_id, admin_ids,
					created_at, updated_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
				ON DUPLICATE KEY UPDATE
					provider = VALUES(provider),
					username = VALUES(username),
					email = VALUES(email),
					avatar_url = VALUES(avatar_url),
					bot_connected = VALUES(bot_connected),
					session_token = VALUES(session_token),
					subscription_expires_at = VALUES(subscription_expires_at),
					activated_at = VALUES(activated_at),
					total_months_purchased = VALUES(total_months_purchased),
					license_key = VALUES(license_key),
					quest_token = VALUES(quest_token),
					stream_main_token = VALUES(stream_main_token),
					stream_viewer_token = VALUES(stream_viewer_token),
					stream_guild_id = VALUES(stream_guild_id),
					stream_channel_id = VALUES(stream_channel_id),
					stream_prefix = VALUES(stream_prefix),
					command_channel_id = VALUES(command_channel_id),
					admin_ids = VALUES(admin_ids),
					updated_at = NOW()
			`;

			const createdAtSql = account.createdAt
				? new Date(account.createdAt).toISOString().slice(0, 19).replace('T', ' ')
				: new Date().toISOString().slice(0, 19).replace('T', ' ');

			const updatedAtSql = account.updatedAt
				? new Date(account.updatedAt).toISOString().slice(0, 19).replace('T', ' ')
				: new Date().toISOString().slice(0, 19).replace('T', ' ');

			const expiresSql = account.subscriptionExpiresAt
				? new Date(account.subscriptionExpiresAt).toISOString().slice(0, 19).replace('T', ' ')
				: null;

			const activatedSql = account.activatedAt
				? new Date(account.activatedAt).toISOString().slice(0, 19).replace('T', ' ')
				: null;

			await this.pool.query(query, [
				account.id,
				'discord',
				account.username,
				account.email || null,
				account.avatarUrl || null,
				account.botConnected ? 1 : 0,
				account.sessionToken,
				expiresSql,
				activatedSql,
				account.totalMonthsPurchased || 0,
				account.licenseKey || null,
				account.tokens?.questToken || null,
				account.tokens?.streamMainToken || null,
				account.tokens?.streamViewerToken || null,
				account.tokens?.streamGuildId || null,
				account.tokens?.streamChannelId || null,
				account.tokens?.prefix || '$',
				account.tokens?.commandChannelId || null,
				account.tokens?.adminIds || null,
				createdAtSql,
				updatedAtSql,
			]);
		} catch (err: any) {
			console.warn('[MySQL] Failed to save account:', err?.message || err);
		}
	}

	private async sqlSaveOrder(order: PaymentOrderRecord): Promise<void> {
		if (!this.pool || !this.mysqlConnected) return;
		try {
			const query = `
				INSERT INTO orders (
					order_code, user_id, username, provider, months, amount, description, status,
					vietqr_url, bank_id, bank_name, account_no, account_name,
					payos_checkout_url, payos_payment_link_id, payos_qr_code, created_at, paid_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
				ON DUPLICATE KEY UPDATE
					status = VALUES(status),
					paid_at = VALUES(paid_at)
			`;

			const createdAtSql = order.createdAt
				? new Date(order.createdAt).toISOString().slice(0, 19).replace('T', ' ')
				: new Date().toISOString().slice(0, 19).replace('T', ' ');

			const paidAtSql = order.paidAt
				? new Date(order.paidAt).toISOString().slice(0, 19).replace('T', ' ')
				: null;

			await this.pool.query(query, [
				order.orderCode,
				order.userId,
				order.username,
				'discord',
				order.months,
				order.amount,
				order.description,
				order.status,
				order.vietqrUrl || null,
				order.bankInfo.bankId || 'MB',
				order.bankInfo.bankName || 'MBBank',
				order.bankInfo.accountNo || '0388889999',
				order.bankInfo.accountName || 'ARYCHI SUITE SYSTEM',
				order.payosCheckoutUrl || null,
				order.payosPaymentLinkId || null,
				order.payosQrCode || null,
				createdAtSql,
				paidAtSql,
			]);
		} catch (err: any) {
			console.warn('[MySQL] Failed to save order:', err?.message || err);
		}
	}

	public getBankInfo(): BankTransferInfo {
		return {
			bankId: process.env.VIETQR_BANK_ID || 'MB',
			bankName: process.env.VIETQR_BANK_NAME || 'MBBank (Ngân hàng Quân Đội)',
			accountNo: process.env.VIETQR_ACCOUNT_NO || '0388889999',
			accountName: process.env.VIETQR_ACCOUNT_NAME || 'ARYCHI SUITE SYSTEM',
		};
	}

	public buildVietQrUrl(amount: number, description: string): string {
		const bank = this.getBankInfo();
		const template = process.env.VIETQR_TEMPLATE || 'compact2';
		const cleanAccountName = encodeURIComponent(bank.accountName);
		const cleanDescription = encodeURIComponent(description);
		return `https://img.vietqr.io/image/${bank.bankId}-${bank.accountNo}-${template}.png?amount=${amount}&addInfo=${cleanDescription}&accountName=${cleanAccountName}`;
	}

	public computeSubscriptionStatus(
		account: AccountRecord | null | undefined
	): SubscriptionStatusDTO | null {
		if (!account) return null;
		const now = Date.now();
		let isActive = false;
		let daysRemaining = 0;

		if (account.subscriptionExpiresAt) {
			const expiryMs = new Date(account.subscriptionExpiresAt).getTime();
			if (expiryMs > now) {
				isActive = true;
				daysRemaining = Math.max(0, Math.ceil((expiryMs - now) / (1000 * 60 * 60 * 24)));
			}
		}

		return {
			planId: PLAN_ID,
			planName: PLAN_NAME,
			priceLabel: '20.000đ / 1 tháng',
			isActive,
			daysRemaining,
			totalMonthsPurchased: account.totalMonthsPurchased || 1,
			activatedAt: account.activatedAt,
			expiresAt: account.subscriptionExpiresAt,
			botConnected: account.botConnected,
			licenseKey: account.licenseKey,
		};
	}

	public upsertOAuthAccount(input: {
		id: string;
		provider: 'discord';
		username: string;
		email?: string;
		avatarUrl?: string | null;
		token?: string;
	}): AccountRecord {
		const now = new Date().toISOString();
		const existingIndex = this.db.accounts.findIndex(
			(a) =>
				a.id === input.id ||
				(input.email &&
					a.email.toLowerCase() === input.email.toLowerCase() &&
					a.provider === input.provider)
		);

		if (existingIndex >= 0) {
			const existing = this.db.accounts[existingIndex];
			existing.username = input.username || existing.username;
			existing.email = input.email || existing.email;
			if (input.avatarUrl !== undefined) {
				existing.avatarUrl = input.avatarUrl;
			}
			if (input.token) {
				existing.tokens = existing.tokens || {
					questToken: '',
					streamMainToken: '',
					streamViewerToken: '',
				};
				existing.tokens.questToken = input.token;
			}
			existing.botConnected = true;
			if (!existing.sessionToken) {
				existing.sessionToken = crypto.randomBytes(24).toString('hex');
			}
			existing.updatedAt = now;
			this.db.accounts[existingIndex] = existing;

			this.saveLocalBackup();
			void this.sqlSaveAccount(existing);
			return existing;
		}

		const newAccount: AccountRecord = {
			id: input.id,
			provider: input.provider,
			username: input.username,
			email: input.email || `${input.username}@${input.provider}.oauth`,
			avatarUrl: input.avatarUrl || null,
			botConnected: true,
			sessionToken: crypto.randomBytes(24).toString('hex'),
			subscriptionExpiresAt: null,
			activatedAt: null,
			totalMonthsPurchased: 0,
			licenseKey: null,
			tokens: {
				questToken: input.token || '',
				streamMainToken: '',
				streamViewerToken: '',
				streamGuildId: '',
				streamChannelId: '',
				prefix: '$',
				commandChannelId: '',
				adminIds: '',
			},
			createdAt: now,
			updatedAt: now,
		};

		this.db.accounts.push(newAccount);
		this.saveLocalBackup();
		void this.sqlSaveAccount(newAccount);
		return newAccount;
	}

	public getAccountBySession(sessionToken?: string | null): AccountRecord | null {
		if (!sessionToken) return null;
		const clean = sessionToken.replace(/^Bearer\s+/i, '').trim();
		if (!clean) return null;
		return this.db.accounts.find((a) => a.sessionToken === clean) || null;
	}

	public getAccountById(userId: string): AccountRecord | null {
		return this.db.accounts.find((a) => a.id === userId) || null;
	}

	public updateAccountTokens(
		userId: string,
		tokens: Partial<AccountTokens>
	): AccountRecord | null {
		const account = this.getAccountById(userId);
		if (!account) return null;

		if (tokens.questToken !== undefined) {
			account.tokens.questToken = tokens.questToken.trim();
		}
		if (tokens.streamMainToken !== undefined) {
			account.tokens.streamMainToken = tokens.streamMainToken.trim();
		}
		if (tokens.streamViewerToken !== undefined) {
			account.tokens.streamViewerToken = tokens.streamViewerToken.trim();
		}
		if (tokens.streamGuildId !== undefined) {
			account.tokens.streamGuildId = tokens.streamGuildId.trim();
		}
		if (tokens.streamChannelId !== undefined) {
			account.tokens.streamChannelId = tokens.streamChannelId.trim();
		}
		if (tokens.prefix !== undefined) {
			account.tokens.prefix = tokens.prefix.trim();
		}
		if (tokens.commandChannelId !== undefined) {
			account.tokens.commandChannelId = tokens.commandChannelId.trim();
		}
		if (tokens.adminIds !== undefined) {
			account.tokens.adminIds = tokens.adminIds.trim();
		}

		account.updatedAt = new Date().toISOString();
		this.saveLocalBackup();
		void this.sqlSaveAccount(account);
		return account;
	}

	public async createPaymentOrder(
		account: AccountRecord,
		monthsInput: number,
		returnOrigin: string = 'https://dash.arychi.xyz'
	): Promise<PaymentOrderRecord> {
		const months = Math.max(1, Math.min(24, Math.floor(Number(monthsInput) || 1)));
		const amount = PLAN_MONTHLY_PRICE * months;
		const orderCode = Number(String(Date.now()).slice(-7) + String(Math.floor(10 + Math.random() * 89)));
		const description = `ARYCHI ${orderCode}`;
		const bankInfo = this.getBankInfo();
		const vietqrUrl = this.buildVietQrUrl(amount, description);

		let payosCheckoutUrl: string | null = null;
		let payosPaymentLinkId: string | null = null;
		let payosQrCode: string | null = null;

		const payosClientId = process.env.PAYOS_CLIENT_ID;
		const payosApiKey = process.env.PAYOS_API_KEY;
		const payosChecksumKey = process.env.PAYOS_CHECKSUM_KEY;

		if (payosClientId && payosApiKey && payosChecksumKey) {
			try {
				const cancelUrl = `${returnOrigin}/?payment=cancel&orderCode=${orderCode}`;
				const returnUrl = `${returnOrigin}/?payment=success&orderCode=${orderCode}`;
				const signData = `amount=${amount}&cancelUrl=${cancelUrl}&description=${description}&orderCode=${orderCode}&returnUrl=${returnUrl}`;
				const signature = crypto.createHmac('sha256', payosChecksumKey).update(signData).digest('hex');

				const response = await fetch('https://api-merchant.payos.vn/v2/payment-requests', {
					method: 'POST',
					headers: {
						'x-client-id': payosClientId,
						'x-api-key': payosApiKey,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						orderCode,
						amount,
						description,
						cancelUrl,
						returnUrl,
						items: [
							{
								name: `${PLAN_NAME} x ${months} tháng`,
								quantity: months,
								price: PLAN_MONTHLY_PRICE,
							},
						],
						signature,
					}),
				});
				const payloadData: any = await response.json().catch(() => null);

				if (payloadData && payloadData.code === '00' && payloadData.data) {
					payosCheckoutUrl = payloadData.data.checkoutUrl || null;
					payosPaymentLinkId = payloadData.data.paymentLinkId || null;
					payosQrCode = payloadData.data.qrCode || null;
				}
			} catch (err: any) {
				console.warn('[SubscriptionManager] PayOS API fallback to VietQR direct:', err?.message || err);
			}
		}

		const order: PaymentOrderRecord = {
			orderCode,
			userId: account.id,
			username: account.username,
			provider: 'discord',
			months,
			amount,
			description,
			status: 'PENDING',
			vietqrUrl,
			bankInfo,
			payosCheckoutUrl,
			payosPaymentLinkId,
			payosQrCode,
			createdAt: new Date().toISOString(),
		};

		this.db.orders.unshift(order);
		if (this.db.orders.length > 500) {
			this.db.orders = this.db.orders.slice(0, 500);
		}
		this.saveLocalBackup();
		void this.sqlSaveOrder(order);
		return order;
	}

	public getOrder(orderCode: number): PaymentOrderRecord | null {
		return this.db.orders.find((o) => o.orderCode === Number(orderCode)) || null;
	}

	public getUserOrders(userId: string): PaymentOrderRecord[] {
		return this.db.orders.filter((o) => o.userId === userId).slice(0, 20);
	}

	public async checkOrderWithPayOS(orderCode: number): Promise<PaymentOrderRecord | null> {
		const order = this.getOrder(orderCode);
		if (!order) return null;
		if (order.status === 'PAID') return order;

		const payosClientId = process.env.PAYOS_CLIENT_ID;
		const payosApiKey = process.env.PAYOS_API_KEY;
		if (payosClientId && payosApiKey) {
			try {
				const res = await fetch(`https://api-merchant.payos.vn/v2/payment-requests/${orderCode}`, {
					headers: {
						'x-client-id': payosClientId,
						'x-api-key': payosApiKey,
					},
				});
				const payloadData: any = await res.json().catch(() => null);
				if (payloadData?.code === '00' && payloadData?.data?.status === 'PAID') {
					const confirmed = this.markOrderPaidAndExtendSubscription(orderCode);
					return confirmed?.order || order;
				}
			} catch {}
		}
		return order;
	}

	public markOrderPaidAndExtendSubscription(orderCode: number): {
		order: PaymentOrderRecord;
		account: AccountRecord;
		subscription: SubscriptionStatusDTO;
	} | null {
		const order = this.getOrder(orderCode);
		if (!order) return null;

		const account = this.getAccountById(order.userId);
		if (!account) return null;

		if (order.status !== 'PAID') {
			order.status = 'PAID';
			order.paidAt = new Date().toISOString();

			const nowMs = Date.now();
			const currentExpiryMs = account.subscriptionExpiresAt
				? new Date(account.subscriptionExpiresAt).getTime()
				: 0;
			const baseMs = currentExpiryMs > nowMs ? currentExpiryMs : nowMs;
			const addedMs = order.months * PLAN_DAYS_PER_MONTH * 24 * 60 * 60 * 1000;
			const newExpiry = new Date(baseMs + addedMs).toISOString();

			if (!account.activatedAt) {
				account.activatedAt = new Date(nowMs).toISOString();
			}
			account.subscriptionExpiresAt = newExpiry;
			account.totalMonthsPurchased = (account.totalMonthsPurchased || 0) + order.months;
			account.botConnected = true;
			if (!account.licenseKey) {
				account.licenseKey = `ARYCHI-20K-${account.id.slice(-4).toUpperCase()}-${crypto
					.randomBytes(2)
					.toString('hex')
					.toUpperCase()}`;
			}
			account.updatedAt = new Date(nowMs).toISOString();

			this.saveLocalBackup();
			void this.sqlSaveAccount(account);
			void this.sqlSaveOrder(order);
		}

		const subscription = this.computeSubscriptionStatus(account)!;
		return { order, account, subscription };
	}
}
