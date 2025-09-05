import {
	createSignal,
	createResource,
	type Component,
	type JSX,
	For,
} from 'solid-js';
import {exploreAedificium} from '~/lib/firebase';

import styles from './index.module.css';

interface ExploreResult {
	results: number[][];
	queryCount: number;
}

interface Problem {
	problem: string;
	size: number;
}

const fetchProblems = async (): Promise<Problem[]> => {
	const response = await fetch('/docs/problems.json');
	if (!response.ok) {
		throw new Error('Failed to load problems list');
	}
	return response.json();
};

const Index: Component = () => {
	const [problems] = createResource(fetchProblems);
	const [plans, setPlans] = createSignal('');
	const [problemName, setProblemName] = createSignal('probatio');
	const [result, setResult] = createSignal<ExploreResult | null>(null);
	const [loading, setLoading] = createSignal(false);
	const [error, setError] = createSignal('');

	const onSubmitExplore: JSX.EventHandler<
		HTMLFormElement,
		SubmitEvent
	> = async (event) => {
		event.preventDefault();
		setError('');
		setResult(null);
		setLoading(true);

		try {
			const plansArray = plans()
				.split(',')
				.map((plan) => plan.trim())
				.filter((plan) => plan.length > 0);

			if (plansArray.length === 0) {
				throw new Error('Please enter at least one route plan');
			}

			// Validate that all plans contain only digits 0-5
			const invalidPlans = plansArray.filter((plan) => !/^[0-5]+$/.test(plan));
			if (invalidPlans.length > 0) {
				throw new Error(
					`Invalid route plans: ${invalidPlans.join(', ')} - only digits 0-5 are allowed`,
				);
			}

			console.log('Sending plans:', plansArray, 'Problem:', problemName());
			const response = await exploreAedificium({
				plans: plansArray,
				problemName: problemName(),
			});
			setResult(response.data as ExploreResult);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Unknown error occurred');
			console.error('Exploration error:', err);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div class={styles.container}>
			<h1>ICFPC 2025 Ædificium Explorer</h1>

			<form onSubmit={onSubmitExplore} class={styles.form}>
				<div class={styles.inputGroup}>
					<label for="problemName">Problem:</label>
					<select
						id="problemName"
						value={problemName()}
						onChange={(event) => setProblemName(event.currentTarget.value)}
						disabled={loading() || problems.loading}
						class={styles.select}
					>
						{problems.loading && <option>Loading problems...</option>}
						{problems.error && <option>Error loading problems</option>}
						{problems() && (
							<For each={problems()}>
								{(problem) => (
									<option value={problem.problem}>
										{problem.problem} ({problem.size} rooms)
									</option>
								)}
							</For>
						)}
					</select>
					<p class={styles.help}>
						Select a problem to explore. "probatio" is the test problem with 3
						rooms.
					</p>
				</div>

				<div class={styles.inputGroup}>
					<label for="plans">Route Plans (comma-separated):</label>
					<input
						id="plans"
						type="text"
						value={plans()}
						onChange={(event) => setPlans(event.currentTarget?.value || '')}
						placeholder="e.g., 0325, 142, 5043"
						disabled={loading()}
						class={styles.input}
					/>
					<p class={styles.help}>
						Enter route plans as strings of digits 0-5, separated by commas.
						Each digit represents a door number to enter.
					</p>
				</div>

				<button
					type="submit"
					disabled={loading() || !plans().trim()}
					class={styles.button}
				>
					{loading() ? 'Exploring...' : 'Explore Ædificium'}
				</button>
			</form>

			{error() && (
				<div class={styles.error}>
					<h3>Error:</h3>
					<p>{error()}</p>
				</div>
			)}

			{result() && (
				<div class={styles.results}>
					<h3>Exploration Results:</h3>
					<div class={styles.queryInfo}>
						<p>
							<strong>Query Count:</strong> {result()?.queryCount}
						</p>
						<p>
							<strong>Results Found:</strong> {result()?.results.length}
						</p>
					</div>

					<div class={styles.resultsList}>
						<h4>Results:</h4>
						<For each={result()?.results}>
							{(resultArray, index) => (
								<div class={styles.resultItem}>
									<strong>Plan {index() + 1}:</strong> [{resultArray.join(', ')}
									]
								</div>
							)}
						</For>
					</div>
				</div>
			)}
		</div>
	);
};

export default Index;
