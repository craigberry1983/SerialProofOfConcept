export class CommunicationBuffer {
	static OK_DELIMITER = "OK "; //note: includes space to avoid false positives with "OKAY"
	static ERROR_DELIMITER = "ERROR";
	static ACCESS_DENIED_DELIMITER = "Access Denied";

	constructor() {
		this.lineBuffer = "";
		this.responseBuffer = "";
		this.listeners = {
			onResponseChar: [],
			onResponseLine: [],
			onFullResponse: [],
		};
	}

	//register event listeners
	onResponseChar(callback) {
		this.listeners.onResponseChar.push(callback);
	}

	onResponseLine(callback) {
		this.listeners.onResponseLine.push(callback);
	}

	onFullResponse(callback) {
		this.listeners.onFullResponse.push(callback);
	}

	// Notify listeners for a specific event
	_notify(event, data) {
		if (this.listeners[event]) {
			this.listeners[event].forEach((callback) => callback(data));
		}
	}

	// Append a character to the buffer
	append(char, intention, echo = true) {
		if (!char) return false;

		//add the char to both the lineBuffer and the responseBuffer
		this.lineBuffer += char;
		this.responseBuffer += char;

		//normalize newlines to \n
		this.lineBuffer = this.lineBuffer.replace(/\r\n|\r|\n/g, "\n");

		//notify listeners about the character
		if (echo) {
			this._notify("onResponseChar", char);
		}

		//if the incoming char is \r, then notify listeners about the full line
		if (char === "\r") {
			if (echo && this.lineBuffer.trim()) {
				this._notify("onResponseLine", this.lineBuffer.trim());
			}
			this.lineBuffer = ""; // Reset the line buffer
		}

		// Check for full response delimiters
		if (this.responseBuffer.endsWith(CommunicationBuffer.OK_DELIMITER) || this.responseBuffer.endsWith(CommunicationBuffer.ERROR_DELIMITER) || this.responseBuffer.endsWith(CommunicationBuffer.ACCESS_DENIED_DELIMITER)) {
			//notify listeners about the last partial line (if any)
			if (echo && this.lineBuffer.trim()) {
				this._notify("onResponseLine", this.lineBuffer.trim());
			}

			//notify listeners about the full response
			this._notify("onFullResponse", {
				intention,
				response: this.responseBuffer.trim(),
			});

			//clear both buffers
			this.lineBuffer = "";
			this.responseBuffer = "";
			return true;
		}

		return false; //indicates no full response seen yet
	}
}
