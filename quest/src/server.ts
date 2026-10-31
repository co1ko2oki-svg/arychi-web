import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';

// Always locate and load the single master root .env file
const rootEnvCandidates = [
	path.resolve(process.cwd(), '../.env'),
	path.resolve(process.cwd(), '.env'),
	path.resolve(process.cwd(), '../../.env'),
];
const foundEnv = rootEnvCandidates.find((p) => fs.existsSync(p));
if (foundEnv) {
	dotenv.config({ path: foundEnv });
} else {
	dotenv.config();
}
import http from 'node:http';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { questService, QuestJob } from './questService';
import { userManager, StoredUser } from './userManager';
import { SubscriptionManager, PLAN_MONTHLY_PRICE, PLAN_NAME, PLAN_ID } from './subscriptionDb';
import { logEmitter, logBuffer, addLog, LogEntry, Utils } from './utils';

const subscriptionManager = new SubscriptionManager();

const PORT = parseInt(process.env.PORT || '3001', 10);
const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// WebSocket Server for live updates
const wss = new WebSocketServer({ server, path: '/ws' });

function broadcast(type: string, data: any) {
	const payload = JSON.stringify({ type, data });
	wss.clients.forEach((client) => {
		if (client.readyState === WebSocket.OPEN) {
			client.send(payload);
		}
	});
}

// Subscribe to job events and logs
questService.on('job:progress', (job: QuestJob) => {
	const sanitized = { ...job, abortController: undefined };
	broadcast('job:progress', sanitized);
});

questService.on('job:update', (job: QuestJob) => {
	const sanitized = { ...job, abortController: undefined };
	broadcast('job:update', sanitized);
});

logEmitter.on('log', (entry: LogEntry) => {
	broadcast('log', entry);
});

// WebSocket Keep-Alive & Message handling
interface ExtWebSocket extends WebSocket {
	isAlive?: boolean;
}

wss.on('connection', (ws: ExtWebSocket) => {
	ws.isAlive = true;
	addLog('info', 'Client connected to WebSocket server.');

	// Send initial state on connection
	ws.send(
		JSON.stringify({
			type: 'init',
			data: {
				logs: logBuffer.slice(-50),
				jobs: questService.getJobs().map((j) => ({ ...j, abortController: undefined })),
			},
		}),
	);

	ws.on('pong', () => {
		ws.isAlive = true;
	});

	ws.on('message', (message: string) => {
		try {
			const data = JSON.parse(message.toString());
			if (data.type === 'ping') {
				ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
			} else if (data.type === 'get_init') {
				ws.send(
					JSON.stringify({
						type: 'init',
						data: {
							logs: logBuffer.slice(-50),
							jobs: questService.getJobs().map((j) => ({ ...j, abortController: undefined })),
						},
					}),
				);
			}
		} catch {}
	});

	ws.on('error', (err) => {
		addLog('warn', `WebSocket client error: ${err.message}`);
	});
});

// Ping interval every 30s to detect broken connections
const wsPingInterval = setInterval(() => {
	wss.clients.forEach((ws: WebSocket) => {
		const extWs = ws as ExtWebSocket;
		if (extWs.isAlive === false) {
			return extWs.terminate();
		}
		extWs.isAlive = false;
		extWs.ping();
	});
}, 30_000);

wss.on('close', () => {
	clearInterval(wsPingInterval);
});

// Helper to extract token from request body or header
function extractToken(req: Request): string {
	const authHeader = req.headers.authorization;
	if (authHeader) {
		return authHeader.replace(/^Bearer\s+/i, '').replace(/^Bot\s+/i, '').trim();
	}
	return (
		req.body?.token ||
		process.env.DISCORD_QUEST_TOKEN ||
		process.env.TOKEN ||
		process.env.DISCORD_BOT_TOKEN ||
		''
	).trim();
}

// ---------------- REST API ROUTES ----------------

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
	res.json({
		status: 'ok',
		service: 'Discord Quest Backend',
		uptime: process.uptime(),
		timestamp: new Date().toISOString(),
	});
});

// Helper to extract session token from Authorization header or query/body
function extractSessionToken(req: Request): string {
	const authHeader = req.headers.authorization;
	if (authHeader && authHeader.startsWith('Bearer ')) {
		return authHeader.slice(7).trim();
	}
	return String(req.query.session || req.body?.sessionToken || '').trim();
}

