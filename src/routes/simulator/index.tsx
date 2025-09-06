import type {Component} from 'solid-js';
import {createSignal, createMemo, For} from 'solid-js';

import styles from './index.module.css';

interface DoorConnection {
	toRoom: number;
	toDoor: number;
}

interface Room {
	id: number;
	label: number; // 2-bit integer (0-3)
	doors: DoorConnection[]; // connections to other rooms via specific doors
}

interface Building {
	rooms: Room[];
	startingRoom: number;
}

// Seeded random number generator (Linear Congruential Generator)
class SeededRandom {
	private seed: number;

	constructor(seed: number) {
		this.seed = seed;
	}

	next(): number {
		this.seed = (this.seed * 1103515245 + 12345) % 2 ** 31;
		return this.seed / 2 ** 31;
	}

	nextInt(max: number): number {
		return Math.floor(this.next() * max);
	}
}

const generateBuilding = (numRooms: number, seed: number): Building => {
	const rng = new SeededRandom(seed);
	const rooms: Room[] = [];

	// Generate rooms with random 2-bit labels and empty door arrays
	for (let i = 0; i < numRooms; i++) {
		rooms.push({
			id: i,
			label: rng.nextInt(4), // 2-bit integer (0-3)
			doors: new Array(6).fill(null).map(() => ({toRoom: -1, toDoor: -1})), // 6 doors per hexagonal room
		});
	}

	// Generate connections between rooms
	// Each room has 6 doors (0-5), and we need to ensure all doors are connected
	const connectRooms = (
		fromRoom: number,
		fromDoor: number,
		toRoom: number,
		toDoor: number,
	) => {
		rooms[fromRoom].doors[fromDoor] = {toRoom, toDoor};
		if (fromRoom !== toRoom || fromDoor !== toDoor) {
			rooms[toRoom].doors[toDoor] = {toRoom: fromRoom, toDoor: fromDoor};
		}
	};

	// Helper to check if a door is available
	const isDoorAvailable = (roomId: number, doorId: number): boolean => {
		return rooms[roomId].doors[doorId].toRoom === -1;
	};

	// First, create a spanning tree to ensure all rooms are reachable
	const visited = new Set<number>();
	const queue = [0]; // Start with room 0
	visited.add(0);

	while (queue.length > 0 && visited.size < numRooms) {
		const currentRoom = queue.shift()!;

		// Find unvisited rooms to connect to
		for (let targetRoom = 0; targetRoom < numRooms; targetRoom++) {
			if (!visited.has(targetRoom)) {
				// Find available doors on both rooms
				const fromDoor = rooms[currentRoom].doors.findIndex((_door, index) =>
					isDoorAvailable(currentRoom, index),
				);
				const toDoor = rooms[targetRoom].doors.findIndex((_door, index) =>
					isDoorAvailable(targetRoom, index),
				);

				if (fromDoor !== -1 && toDoor !== -1) {
					connectRooms(currentRoom, fromDoor, targetRoom, toDoor);
					visited.add(targetRoom);
					queue.push(targetRoom);
					break;
				}
			}
		}
	}

	// Add additional random connections to make the labyrinth more interesting
	for (let i = 0; i < numRooms * 2; i++) {
		const room1 = rng.nextInt(numRooms);
		const room2 = rng.nextInt(numRooms);
		const door1 = rng.nextInt(6);
		const door2 = rng.nextInt(6);

		// Only connect if both doors are available
		if (isDoorAvailable(room1, door1) && isDoorAvailable(room2, door2)) {
			connectRooms(room1, door1, room2, door2);
		}
	}

	// Ensure ALL doors are connected - fill remaining unconnected doors
	for (let roomId = 0; roomId < numRooms; roomId++) {
		for (let door = 0; door < 6; door++) {
			if (isDoorAvailable(roomId, door)) {
				// Find a random target for this door
				let targetRoom: number;
				let targetDoor: number;
				let attempts = 0;

				do {
					targetRoom = rng.nextInt(numRooms);
					targetDoor = rng.nextInt(6);
					attempts++;

					// If we can't find an available door, create a self-loop
					if (attempts > 20) {
						targetRoom = roomId;
						targetDoor = door;
						break;
					}
				} while (
					!isDoorAvailable(targetRoom, targetDoor) &&
					!(targetRoom === roomId && targetDoor === door)
				);

				connectRooms(roomId, door, targetRoom, targetDoor);
			}
		}
	}

	return {
		rooms,
		startingRoom: 0,
	};
};

