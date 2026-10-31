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
}

export interface AccountRecord {
	id: string;
	provider: 'discord' | 'google';
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
	provider: 'discord' | 'google';
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

interface SubscriptionDatabaseSchema {
	accounts: AccountRecord[];
	orders: PaymentOrderRecord[];
	transactions?: any[];
}

export interface SubscriptionStatusDTO {
	planId: 'monthly_20k' | 'monthly_50k';
	planName: string;
	pricePerMonth: number;
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
	private db: SubscriptionDatabaseSchema = {
		accounts: [],
		orders: [],
		transactions: [],
	};

	constructor() {
		// Commercial database is placed at repo root "database/commercial_db.json"
		const isSubdir = process.cwd().endsWith('quest') || process.cwd().endsWith('stream');
		this.dataDir = path.resolve(process.cwd(), isSubdir ? '../database' : 'database');
		if (!fs.existsSync(this.dataDir)) {
			fs.mkdirSync(this.dataDir, { recursive: true });
		}

		this.dbFile = path.join(this.dataDir, 'commercial_db.json');
		this.bakFile = path.join(this.dataDir, 'commercial_db.json.bak');
		this.load();
	}

	private load(): void {
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
					return;
				}
			}

			// Automatic migration from legacy quest/data/subscriptions.json if present
			const legacyFile = path.resolve(process.cwd(), 'data', 'subscriptions.json');
			if (fs.existsSync(legacyFile)) {
				try {
					const rawLegacy = fs.readFileSync(legacyFile, 'utf-8');
					const parsedLegacy = JSON.parse(rawLegacy);
					if (parsedLegacy && Array.isArray(parsedLegacy.accounts)) {
						this.db = {
							accounts: parsedLegacy.accounts,
							orders: Array.isArray(parsedLegacy.orders) ? parsedLegacy.orders : [],
							transactions: [],
						};
						this.save();
						return;
					}
				} catch {}
			}

			// If neither exists, initialize commercial database
			this.save();
		} catch (err) {
			console.error('[CommercialDatabase] Failed to load commercial_db.json:', err);
		}
	}

	private save(): void {
		try {
			if (!fs.existsSync(this.dataDir)) {
				fs.mkdirSync(this.dataDir, { recursive: true });
			}
			const jsonStr = JSON.stringify(this.db, null, 2);
			const tmpFile = `${this.dbFile}.tmp`;

			// Atomic write: write to tmp file first
			fs.writeFileSync(tmpFile, jsonStr, 'utf-8');

			// Create backup if dbFile exists
			if (fs.existsSync(this.dbFile)) {
				try {
					fs.copyFileSync(this.dbFile, this.bakFile);
				} catch {}
			}

			// Rename tmp to live database file
			fs.renameSync(tmpFile, this.dbFile);
		} catch (err) {
			console.error('[CommercialDatabase] Failed to save commercial_db.json:', err);
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
		return `https://img.vietqr.io/image/${encodeURIComponent(bank.bankId)}-${encodeURIComponent(
			bank.accountNo
		)}-${template}.png?amount=${amount}&addInfo=${encodeURIComponent(description)}&accountName=${encodeURIComponent(
			bank.accountName
		)}`;
	}

	public computeSubscriptionStatus(account: AccountRecord | null): SubscriptionStatusDTO | null {
		if (!account || !account.subscriptionExpiresAt) {
			return null;
		}
		const expiresMs = new Date(account.subscriptionExpiresAt).getTime();
		const nowMs = Date.now();
		const diffMs = expiresMs - nowMs;
		const isActive = diffMs > 0;
		const daysRemaining = isActive ? Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24))) : 0;

		return {
			planId: PLAN_ID,
			planName: PLAN_NAME,
			pricePerMonth: PLAN_MONTHLY_PRICE,
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
		provider: 'discord' | 'google';
		username: string;
		email?: string;
		avatarUrl?: string | null;
	}): AccountRecord {
		const now = new Date().toISOString();
		const existingIndex = this.db.accounts.findIndex(
			(a) => a.id === input.id || (input.email && a.email.toLowerCase() === input.email.toLowerCase() && a.provider === input.provider)
		);

		if (existingIndex >= 0) {
			const existing = this.db.accounts[existingIndex];
			existing.username = input.username || existing.username;
			existing.email = input.email || existing.email;
			if (input.avatarUrl !== undefined) {
				existing.avatarUrl = input.avatarUrl;
			}
			existing.botConnected = true;
			if (!existing.sessionToken) {
				existing.sessionToken = crypto.randomBytes(24).toString('hex');
			}
			existing.updatedAt = now;
			this.db.accounts[existingIndex] = existing;
			this.save();
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
				questToken: '',
				streamMainToken: '',
				streamViewerToken: '',
				streamGuildId: '',
				streamChannelId: '',
			},
			createdAt: now,
			updatedAt: now,
		};

		this.db.accounts.push(newAccount);
		this.save();
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

		account.updatedAt = new Date().toISOString();
		this.save();
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
				const cancelUrl = `${returnOrigin}?payment=cancelled&orderCode=${orderCode}`;
				const returnUrl = `${returnOrigin}?payment=success&orderCode=${orderCode}`;
				const signData = `amount=${amount}&cancelUrl=${cancelUrl}&description=${description}&orderCode=${orderCode}&returnUrl=${returnUrl}`;
				const signature = crypto
					.createHmac('sha256', payosChecksumKey)
					.update(signData)
					.digest('hex');

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
			provider: account.provider,
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
		this.save();
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
			} catch {
				// Ignore transient polling errors
			}
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
			this.save();
		}

		const subscription = this.computeSubscriptionStatus(account)!;
		return { order, account, subscription };
	}
}