// Get OAuth2 & Pricing configuration
const getAllowedRedirectUris = (): string[] =>
	(process.env.DISCORD_REDIRECT_URIS || process.env.DISCORD_REDIRECT_URI || 'https://arychi.xyz')
		.split(',')
		.map((uri) => uri.trim().replace(/\/+$/, ''))
		.filter(Boolean);

// Discord requires the exact same redirect_uri for authorize and token exchange,
// and it must be registered in Developer Portal > OAuth2 > Redirects.
const resolveRedirectUri = (candidate?: unknown): string => {
	const allowed = getAllowedRedirectUris();
	const normalized = typeof candidate === 'string' ? candidate.trim().replace(/\/+$/, '') : '';
	return normalized && allowed.includes(normalized) ? normalized : allowed[0];
};

app.get('/api/auth/oauth/config', async (req: Request, res: Response) => {
	const discordClientId = process.env.DISCORD_CLIENT_ID || '';
	const discordBotToken = process.env.DISCORD_BOT_TOKEN || '';
	const discordRedirectUri = resolveRedirectUri(req.query.redirectUri || req.headers.origin);

	let botInfo: { id: string; username: string; avatarUrl: string | null } | null = null;
	if (discordBotToken) {
		try {
			const bRes = await fetch('https://discord.com/api/v10/users/@me', {
				headers: { Authorization: `Bot ${discordBotToken}` },
			});
			const bData: any = await bRes.json();
			if (bData && bData.id) {
				botInfo = {
					id: bData.id,
					username: bData.username,
					avatarUrl: bData.avatar ? `https://cdn.discordapp.com/avatars/${bData.id}/${bData.avatar}.png` : null,
				};
			}
		} catch {}
	}

	res.json({
		plan: {
			id: PLAN_ID,
			name: PLAN_NAME,
			pricePerMonth: PLAN_MONTHLY_PRICE,
			currency: 'VND',
		},
		oauth: {
			discordConfigured: Boolean(discordClientId || discordBotToken),
			discordClientId: discordClientId || null,
			discordBotConfigured: Boolean(discordBotToken),
			botInfo,
			discordAuthUrl: discordClientId
				? `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(
						discordClientId
				  )}&response_type=code&redirect_uri=${encodeURIComponent(
						discordRedirectUri
				  )}&scope=identify+guilds+guilds.join+email`
				: null,
			discordBotInviteUrl: discordClientId
				? `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(
						discordClientId
				  )}&permissions=8&scope=bot+applications.commands`
				: null,
		},
		bankInfo: subscriptionManager.getBankInfo(),
		payosConfigured: Boolean(
			process.env.PAYOS_CLIENT_ID && process.env.PAYOS_API_KEY && process.env.PAYOS_CHECKSUM_KEY
		),
	});
});

