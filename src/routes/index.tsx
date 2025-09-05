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
				throw new Error('少なくとも1つの経路プランを入力してください');
			}

			// Validate that all plans contain only digits 0-5
			const invalidPlans = plansArray.filter((plan) => !/^[0-5]+$/.test(plan));
			if (invalidPlans.length > 0) {
				throw new Error(
					`無効な経路プラン: ${invalidPlans.join(', ')} - 0-5の数字のみ使用できます`,
				);
			}

			console.log('Sending plans:', plansArray, 'Problem:', problemName());
			const response = await exploreAedificium({
				plans: plansArray,
				problemName: problemName(),
			});
			setResult(response.data as ExploreResult);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : '不明なエラーが発生しました',
			);
			console.error('Exploration error:', err);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div class={styles.container}>
			<h1>ICFPC 2025 図書館探索ツール</h1>

			<form onSubmit={onSubmitExplore} class={styles.form}>
				<div class={styles.inputGroup}>
					<label for="problemName">問題:</label>
					<select
						id="problemName"
						value={problemName()}
						onChange={(event) => setProblemName(event.currentTarget.value)}
						disabled={loading() || problems.loading}
						class={styles.select}
					>
						{problems.loading && <option>問題を読み込み中...</option>}
						{problems.error && <option>問題の読み込みエラー</option>}
						{problems() && (
							<For each={problems()}>
								{(problem) => (
									<option value={problem.problem}>
										{problem.problem} ({problem.size} 部屋)
									</option>
								)}
							</For>
						)}
					</select>
					<p class={styles.help}>
						探索する問題を選択してください。"probatio"は3部屋のテスト問題です。
					</p>
				</div>

				<div class={styles.inputGroup}>
					<label for="plans">経路プラン (カンマ区切り):</label>
					<input
						id="plans"
						type="text"
						value={plans()}
						onChange={(event) => setPlans(event.currentTarget?.value || '')}
						placeholder="例: 0325, 142, 5043"
						disabled={loading()}
						class={styles.input}
					/>
					<p class={styles.help}>
						0-5の数字で構成された経路プランをカンマ区切りで入力してください。
						各数字は通る扉の番号を表します。
					</p>
				</div>

				<button
					type="submit"
					disabled={loading() || !plans().trim()}
					class={styles.button}
				>
					{loading() ? '探索中...' : '図書館を探索'}
				</button>
			</form>

			{error() && (
				<div class={styles.error}>
					<h3>エラー:</h3>
					<p>{error()}</p>
				</div>
			)}

			{result() && (
				<div class={styles.results}>
					<h3>探索結果:</h3>
					<div class={styles.queryInfo}>
						<p>
							<strong>クエリ数:</strong> {result()?.queryCount}
						</p>
						<p>
							<strong>結果数:</strong> {result()?.results.length}
						</p>
					</div>

					<div class={styles.resultsList}>
						<h4>結果:</h4>
						<For each={result()?.results}>
							{(resultArray, index) => (
								<div class={styles.resultItem}>
									<strong>プラン {index() + 1}:</strong> [
									{resultArray.join(', ')}]
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