const simulateExploration = (
	building: Building,
	routePlan: string,
): number[] => {
	const result: number[] = [];
	let currentRoom = building.startingRoom;

	// Record the starting room label
	result.push(building.rooms[currentRoom].label);

	// Follow the route plan
	for (const doorChar of routePlan) {
		const door = Number.parseInt(doorChar, 10);
		if (door < 0 || door > 5) continue; // Skip invalid door numbers

		const doorConnection = building.rooms[currentRoom].doors[door];
		if (doorConnection.toRoom !== -1) {
			currentRoom = doorConnection.toRoom;
			result.push(building.rooms[currentRoom].label);
		} else {
			// This shouldn't happen since all doors should be connected
			// But if it does, stay in current room
			result.push(building.rooms[currentRoom].label);
		}
	}

	return result;
};

// Helper functions for hexagonal visualization
const getHexagonPoints = (cx: number, cy: number, radius: number): string => {
	const points: number[] = [];
	for (let i = 0; i < 6; i++) {
		const angle = (Math.PI / 3) * i;
		const x = cx + radius * Math.cos(angle);
		const y = cy + radius * Math.sin(angle);
		points.push(x, y);
	}
	return points.join(' ');
};

const getDoorPosition = (
	cx: number,
	cy: number,
	radius: number,
	door: number,
): {x: number; y: number} => {
	const angle = (Math.PI / 3) * door;
	return {
		x: cx + radius * Math.cos(angle),
		y: cy + radius * Math.sin(angle),
	};
};

const getRoomPosition = (
	roomId: number,
	numRooms: number,
): {x: number; y: number} => {
	// Arrange rooms in a grid-like pattern
	const cols = Math.ceil(Math.sqrt(numRooms));
	const col = roomId % cols;
	const row = Math.floor(roomId / cols);

	return {
		x: 150 + col * 200,
		y: 150 + row * 180,
	};
};

interface BuildingVisualizationProps {
	building: Building;
	startingRoom: number;
}