// Login or Register via Discord Bot OAuth2
app.post('/api/auth/oauth/login', async (req: Request, res: Response) => {
	try {
		const provider = 'discord';
		const code = req.body?.code as string | undefined;
		const accessToken = req.body?.accessToken as string | undefined;

		let id = String(req.body?.id || '').trim();
		let username = String(req.body?.username || '').trim();
		let email = String(req.body?.email || '').trim();
		let avatarUrl: string | null = req.body?.avatarUrl || null;

		if (code && (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET)) {
			addLog('error', '[OAuth2] Thiếu DISCORD_CLIENT_ID hoặc DISCORD_CLIENT_SECRET trong .env');
			res.status(500).json({
				error: 'Máy chủ chưa cấu hình DISCORD_CLIENT_SECRET nên không thể hoàn tất đăng nhập Discord.',
			});
			return;
		}

		if (code && process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) {
			const redirectUri = resolveRedirectUri(req.body?.redirectUri);
			const tokenRes = await fetch('https://discord.com/api/v10/oauth2/token', {
				method: 'POST',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				body: new URLSearchParams({
					client_id: process.env.DISCORD_CLIENT_ID,
					client_secret: process.env.DISCORD_CLIENT_SECRET,
					grant_type: 'authorization_code',
					code,
					redirect_uri: redirectUri,
				}).toString(),
			});
			const tokenData: any = await tokenRes.json();
			if (!tokenData?.access_token) {
				res.status(400).json({
					error: tokenData?.error_description || tokenData?.error || 'Mã xác thực Discord OAuth2 không hợp lệ hoặc đã hết hạn',
				});
				return;
			}
			const userRes = await fetch('https://discord.com/api/v10/users/@me', {
				headers: { Authorization: `Bearer ${tokenData.access_token}` },
			});
			const userData: any = await userRes.json();
			if (!userData?.id) {
				res.status(400).json({ error: 'Không thể truy xuất thông tin tài khoản từ Discord API' });
				return;
			}
			id = userData.id;
			username = userData.global_name || userData.username;
			email = userData.email || `${userData.username}@discord.oauth`;
			avatarUrl = userData.avatar
				? `https://cdn.discordapp.com/avatars/${id}/${userData.avatar}.png`
				: null;

			// Auto-join member to Guild using Bot Token (Scope: guilds.join)
			const botToken = process.env.DISCORD_BOT_TOKEN;
			const guildId = process.env.GUILD_ID;
			if (botToken && guildId && tokenData?.access_token) {
				try {
					await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${id}`, {
						method: 'PUT',
						headers: {
							Authorization: `Bot ${botToken}`,
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							access_token: tokenData.access_token,
						}),
					});
					addLog('info', `[Bot OAuth2] Đã kết nạp user @${username} (${id}) vào Guild ${guildId} qua Bot Token`);
				} catch (joinErr: any) {
					addLog('warn', `[Bot OAuth2] Không thể tự động thêm user vào server: ${joinErr?.message || joinErr}`);
				}
			}
		} else if (accessToken) {
			// Direct Discord token validation (User Token or Bearer Token)
			const authHeader = accessToken.startsWith('Bearer ') || accessToken.startsWith('Bot ') ? accessToken : accessToken;
			const userRes = await fetch('https://discord.com/api/v10/users/@me', {
				headers: { Authorization: authHeader },
			});
			const userData: any = await userRes.json();
			if (userData && userData.id) {
				id = userData.id;
				username = userData.global_name || userData.username;
				email = userData.email || `${userData.username}@discord.oauth`;
				avatarUrl = userData.avatar
					? `https://cdn.discordapp.com/avatars/${id}/${userData.avatar}.png`
					: null;
			} else {
				res.status(400).json({ error: 'Token tài khoản Discord không hợp lệ hoặc đã hết hạn' });
				return;
			}
		}

		if (!username && email) {
			username = email.split('@')[0];
		}
		if (!username) {
			res.status(400).json({ error: 'Vui lòng nhập tên tài khoản hoặc email hợp lệ' });
			return;
		}
		if (!id) {
			const cleanSlug = (email || username).toLowerCase().replace(/[^a-z0-9]/g, '');
			id = `dc_${cleanSlug}`;
		}

		const account = subscriptionManager.upsertOAuthAccount({
			id,
			provider,
			username,
			email: email || `${username}@${provider}.oauth`,
			avatarUrl,
			token: accessToken,
		});

		const subscription = subscriptionManager.computeSubscriptionStatus(account);
		addLog(
			'success',
			`[OAuth2] User @${account.username} (${account.provider.toUpperCase()}) authenticated and linked with Bot.`
		);

		res.json({
			success: true,
			sessionToken: account.sessionToken,
			account,
			subscription,
		});
	} catch (err: any) {
		addLog('error', `[OAuth2 Login Error]: ${err?.message || err}`);
		res.status(500).json({ error: err?.message || 'Đăng nhập OAuth2 thất bại' });
	}
});

// Verify session & subscription status (2nd verification for dash.arychi.xyz / dash.arychy.xyz)
app.get('/api/subscription/verify', (req: Request, res: Response) => {
	const sessionToken = extractSessionToken(req);
	const account = subscriptionManager.getAccountBySession(sessionToken);

	if (!account) {
		res.json({
			verified: false,
			authenticated: false,
			hasActivePlan: false,
			daysRemaining: 0,
			domainTarget: 'dash.arychi.xyz',
			account: null,
			subscription: null,
		});
		return;
	}

	const subscription = subscriptionManager.computeSubscriptionStatus(account);
	const hasActivePlan = Boolean(subscription && subscription.isActive);

	res.json({
		verified: hasActivePlan,
		authenticated: true,
		hasActivePlan,
		daysRemaining: subscription?.daysRemaining || 0,
		domainTarget: 'dash.arychi.xyz',
		account,
		subscription,
	});
});

// Admin or direct grant subscription for a user account
app.post('/api/subscription/grant', (req: Request, res: Response) => {
	const userId = String(req.body?.userId || '').trim();
	const months = Math.max(1, parseInt(String(req.body?.months || 12), 10));
	const customKey = req.body?.licenseKey ? String(req.body.licenseKey).trim() : undefined;

	if (!userId) {
		res.status(400).json({ error: 'Missing userId' });
		return;
	}

	const result = subscriptionManager.grantSubscription(userId, months, customKey);
	if (!result) {
		res.status(404).json({ error: `Account with ID ${userId} not found in database` });
		return;
	}

	addLog(
		'success',
		`[VIP Grant] Đã cấp gói Premium (+${months} tháng) cho tài khoản @${result.account.username} (ID: ${userId})`
	);

	res.json({
		success: true,
		account: result.account,
		subscription: result.subscription,
	});
});

// Create VietQR & PayOS payment order (20.000đ / 1 tháng, stackable by months)
app.post('/api/payments/create', async (req: Request, res: Response) => {
	try {
		const sessionToken = extractSessionToken(req);
		const account =
			subscriptionManager.getAccountBySession(sessionToken) ||
			(req.body?.userId ? subscriptionManager.getAccountById(String(req.body.userId)) : null);

		if (!account) {
			res.status(401).json({ error: 'Vui lòng đăng nhập qua Bot Discord OAuth2 trước khi mua gói' });
			return;
		}

		const months = Number(req.body?.months || 1);
		const returnOrigin = String(req.body?.returnOrigin || 'https://dash.arychi.xyz');
		const order = await subscriptionManager.createPaymentOrder(account, months, returnOrigin);

		addLog(
			'info',
			`[VietQR/PayOS] Created order #${order.orderCode} for @${account.username}: ${
				order.months
			} tháng (${order.amount.toLocaleString('vi-VN')}đ)`
		);

		res.json({
			success: true,
			order,
		});
	} catch (err: any) {
		res.status(500).json({ error: err?.message || 'Không thể khởi tạo đơn thanh toán VietQR/PayOS' });
	}
});

// Check payment order status (polls PayOS API if configured + checks Database)
app.get('/api/payments/order/:orderCode', async (req: Request, res: Response) => {
	const orderCode = Number(req.params.orderCode);
	if (!orderCode) {
		res.status(400).json({ error: 'Mã đơn hàng không hợp lệ' });
		return;
	}
	const order = await subscriptionManager.checkOrderWithPayOS(orderCode);
	if (!order) {
		res.status(404).json({ error: 'Không tìm thấy đơn hàng trong Database' });
		return;
	}
	const account = subscriptionManager.getAccountById(order.userId);
	const subscription = subscriptionManager.computeSubscriptionStatus(account);
	res.json({
		order,
		account,
		subscription,
	});
});

// PayOS Webhook endpoint for automatic payment confirmation & monthly addition
app.post('/api/payments/webhook/payos', (req: Request, res: Response) => {
	try {
		const body = req.body;
		const orderCode = Number(body?.data?.orderCode || body?.orderCode);
		const isSuccess = body?.code === '00' || body?.success === true || body?.data?.code === '00';

		if (orderCode && isSuccess) {
			const result = subscriptionManager.markOrderPaidAndExtendSubscription(orderCode);
			if (result) {
				addLog(
					'success',
					`[PayOS Webhook] Đã xác nhận thanh toán đơn #${orderCode} (+${result.order.months} tháng) cho @${result.account.username}`
				);
			}
		}
		res.json({ success: true });
	} catch (err: any) {
		res.status(500).json({ error: err?.message || 'Webhook processing error' });
	}
});

// Confirm VietQR / PayOS payment & credit months to Database
app.post('/api/payments/confirm/:orderCode', async (req: Request, res: Response) => {
	const orderCode = Number(req.params.orderCode);
	if (!orderCode) {
		res.status(400).json({ error: 'Mã đơn hàng không hợp lệ' });
		return;
	}

	await subscriptionManager.checkOrderWithPayOS(orderCode);
	const result = subscriptionManager.markOrderPaidAndExtendSubscription(orderCode);

	if (!result) {
		res.status(404).json({ error: 'Không tìm thấy đơn hàng hoặc tài khoản trong Database' });
		return;
	}

	addLog(
		'success',
		`[Payment Verified] Đã cộng +${result.order.months} tháng gói 20k cho @${result.account.username} (Hết hạn: ${new Date(
			result.account.subscriptionExpiresAt!
		).toLocaleDateString('vi-VN')})`
	);

	res.json({
		success: true,
		order: result.order,
		account: result.account,
		subscription: result.subscription,
	});
});

// Save & verify Discord account tokens in Database (1 Token for Quest/Badges, 2 Tokens for Stream: Main + Viewer)
app.post('/api/account/tokens', async (req: Request, res: Response) => {
	const sessionToken = extractSessionToken(req);
	const account = subscriptionManager.getAccountBySession(sessionToken);

	if (!account) {
		res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.' });
		return;
	}

	const {
		questToken,
		streamMainToken,
		streamViewerToken,
		streamGuildId,
		streamChannelId,
		prefix,
		commandChannelId,
		adminIds,
	} = req.body || {};

	// If questToken is provided and non-empty, verify it with Discord API
	let verifiedDiscordUser = null;
	if (typeof questToken === 'string' && questToken.trim().length > 0) {
		const check = await questService.verifyToken(questToken.trim());
		if (!check.valid || !check.user) {
			res.status(400).json({
				error: check.error || 'Token tài khoản Discord (Quest/Giờ chơi) không hợp lệ hoặc đã hết hạn.',
			});
			return;
		}
		verifiedDiscordUser = check.user;
	}

	const updated = subscriptionManager.updateAccountTokens(account.id, {
		questToken: typeof questToken === 'string' ? questToken : undefined,
		streamMainToken: typeof streamMainToken === 'string' ? streamMainToken : undefined,
		streamViewerToken: typeof streamViewerToken === 'string' ? streamViewerToken : undefined,
		streamGuildId: typeof streamGuildId === 'string' ? streamGuildId : undefined,
		streamChannelId: typeof streamChannelId === 'string' ? streamChannelId : undefined,
		prefix: typeof prefix === 'string' ? prefix : undefined,
		commandChannelId: typeof commandChannelId === 'string' ? commandChannelId : undefined,
		adminIds: typeof adminIds === 'string' ? adminIds : undefined,
	});

	// Forward stream tokens to StreamBot (:3000) for real-time activation
	if (streamMainToken || streamViewerToken) {
		fetch('http://localhost:3000/api/config/tokens', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				mainToken: streamMainToken,
				viewerToken: streamViewerToken,
				guildId: streamGuildId,
				videoChannelId: streamChannelId,
				prefix,
				cmdChannelId: commandChannelId,
				adminIds,
			}),
		}).catch(() => {});
	}

	addLog('info', `[Database] Đã lưu cấu hình Token vào commercial_db.json cho tài khoản @${account.username}.`);

	res.json({
		success: true,
		account: updated,
		verifiedDiscordUser,
		subscription: subscriptionManager.computeSubscriptionStatus(updated),
	});
});

