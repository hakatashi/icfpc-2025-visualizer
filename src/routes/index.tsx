import type {Component} from 'solid-js';
import {A} from '@solidjs/router';

import styles from './index.module.css';

const Index: Component = () => {
	return (
		<div class={styles.container}>
			<h1>ICFPC 2025 ビジュアライザー</h1>

			<div class={styles.description}>
				<p>ICFPC 2025 チャレンジのためのツールセットです。</p>
			</div>

			<div class={styles.navigation}>
				<h2>利用可能なツール:</h2>
				<ul class={styles.toolList}>
					<li>
						<A href="/submit/explore" class={styles.toolLink}>
							<h3>図書館探索ツール</h3>
							<p>実際のICFPC APIサーバーと通信して図書館を探索します</p>
						</A>
					</li>
					<li class={styles.comingSoon}>
						<h3>シミュレーター (準備中)</h3>
						<p>ローカルで図書館探索をシミュレートします</p>
					</li>
				</ul>
			</div>
		</div>
	);
};

export default Index;
