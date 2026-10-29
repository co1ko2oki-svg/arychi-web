import 'dotenv/config';
import http from 'node:http';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { questService, QuestJob } from './questService';
import { userManager, StoredUser } from './userManager';
import { logEmitter, logBuffer, addLog, LogEntry, Utils } from './utils';

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
	return (req.body?.token || process.env.TOKEN || '').trim();
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