const BuildingVisualization: Component<BuildingVisualizationProps> = (
	props,
) => {
	const [roomPositions, setRoomPositions] = createSignal(
		new Map<number, {x: number; y: number}>(),
	);
	const [draggedRoom, setDraggedRoom] = createSignal<number | null>(null);
	const [dragOffset, setDragOffset] = createSignal<{x: number; y: number}>({
		x: 0,
		y: 0,
	});

	// Initialize room positions
	createMemo(() => {
		const positions = new Map<number, {x: number; y: number}>();
		for (let i = 0; i < props.building.rooms.length; i++) {
			positions.set(i, getRoomPosition(i, props.building.rooms.length));
		}
		setRoomPositions(positions);
	});

	const svgWidth = createMemo(() => {
		const cols = Math.ceil(Math.sqrt(props.building.rooms.length));
		return Math.max(400, 100 + cols * 200);
	});

	const svgHeight = createMemo(() => {
		const cols = Math.ceil(Math.sqrt(props.building.rooms.length));
		const rows = Math.ceil(props.building.rooms.length / cols);
		return Math.max(300, 100 + rows * 180);
	});

	const getSvgCoordinates = (event: MouseEvent, svgElement: SVGSVGElement) => {
		const rect = svgElement.getBoundingClientRect();
		return {
			x: event.clientX - rect.left,
			y: event.clientY - rect.top,
		};
	};

	const handleMouseDown = (roomId: number, event: MouseEvent) => {
		event.preventDefault();
		setDraggedRoom(roomId);

		const svgElement = event.currentTarget.ownerSVGElement!;
		const svgCoords = getSvgCoordinates(event, svgElement);
		const roomPos = roomPositions().get(roomId)!;
		setDragOffset({
			x: svgCoords.x - roomPos.x,
			y: svgCoords.y - roomPos.y,
		});
	};

	const handleMouseMove = (event: MouseEvent) => {
		const dragged = draggedRoom();
		if (dragged !== null) {
			event.preventDefault();
			const svgElement = event.currentTarget as SVGSVGElement;
			const svgCoords = getSvgCoordinates(event, svgElement);
			const offset = dragOffset();
			const newPositions = new Map(roomPositions());
			newPositions.set(dragged, {
				x: svgCoords.x - offset.x,
				y: svgCoords.y - offset.y,
			});
			setRoomPositions(newPositions);
		}
	};

	const handleMouseUp = (event: MouseEvent) => {
		event.preventDefault();
		setDraggedRoom(null);
	};

	const connections = createMemo(() => {
		const conns: {
			from: {room: number; door: number; x: number; y: number};
			to: {room: number; door: number; x: number; y: number};
		}[] = [];
		const seen = new Set<string>();

		for (const room of props.building.rooms) {
			const roomPos = roomPositions().get(room.id)!;

			for (let door = 0; door < 6; door++) {
				const doorConnection = room.doors[door];
				if (doorConnection.toRoom !== -1) {
					const targetRoom = doorConnection.toRoom;
					const targetDoor = doorConnection.toDoor;

					// Create a unique key for this specific door-to-door connection
					// Include both room and door numbers to distinguish different passages between the same rooms
					const connectionKey =
						room.id === targetRoom
							? `self-${room.id}-${door}-${targetDoor}` // Self-loop: include both doors
							: `${Math.min(room.id, targetRoom)}-${Math.min(door, targetDoor)}-${Math.max(room.id, targetRoom)}-${Math.max(door, targetDoor)}`;

					// For self-loops, always draw them. For regular connections, only draw if not seen
					if (room.id === targetRoom || !seen.has(connectionKey)) {
						const targetPos = roomPositions().get(targetRoom)!;
						const fromDoorPos = getDoorPosition(roomPos.x, roomPos.y, 60, door);
						const toDoorPos = getDoorPosition(
							targetPos.x,
							targetPos.y,
							60,
							targetDoor,
						);

						conns.push({
							from: {room: room.id, door, x: fromDoorPos.x, y: fromDoorPos.y},
							to: {
								room: targetRoom,
								door: targetDoor,
								x: toDoorPos.x,
								y: toDoorPos.y,
							},
						});

						if (room.id !== targetRoom) {
							seen.add(connectionKey);
						}
					}
				}
			}
		}

		return conns;
	});

	return (
		<div class={styles.visualization}>
			<h3>建物の視覚化</h3>
			<svg
				width={svgWidth()}
				height={svgHeight()}
				class={styles.buildingSvg}
				aria-label="建物の構造図"
				onMouseMove={handleMouseMove}
				onMouseUp={handleMouseUp}
				onMouseLeave={handleMouseUp}
			>
				<title>建物の構造図</title>
				{/* 1. Draw rooms first */}
				<For each={props.building.rooms}>
					{(room) => {
						const pos = createMemo(() => roomPositions().get(room.id)!);
						return (
							<g>
								{/* Hexagon */}
								{/** biome-ignore lint/a11y/noStaticElementInteractions: SVG内でのドラッグ操作のため、あえて<polygon>を使用しています。 */}
								<polygon
									points={getHexagonPoints(pos().x, pos().y, 60)}
									class={
										room.id === props.startingRoom
											? styles.startingRoom
											: styles.room
									}
									style={{
										cursor: draggedRoom() === room.id ? 'grabbing' : 'grab',
									}}
									tabindex="0"
									aria-label={`部屋 ${room.id} をドラッグして移動`}
									onMouseDown={(e) => handleMouseDown(room.id, e)}
								/>

								{/* Room ID */}
								<text x={pos().x} y={pos().y - 5} class={styles.roomId}>
									{room.id}
								</text>

								{/* Room Label */}
								<text x={pos().x} y={pos().y + 15} class={styles.roomLabel}>
									L:{room.label}
								</text>
							</g>
						);
					}}
				</For>

				{/* 2. Draw door markers */}
				<For each={props.building.rooms}>
					{(room) => {
						const pos = createMemo(() => roomPositions().get(room.id)!);
						return (
							<For each={Array.from({length: 6}, (_, i) => i)}>
								{(door) => {
									const doorPos = createMemo(() =>
										getDoorPosition(pos().x, pos().y, 60, door),
									);
									return (
										<circle
											cx={doorPos().x}
											cy={doorPos().y}
											r="4"
											class={styles.doorMarker}
										/>
									);
								}}
							</For>
						);
					}}
				</For>

				{/* 3. Draw passages */}
				<For each={connections()}>
					{(conn) => {
						if (
							conn.from.room === conn.to.room &&
							conn.from.door === conn.to.door
						) {
							// Same door self-loop: draw a curved loop
							const angle = (Math.PI / 3) * conn.from.door;
							const loopRadius = 25;

							// Create a circular arc extending outward from the door
							const startX = conn.from.x;
							const startY = conn.from.y;

							// Control points for the loop curve
							const offsetX = Math.cos(angle) * loopRadius;
							const offsetY = Math.sin(angle) * loopRadius;

							// Perpendicular direction for curve width
							const perpAngle = angle + Math.PI / 2;
							const perpX = Math.cos(perpAngle) * loopRadius * 0.7;
							const perpY = Math.sin(perpAngle) * loopRadius * 0.7;

							const cp1X = startX + offsetX + perpX;
							const cp1Y = startY + offsetY + perpY;
							const cp2X = startX + offsetX - perpX;
							const cp2Y = startY + offsetY - perpY;

							const pathData = `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${startX} ${startY}`;

							return (
								<path d={pathData} fill="none" class={styles.connection} />
							);
						}
						// Regular connection or different-door self-loop
						return (
							<line
								x1={conn.from.x}
								y1={conn.from.y}
								x2={conn.to.x}
								y2={conn.to.y}
								class={styles.connection}
							/>
						);
					}}
				</For>

				{/* 4. Draw door numbers (on top) */}
				<For each={props.building.rooms}>
					{(room) => {
						const pos = createMemo(() => roomPositions().get(room.id)!);
						return (
							<For each={Array.from({length: 6}, (_, i) => i)}>
								{(door) => {
									// Position label slightly outside the hexagon corner
									const labelPos = createMemo(() =>
										getDoorPosition(pos().x, pos().y, 75, door),
									);
									return (
										<text
											x={labelPos().x}
											y={labelPos().y}
											class={styles.doorLabel}
										>
											{door}
										</text>
									);
								}}
							</For>
						);
					}}
				</For>
			</svg>
		</div>
	);
};