// Verify Discord Token (Bot or User) & optionally save to database
app.post('/api/auth/verify', async (req: Request, res: Response) => {
	const token = extractToken(req);
	const preferredType = req.body?.type as 'bot' | 'user' | undefined;
	const saveToData = req.body?.saveToData !== false;

	if (!token) {
		res.status(400).json({ error: 'Token is required' });
		return;
	}

	const result = await questService.verifyToken(token, preferredType);
	if (!result.valid || !result.user) {
		res.status(401).json(result);
		return;
	}

	let savedUser: StoredUser | null = null;
	if (saveToData) {
		savedUser = userManager.saveUser({
			id: result.user.id,
			username: result.user.username,
			discriminator: result.user.discriminator,
			avatarUrl: result.user.avatarUrl,
			email: result.user.email,
			token,
			type: result.user.type || (result.user.bot ? 'bot' : 'user'),
			bot: Boolean(result.user.bot),
		});
	}

	res.json({
		valid: true,
		user: result.user,
		savedUser,
	});
});

// Get all saved accounts from persistent database
app.get('/api/auth/users', (_req: Request, res: Response) => {
	const users = userManager.getAllUsers();
	const active = userManager.getActiveUser();
	res.json({
		users,
		activeUserId: active?.id || null,
	});
});

