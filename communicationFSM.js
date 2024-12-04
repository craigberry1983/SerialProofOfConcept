export class CommunicationFSM {
	static States = {
		DISCONNECTED: 0,
		CONNECTING: 1,
		CONNECTED: 2,
		IDLE: 3,
		SEND: 4,
		RECEIVE: 5,
		PING_SEND: 6,
		PING_RECEIVE: 7,
		TIMEOUT: 8,
		DISCONNECTING: 9,
	};

	constructor(connectionManager) {
		this.connectionManager = connectionManager;
		this.currentState = CommunicationFSM.States.DISCONNECTED;
		this.commandQueue = [];
		this.inactivityTimer = 0;
		this.listeners = {
			onStateChange: [],
			onEndOfLine: [],
			onEndOfResponse: [],
		};

		// Hook up buffer events
		this.connectionManager.buffer.onResponseLine((line) => {
			this._notify("onEndOfLine", line);
		});

		this.connectionManager.buffer.onFullResponse(({ intention, response }) => {
			this._handleFullResponse(intention, response);
		});
	}

	// Register listeners
	onStateChange(callback) {
		this.listeners.onStateChange.push(callback);
	}

	onEndOfLine(callback) {
		this.listeners.onEndOfLine.push(callback);
	}

	onEndOfResponse(callback) {
		this.listeners.onEndOfResponse.push(callback);
	}

	// Notify listeners for a specific event
	_notify(event, data) {
		if (this.listeners[event]) {
			this.listeners[event].forEach((callback) => callback(data));
		}
	}

	isConnected() {
		return this.currentState !== CommunicationFSM.States.DISCONNECTED && this.currentState !== CommunicationFSM.States.DISCONNECTING && this.currentState !== CommunicationFSM.States.CONNECTING;
	}

	// Change the current state and notify listeners
	changeState(newState) {
		this.currentState = newState;
		this._notify("onStateChange", newState);
	}

	// Add a command to the queue
	addCommand(intention, command) {
		this.commandQueue.push({ intention, command });
	}

	// Handle full responses from the buffer
	_handleFullResponse(intention, response) {
		this._notify("onEndOfResponse", { intention, response });

		// Transition back to IDLE after processing the response
		this.changeState(CommunicationFSM.States.IDLE);
	}

	// FSM main update loop
	async update() {
		switch (this.currentState) {
			case CommunicationFSM.States.CONNECTING:
				const connected = await this.connectionManager.open();
				this.changeState(connected ? CommunicationFSM.States.CONNECTED : CommunicationFSM.States.DISCONNECTED);
				break;

			case CommunicationFSM.States.CONNECTED:
				this.changeState(CommunicationFSM.States.IDLE);
				break;

			case CommunicationFSM.States.IDLE:
				if (this.commandQueue.length > 0) {
					this.changeState(CommunicationFSM.States.SEND);
				}
				break;

			case CommunicationFSM.States.SEND:
				const cmd = this.commandQueue.shift();
				if (cmd) {
					//anything except stream cancellation or custom name specification can be converted to uppercase
					//TODO: stop custom names being converted to uppercase
					cmd.command = cmd.command.trim();
					if (cmd.command !== "c") {
						cmd.command = cmd.command.toUpperCase();
					}
					await this.connectionManager.write(cmd.command);
					this.changeState(CommunicationFSM.States.RECEIVE);
				}
				break;

			case CommunicationFSM.States.RECEIVE:
				// Wait for a full response from the buffer
				break;

			case CommunicationFSM.States.PING_SEND:
				await this.connectionManager.write("AT");
				this.changeState(CommunicationFSM.States.PING_RECEIVE);
				break;

			case CommunicationFSM.States.PING_RECEIVE:
				console.info("Waiting for PING response...");
				break;

			case CommunicationFSM.States.TIMEOUT:
				console.error("Timeout occurred.");
				break;

			case CommunicationFSM.States.DISCONNECTING:
				await this.connectionManager.close();
				this.changeState(CommunicationFSM.States.DISCONNECTED);
				break;

			default:
				break;
		}
	}
}
