import {onRequest, onCall} from 'firebase-functions/https';
import {
	info as loggerInfo,
	error as loggerError,
} from 'firebase-functions/logger';
import {initializeApp} from 'firebase-admin/app';
import {
	type CollectionReference,
	getFirestore,
	Timestamp,
} from 'firebase-admin/firestore';
import {defineString} from 'firebase-functions/params';
import type {Task} from '../../src/lib/schema.ts';
import {onSchedule} from 'firebase-functions/scheduler';

if (process.env.FUNCTIONS_EMULATOR === 'true') {
	process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
}

const app = initializeApp();
const db = getFirestore(app);

const Tasks = db.collection('tasks') as CollectionReference<Task>;

const apiKey = defineString('API_KEY');

export const getTasks = onRequest(async (request, response) => {
	if (request.query.apiKey !== apiKey.value()) {
		response.status(403).send('Unauthorized');
		return;
	}

	const tasks = await Tasks.get();
	const taskList = tasks.docs.map((task) => task.data());
	response.json(taskList);
});

export const resetTasksCronJob = onSchedule('every 24 hours', async () => {
	loggerInfo('Resetting tasks');

	await db.runTransaction(async (transaction) => {
		const tasks = await transaction.get(Tasks);
		for (const task of tasks.docs) {
			transaction.delete(task.ref);
		}
		transaction.set(Tasks.doc(), {
			task: 'task1',
			uid: 'system',
			createdAt: Timestamp.now(),
		});
		transaction.set(Tasks.doc(), {
			task: 'task2',
			uid: 'system',
			createdAt: Timestamp.now(),
		});
	});

	loggerInfo('Tasks reset');
});

const ICFPC_API_BASE_URL =
	'https://31pwr5t6ij.execute-api.eu-west-2.amazonaws.com';
const TEAM_ID = 'info@tsg.ne.jp f0iku9r_xs5Fge6Mb5L-cw';

interface ExploreRequest {
	plans: string[];
	problemName?: string;
}

interface ExploreResponse {
	results: number[][];
	queryCount: number;
}

interface SelectRequest {
	id: string;
	problemName: string;
}

interface SelectResponse {
	problemName: string;
}

export const exploreAedificium = onCall<
	ExploreRequest,
	Promise<ExploreResponse>
>(async (request) => {
	const {plans, problemName = 'probatio'} = request.data;

	if (!plans || !Array.isArray(plans)) {
		throw new Error('Invalid request: plans array is required');
	}

	// Filter out empty strings and validate plans
	const validPlans = plans
		.filter(
			(plan) =>
				typeof plan === 'string' &&
				plan.trim().length > 0 &&
				/^[0-5]+$/.test(plan.trim()),
		)
		.map((plan) => plan.trim());

	if (validPlans.length === 0) {
		throw new Error(
			'Invalid request: at least one valid plan is required (digits 0-5 only)',
		);
	}

	try {
		// Step 1: Select a problem first
		loggerInfo('Selecting problem', {
			teamId: TEAM_ID,
			problemName: problemName,
		});

		const selectPayload: SelectRequest = {
			id: TEAM_ID,
			problemName: problemName,
		};

		const selectResponse = await fetch(`${ICFPC_API_BASE_URL}/select`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(selectPayload),
		});

		if (!selectResponse.ok) {
			const selectErrorText = await selectResponse.text();
			loggerError('ICFPC Select API error', {
				status: selectResponse.status,
				statusText: selectResponse.statusText,
				error: selectErrorText,
				selectPayload,
			});
			throw new Error(
				`Problem selection failed: ${selectResponse.status} ${selectResponse.statusText}`,
			);
		}

		const selectResult: SelectResponse = await selectResponse.json();
		loggerInfo('Problem selected successfully', selectResult);

		// Step 2: Now explore with the selected problem
		loggerInfo('Making explore request to ICFPC API', {
			teamId: TEAM_ID,
			planCount: validPlans.length,
			plans: validPlans,
			selectedProblem: selectResult.problemName,
		});

		const explorePayload = {
			id: TEAM_ID,
			plans: validPlans,
		};

		loggerInfo('Explore request payload', explorePayload);

		const exploreResponse = await fetch(`${ICFPC_API_BASE_URL}/explore`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(explorePayload),
		});

		if (!exploreResponse.ok) {
			const errorText = await exploreResponse.text();
			loggerError('ICFPC Explore API error', {
				status: exploreResponse.status,
				statusText: exploreResponse.statusText,
				error: errorText,
				explorePayload,
			});
			throw new Error(
				`API request failed: ${exploreResponse.status} ${exploreResponse.statusText}`,
			);
		}

		const result: ExploreResponse = await exploreResponse.json();

		loggerInfo('Explore request successful', {
			resultCount: result.results.length,
			queryCount: result.queryCount,
		});

		return result;
	} catch (error) {
		loggerError('Error in exploreAedificium', error);
		throw new Error(
			`Failed to explore aedificium: ${error instanceof Error ? error.message : 'Unknown error'}`,
		);
	}
});