// Get current active user from database
app.get('/api/auth/current', (_req: Request, res: Response) => {
	const active = userManager.getActiveUser();
	res.json({ user: active });
});

// Switch active user in database
app.post('/api/auth/switch', (req: Request, res: Response) => {
	const id = req.body?.id;
	if (!id) {
		res.status(400).json({ error: 'User ID is required' });
		return;
	}
	const user = userManager.setActiveUser(id);
	if (!user) {
		res.status(404).json({ error: 'User not found in database' });
		return;
	}
	res.json({ success: true, user });
});

// Delete user from database
app.delete('/api/auth/users/:id', (req: Request, res: Response) => {
	const id = req.params.id;
	const success = userManager.deleteUser(id);
	res.json({ success });
});

// Get quests for a token
app.post('/api/quests/list', async (req: Request, res: Response) => {
	const token = extractToken(req);
	if (!token) {
		res.status(400).json({ error: 'Token is required' });
		return;
	}
	try {
		const data = await questService.fetchQuests(token);
		res.json(data);
	} catch (error: any) {
		res.status(500).json({ error: error.message || 'Failed to fetch quests' });
	}
});

// Enroll in a specific quest
app.post('/api/quests/:id/enroll', async (req: Request, res: Response) => {
	const token = extractToken(req);
	const questId = req.params.id;
	if (!token) {
		res.status(400).json({ error: 'Token is required' });
		return;
	}
	try {
		const quest = await questService.enrollQuest(token, questId);
		res.json({ success: true, quest });
	} catch (error: any) {
		res.status(500).json({ error: error.message || 'Failed to enroll quest' });
	}
});

