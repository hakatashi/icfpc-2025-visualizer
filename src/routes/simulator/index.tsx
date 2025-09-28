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
			label: i % 4,
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

interface ExplorationState {
	roomId: number;
	label: number;
	doorTaken?: number;
}

interface ExplorationStep {
	currentState: ExplorationState;
	previousState?: ExplorationState;
	stepIndex: number;
	totalSteps: number;
}

const simulateExplorationSteps = (
	building: Building,
	routePlan: string,
): ExplorationStep[] => {
	const steps: ExplorationStep[] = [];
	let currentRoom = building.startingRoom;

	// Record the starting step
	steps.push({
		currentState: {
			roomId: currentRoom,
			label: building.rooms[currentRoom].label,
		},
		stepIndex: 0,
		totalSteps: routePlan.length + 1,
	});

	// Follow the route plan step by step
	for (let i = 0; i < routePlan.length; i++) {
		const doorChar = routePlan[i];
		const door = Number.parseInt(doorChar, 10);
		if (door < 0 || door > 5) continue; // Skip invalid door numbers

		const previousState = {
			roomId: currentRoom,
			label: building.rooms[currentRoom].label,
			doorTaken: door,
		};

		const doorConnection = building.rooms[currentRoom].doors[door];
		if (doorConnection.toRoom !== -1) {
			currentRoom = doorConnection.toRoom;
		} else {
			// This shouldn't happen since all doors should be connected
			// But if it does, stay in current room
		}

		steps.push({
			currentState: {
				roomId: currentRoom,
				label: building.rooms[currentRoom].label,
			},
			previousState,
			stepIndex: i + 1,
			totalSteps: routePlan.length + 1,
		});
	}

	return steps;
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
	currentStep?: ExplorationStep;
	explorationSteps?: ExplorationStep[];
	currentStepIndex?: number;
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

		if (!event.currentTarget || !(event.currentTarget instanceof SVGElement)) {
			return;
		}

		const svgElement = event.currentTarget.ownerSVGElement;
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
			status: 'normal' | 'traveled' | 'current';
			isDirectional?: boolean; // Only current connections should have direction
		}[] = [];
		const seen = new Set<string>();

		// Create sets for traveled and current passages with direction info
		const traveledPassages = new Set<string>();
		const currentPassage = new Map<
			string,
			{fromRoom: number; toRoom: number; door: number}
		>();

		// If we have exploration steps, mark the passages
		if (props.explorationSteps && props.currentStepIndex !== undefined) {
			for (
				let i = 1;
				i <= props.currentStepIndex && i < props.explorationSteps.length;
				i++
			) {
				const step = props.explorationSteps[i];
				if (step.previousState && step.previousState.doorTaken !== undefined) {
					const fromRoom = step.previousState.roomId;
					const toRoom = step.currentState.roomId;
					const door = step.previousState.doorTaken;

					const passageKey = `${fromRoom}-${door}-${toRoom}`;
					const reverseKey = `${toRoom}-${props.building.rooms[toRoom].doors.findIndex((d) => d.toRoom === fromRoom && d.toDoor === door)}-${fromRoom}`;

					if (i === props.currentStepIndex) {
						currentPassage.set(passageKey, {fromRoom, toRoom, door});
					} else {
						traveledPassages.add(passageKey);
						traveledPassages.add(reverseKey); // Also mark reverse for traveled
					}
				}
			}
		}

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
							? `self-${room.id}-${Math.min(door, targetDoor)}-${Math.max(door, targetDoor)}`
							: room.id < targetRoom
								? `${room.id}-${door}-${targetRoom}-${targetDoor}`
								: `${targetRoom}-${targetDoor}-${room.id}-${door}`;

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

						// Determine passage status and direction
						const passageKey = `${room.id}-${door}-${targetRoom}`;
						const reversePassageKey = `${targetRoom}-${targetDoor}-${room.id}`;
						let status: 'normal' | 'traveled' | 'current' = 'normal';
						let isDirectional = false;
						let actualFrom = fromDoorPos;
						let actualTo = toDoorPos;

						// Check if this is the current passage (with correct direction)
						if (currentPassage.has(passageKey)) {
							status = 'current';
							isDirectional = true;
							// Direction is correct: room -> targetRoom
						} else if (currentPassage.has(reversePassageKey)) {
							status = 'current';
							isDirectional = true;
							// Direction should be reversed: targetRoom -> room
							actualFrom = toDoorPos;
							actualTo = fromDoorPos;
						} else if (
							traveledPassages.has(passageKey) ||
							traveledPassages.has(reversePassageKey)
						) {
							status = 'traveled';
						}

						conns.push({
							from: {room: room.id, door, x: actualFrom.x, y: actualFrom.y},
							to: {
								room: targetRoom,
								door: targetDoor,
								x: actualTo.x,
								y: actualTo.y,
							},
							status,
							isDirectional,
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

				{/* Define arrow markers */}
				<defs>
					<marker
						id="arrowhead-current"
						markerWidth="6"
						markerHeight="6"
						refX="5"
						refY="3"
						orient="auto"
					>
						<polygon points="0 0, 6 3, 0 6" fill="#10b981" />
					</marker>
				</defs>
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

								{/* Room Label */}
								<text x={pos().x} y={pos().y + 5} class={styles.roomId}>
									{room.label}
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
						const connectionClass = () => {
							switch (conn.status) {
								case 'current':
									return styles.connectionCurrent;
								case 'traveled':
									return styles.connectionTraveled;
								default:
									return styles.connection;
							}
						};

						if (
							conn.from.room === conn.to.room &&
							conn.from.door === conn.to.door
						) {
							// Same door self-loop: draw a curved loop
							const angle = (Math.PI / 3) * conn.from.door;
							const loopRadius = 40;

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
								<path d={pathData} fill="none" class={connectionClass()} />
							);
						}
						// Regular connection or different-door self-loop
						const getMarkerEnd = () => {
							// Only show arrows for directional current connections
							if (conn.status === 'current' && conn.isDirectional) {
								return 'url(#arrowhead-current)';
							}
							return undefined;
						};

						return (
							<line
								x1={conn.from.x}
								y1={conn.from.y}
								x2={conn.to.x}
								y2={conn.to.y}
								class={connectionClass()}
								marker-end={getMarkerEnd()}
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
	const [explorationSteps, setExplorationSteps] = createSignal<
		ExplorationStep[]
	>([]);
	const [currentStepIndex, setCurrentStepIndex] = createSignal<number>(0);

	const building = createMemo(() => generateBuilding(problemSize(), seed()));

	const handleLoadPlan = () => {
		const plan = routePlan().trim();
		if (plan.length > 0 && isValidRoutePlan(plan)) {
			const steps = simulateExplorationSteps(building(), plan);
			setExplorationSteps(steps);
			setCurrentStepIndex(0);
		}
	};

	// Navigation functions
	const goToStep = (stepIndex: number) => {
		const steps = explorationSteps();
		if (steps.length > 0) {
			setCurrentStepIndex(Math.max(0, Math.min(stepIndex, steps.length - 1)));
		}
	};

	const goForward = (amount = 1) => {
		goToStep(currentStepIndex() + amount);
	};

	const goBackward = (amount = 1) => {
		goToStep(currentStepIndex() - amount);
	};

	const goToBeginning = () => {
		goToStep(0);
	};

	const goToEnd = () => {
		const steps = explorationSteps();
		goToStep(steps.length - 1);
	};

	const isValidRoutePlan = (plan: string): boolean => {
		return /^[0-5]*$/.test(plan.trim());
	};

	const maxRouteLength = () => problemSize() * 18;

	const generateRandomRoutePlan = () => {
		const length = maxRouteLength();
		let randomPlan = '';
		for (let i = 0; i < length; i++) {
			randomPlan += Math.floor(Math.random() * 6).toString();
		}
		setRoutePlan(randomPlan);
	};

	const currentStep = createMemo(() => {
		const steps = explorationSteps();
		const index = currentStepIndex();
		return steps.length > 0 && index >= 0 && index < steps.length
			? steps[index]
			: undefined;
	});

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
						ルートプラン (最大{maxRouteLength()}文字):
					</label>
					<div class={styles.routePlanInputGroup}>
						<input
							type="text"
							id="routePlan"
							value={routePlan()}
							onChange={(e) => setRoutePlan(e.currentTarget.value)}
							placeholder="例: 012345"
							class={isValidRoutePlan(routePlan()) ? '' : styles.invalid}
						/>
						<button
							type="button"
							onClick={generateRandomRoutePlan}
							class={styles.generateButton}
						>
							ランダム生成
						</button>
					</div>
					<small>
						0-5の数字のみ使用してください。最大{maxRouteLength()}文字まで。
					</small>
				</div>

				<button
					type="button"
					onClick={handleLoadPlan}
					disabled={!isValidRoutePlan(routePlan()) || routePlan().trim() === ''}
				>
					プランを読み込み
				</button>

				{/* Step navigation controls */}
				{explorationSteps().length > 0 && (
					<div class={styles.stepControls}>
						<div class={styles.navigationButtons}>
							<button
								type="button"
								onClick={goToBeginning}
								disabled={currentStepIndex() === 0}
							>
								最初
							</button>
							<button
								type="button"
								onClick={() => goBackward(10)}
								disabled={currentStepIndex() === 0}
							>
								-10
							</button>
							<button
								type="button"
								onClick={() => goBackward(1)}
								disabled={currentStepIndex() === 0}
							>
								-1
							</button>
							<button
								type="button"
								onClick={() => goForward(1)}
								disabled={currentStepIndex() >= explorationSteps().length - 1}
							>
								+1
							</button>
							<button
								type="button"
								onClick={() => goForward(10)}
								disabled={currentStepIndex() >= explorationSteps().length - 1}
							>
								+10
							</button>
							<button
								type="button"
								onClick={goToEnd}
								disabled={currentStepIndex() >= explorationSteps().length - 1}
							>
								最後
							</button>
						</div>
					</div>
				)}
			</div>

			{explorationSteps().length > 0 && (
				<div class={styles.explorationResults}>
					<h3>探索結果</h3>
					<div class={styles.result}>
						<h4>プラン: "{routePlan()}"</h4>
						<p>
							観察されたラベル: [
							{explorationSteps()
								.slice(0, currentStepIndex() + 1)
								.map((step) => step.currentState.label)
								.join(', ')}
							]
						</p>
						<p>
							全ステップでのラベル: [
							{explorationSteps()
								.map((step) => step.currentState.label)
								.join(', ')}
							]
						</p>
					</div>
				</div>
			)}

			<div class={styles.results}>
				<BuildingVisualization
					building={building()}
					startingRoom={building().startingRoom}
					currentStep={currentStep()}
					explorationSteps={explorationSteps()}
					currentStepIndex={currentStepIndex()}
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
			</div>
		</div>
	);
};

export default Simulator;
