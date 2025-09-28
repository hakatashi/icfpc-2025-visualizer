import {test, expect, vi} from 'vitest';
import {render} from '@solidjs/testing-library';
import Index from './index.js';

// Mock the router components
vi.mock('@solidjs/router', () => ({
	A: (props: any) => (
		<a href={props.href} class={props.class}>
			{props.children}
		</a>
	),
}));

test('renders main heading', () => {
	const {getByRole} = render(() => <Index />);

	const heading = getByRole('heading', {level: 1});
	expect(heading).toHaveTextContent('ICFPC 2025 ビジュアライザー');
});

test('renders description text', () => {
	const {getByText} = render(() => <Index />);

	expect(
		getByText('ICFPC 2025 チャレンジのためのツールセットです。'),
	).toBeInTheDocument();
});

test('renders available tools section', () => {
	const {getByRole} = render(() => <Index />);

	const toolsHeading = getByRole('heading', {level: 2});
	expect(toolsHeading).toHaveTextContent('利用可能なツール:');
});

test('renders library exploration tool link', () => {
	const {getByRole} = render(() => <Index />);

	const exploreLink = getByRole('link', {name: /図書館探索ツール/});
	expect(exploreLink).toHaveAttribute('href', '/submit/explore');
	expect(exploreLink).toHaveTextContent(
		'実際のICFPC APIサーバーと通信して図書館を探索します',
	);
});

test('renders library simulator tool link', () => {
	const {getByRole} = render(() => <Index />);

	const simulatorLink = getByRole('link', {name: /図書館シミュレーター/});
	expect(simulatorLink).toHaveAttribute('href', '/simulator');
	expect(simulatorLink).toHaveTextContent(
		'ローカルで図書館探索をシミュレートします',
	);
});

test('renders tool list with correct number of items', () => {
	const {getAllByRole} = render(() => <Index />);

	const listItems = getAllByRole('listitem');
	expect(listItems).toHaveLength(2);
});