// Start a single quest
app.post('/api/quests/:id/start', async (req: Request, res: Response) => {
	const token = extractToken(req);
	const questId = req.params.id;
	if (!token) {
		res.status(400).json({ error: 'Token is required' });
		return;
	}
	try {
		const job = await questService.startQuest(token, questId);
		res.json({
			success: true,
			job: { ...job, abortController: undefined },
		});
	} catch (error: any) {
		res.status(500).json({ error: error.message || 'Failed to start quest' });
	}
});

// Stop a single quest
app.post('/api/quests/:id/stop', (req: Request, res: Response) => {
	const token = extractToken(req);
	const questId = req.params.id;
	if (!token) {
		res.status(400).json({ error: 'Token is required' });
		return;
	}
	const stopped = questService.stopQuest(token, questId);
	res.json({ success: stopped });
});

// Start all valid quests
app.post('/api/quests/start-all', async (req: Request, res: Response) => {
	const token = extractToken(req);
	if (!token) {
		res.status(400).json({ error: 'Token is required' });
		return;
	}
	try {
		const jobs = await questService.startAllQuests(token);
		res.json({
			success: true,
			startedCount: jobs.length,
			jobs: jobs.map((j) => ({ ...j, abortController: undefined })),
		});
	} catch (error: any) {
		res.status(500).json({ error: error.message || 'Failed to start all quests' });
	}
});

// Stop all running quests for a token
app.post('/api/quests/stop-all', (req: Request, res: Response) => {
	const token = extractToken(req);
	if (!token) {
		res.status(400).json({ error: 'Token is required' });
		return;
	}
	const stoppedCount = questService.stopAllQuests(token);
	res.json({ success: true, stoppedCount });
});

// Claim reward for a quest
app.post('/api/quests/:id/claim', async (req: Request, res: Response) => {
	const token = extractToken(req);
	const questId = req.params.id;
	if (!token) {
		res.status(400).json({ error: 'Token is required' });
		return;
	}
	try {
		await questService.claimQuestReward(token, questId);
		res.json({ success: true, message: 'Reward claim requested' });
	} catch (error: any) {
		res.status(500).json({ error: error.message || 'Failed to claim reward' });
	}
});

// Get active jobs status
app.get('/api/quests/jobs', (req: Request, res: Response) => {
	const token = (req.query.token as string) || '';
	const jobs = questService.getJobs(token ? token : undefined);
	res.json({
		jobs: jobs.map((j) => ({ ...j, abortController: undefined })),
	});
});

// Get recent logs
app.get('/api/logs', (_req: Request, res: Response) => {
	res.json({ logs: logBuffer });
});

// Global error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
	addLog('error', `Unhandled server error: ${err?.message || err}`);
	res.status(500).json({ error: 'Internal Server Error' });
});

// Graceful shutdown
function handleGracefulShutdown(signal: string) {
	addLog('info', `Received ${signal}. Shutting down gracefully...`);
	clearInterval(wsPingInterval);
	const stopped = questService.stopAllRunningJobsGlobally();
	addLog('info', `Stopped ${stopped} running jobs cleanly.`);
	wss.close();
	server.close(() => {
		addLog('info', 'HTTP and WebSocket server closed.');
		process.exit(0);
	});
}

process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));

// Start listening
server.listen(PORT, async () => {
	addLog('info', `=====================================================`);
	addLog('info', ` Discord Quest Backend Server running on port ${PORT}`);
	addLog('info', ` REST API:   http://localhost:${PORT}/api`);
	addLog('info', ` WebSocket:  ws://localhost:${PORT}/ws`);
	addLog('info', `=====================================================`);

	// Pre-fetch latest build number
	await Utils.updateLatestBuildVersion();
});

export { app, server };
