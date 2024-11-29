import { ConnectionManager } from "./connectionManager.js";
import { CommunicationFSM } from "./communicationFSM.js";
import { CommunicationBuffer } from "./communicationBuffer.js";

class Terminal {
	constructor() {
		// Initialize terminal elements
		this.terminalDiv = document.getElementById("terminal");
		this.commandInput = document.getElementById("commandInput");
		this.sendButton = document.getElementById("sendButton");
		this.connectButton = document.getElementById("connectButton");

		// Create communication components
		this.buffer = new CommunicationBuffer();
		this.connectionManager = new ConnectionManager(this.buffer);
		this.communicationFSM = new CommunicationFSM(this.connectionManager);

		// Hook up events
		this._hookUpBufferEvents();
		this._hookUpFSMEvents();
		this._hookUpUIEvents();

		// Set up periodic update calls
		this._startFSMUpdateLoop();
	}

	// Append messages to the terminal
	appendToTerminal(message, type = "info") {
		const messageDiv = document.createElement("div");
		messageDiv.textContent = message;
		messageDiv.style.color = type === "error" ? "red" : type === "sent" ? "lightblue" : "lightgreen";
		this.terminalDiv.appendChild(messageDiv);
		this.terminalDiv.scrollTop = this.terminalDiv.scrollHeight; // Auto-scroll to bottom
	}

	// Hook up events from the CommunicationBuffer
	_hookUpBufferEvents() {
		//this.buffer.onResponseChar((char) => {
		//	this.appendToTerminal(`Char: ${char}`, "info");
		//});

		this.buffer.onResponseLine((line) => {
			this.appendToTerminal(line);
		});

		this.buffer.onFullResponse(({ intention, response }) => {
			console.log(`Full Response [${intention}]: ${response}`);
		});
	}

	// Hook up events from the CommunicationFSM
	_hookUpFSMEvents() {
		this.communicationFSM.onStateChange((state) => {
			const stateName = Object.keys(CommunicationFSM.States)[state];
			switch (stateName) {
				case "CONNECTED":
					this.appendToTerminal("Connected", "info");
					this.connectButton.innerHTML = "Disconnect";
					break;
				case "DISCONNECTED":
					this.connectButton.innerHTML = "Connect";
					break;
				default:
					break;
			}
		});
	}

	// Hook up UI button events
	_hookUpUIEvents() {
		this.connectButton.addEventListener("click", async () => {
			if (this.communicationFSM.isConnected()) {
				this.appendToTerminal("Disconnecting...", "info");
				await this.connectionManager.close();
				this.communicationFSM.changeState(CommunicationFSM.States.DISCONNECTED);
			} else {
				this.appendToTerminal("Attempting to connect...", "info");
				this.communicationFSM.changeState(CommunicationFSM.States.CONNECTING);
				await this.communicationFSM.update(0);
			}
		});

		this.sendButton.addEventListener("click", () => {
			this._sendCommand();
		});

		// Allow Enter key to send commands
		this.commandInput.addEventListener("keydown", (event) => {
			if (event.key === "Enter") {
				this._sendCommand();
			}
		});
	}

	_sendCommand() {
		const command = this.commandInput.value.trim().toUpperCase();
		if (!command) {
			this.appendToTerminal("Please enter a command before sending.", "error");
			return;
		}

		this.communicationFSM.addCommand("COMMAND", command);
		this.appendToTerminal(command, "sent");
		this.commandInput.value = "";
	}

	// FSM update loop
	_startFSMUpdateLoop() {
		setInterval(() => {
			this.communicationFSM.update(); // Call FSM update
		}, 100);
	}
}

// Initialize the terminal once the DOM is fully loaded
document.addEventListener("DOMContentLoaded", () => {
	const terminal = new Terminal();
});