const Simulator: Component = () => {
	const [problemSize, setProblemSize] = createSignal<number>(3);
	const [seed, setSeed] = createSignal<number>(12345);
	const [routePlan, setRoutePlan] = createSignal<string>('');
	const [explorationResults, setExplorationResults] = createSignal<number[][]>(
		[],
	);

	const building = createMemo(() => generateBuilding(problemSize(), seed()));

	const handleExplore = () => {
		const plans = routePlan()
			.split(',')
			.map((plan) => plan.trim())
			.filter((plan) => plan.length > 0);
		const results = plans.map((plan) => simulateExploration(building(), plan));
		setExplorationResults(results);
	};

	const isValidRoutePlan = (plan: string): boolean => {
		return /^[0-5]*$/.test(plan.trim());
	};

	const maxRouteLength = () => problemSize() * 18;

	return (
		<div class={styles.container}>
			<h1>図書館シミュレーター</h1>

			<div class={styles.controls}>
				<div class={styles.control}>
					<label for="problemSize">問題サイズ:</label>
					<select
						id="problemSize"
						value={problemSize()}
						onChange={(e) =>
							setProblemSize(Number.parseInt(e.currentTarget.value, 10))
						}
					>
						<option value={3}>probatio (3部屋)</option>
						<option value={6}>primus (6部屋)</option>
						<option value={12}>secundus (12部屋)</option>
						<option value={18}>tertius (18部屋)</option>
						<option value={24}>quartus (24部屋)</option>
						<option value={30}>quintus (30部屋)</option>
					</select>
				</div>

				<div class={styles.control}>
					<label for="seed">シード値:</label>
					<input
						type="number"
						id="seed"
						value={seed()}
						onChange={(e) =>
							setSeed(Number.parseInt(e.currentTarget.value, 10) || 12345)
						}
					/>
				</div>

				<div class={styles.control}>
					<label for="routePlan">
						ルートプラン (最大{maxRouteLength()}文字、カンマ区切りで複数指定可):
					</label>
					<textarea
						id="routePlan"
						value={routePlan()}
						onChange={(e) => setRoutePlan(e.currentTarget.value)}
						placeholder="例: 012345, 543210"
						class={isValidRoutePlan(routePlan()) ? '' : styles.invalid}
					/>
					<small>
						0-5の数字のみ使用してください。各プランは{maxRouteLength()}
						文字以下にしてください。
					</small>
				</div>

				<button
					type="button"
					onClick={handleExplore}
					disabled={!isValidRoutePlan(routePlan()) || routePlan().trim() === ''}
				>
					探索実行
				</button>
			</div>

			<div class={styles.results}>
				<h2>建物構造</h2>
				<div class={styles.buildingInfo}>
					<p>
						開始部屋: {building().startingRoom} (ラベル:{' '}
						{building().rooms[building().startingRoom].label})
					</p>
					<p>総部屋数: {building().rooms.length}</p>
				</div>

				<BuildingVisualization
					building={building()}
					startingRoom={building().startingRoom}
				/>

				<div class={styles.rooms}>
					<h3>部屋一覧</h3>
					<For each={building().rooms}>
						{(room) => (
							<div class={styles.roomDetail}>
								<h4>
									部屋 {room.id} (ラベル: {room.label})
								</h4>
								<div class={styles.doors}>
									<For each={room.doors}>
										{(doorConnection, index) => (
											<span class={styles.door}>
												ドア{index()}: 部屋{doorConnection.toRoom}のドア
												{doorConnection.toDoor}
											</span>
										)}
									</For>
								</div>
							</div>
						)}
					</For>
				</div>

				{explorationResults().length > 0 && (
					<div class={styles.explorationResults}>
						<h3>探索結果</h3>
						<For each={explorationResults()}>
							{(result, index) => (
								<div class={styles.result}>
									<h4>
										プラン {index() + 1}: "
										{routePlan().split(',')[index()]?.trim()}"
									</h4>
									<p>観察されたラベル: [{result.join(', ')}]</p>
								</div>
							)}
						</For>
					</div>
				)}
			</div>
		</div>
	);
};

export default Simulator;
