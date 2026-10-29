import 'dotenv/config';
import { GatewayDispatchEvents } from 'discord-api-types/v10';
import { ClientQuest } from './src/client';
import { addLog } from './src/utils';

let currentUserId: string | null = null;
const token = process.env.TOKEN;

if (!token) {
	console.error('Error: TOKEN is missing in environment variables or .env file.');
	process.exit(1);
}

const client = new ClientQuest(token);

client.once(GatewayDispatchEvents.Ready, async ({ data }) => {
	currentUserId = data.user.id;
	if (process.env.GITHUB_ACTIONS === 'true') {
		console.log('Logged in!');
	} else {
		console.log(`Logged in as @${data.user.username} (${currentUserId})`);
	}

	await client.fetchQuests(false);
	const questsValid = client.questManager!.filterQuestsValidToDo();
	console.log(`Found ${questsValid.length} valid quests to do.`);

	await Promise.allSettled(
		questsValid.map((quest) => client.questManager!.doingQuest(quest)),
	);

	console.log('All quests processed. Disconnecting...');
	await client.destroy();
	process.exit(0);
});

process.on('unhandledRejection', (reason: any) => {
	addLog('error', `Unhandled Rejection: ${reason?.message || reason}`);
});

process.on('uncaughtException', (error: Error) => {
	addLog('error', `Uncaught Exception: ${error.message}`);
});

client.connect();
