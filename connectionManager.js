export class ConnectionManager {
	constructor(buffer) {
		this.port = null;
		this.reader = null;
		this.writer = null;
		this.textDecoder = null;
		this.textEncoder = null;
		this.readableStreamClosed = null;
		this.writableStreamClosed = null;
		this.buffer = buffer;
	}

	// Request and open a serial port
	async open() {
		try {
			this.port = await navigator.serial.requestPort();

			await this.port.open({ baudRate: 9600 });

			this.textDecoder = new TextDecoderStream();
			this.textEncoder = new TextEncoderStream();

			// Set up the streams
			this.readableStreamClosed = this.port.readable.pipeTo(this.textDecoder.writable).catch((err) => console.error("Readable stream error:", err));
			this.writableStreamClosed = this.textEncoder.readable.pipeTo(this.port.writable).catch((err) => console.error("Writable stream error:", err));

			this.reader = this.textDecoder.readable.getReader();
			this.writer = this.textEncoder.writable.getWriter();

			// Start listening for data
			this._readLoop();

			console.info("Serial port opened successfully.");
			return true;
		} catch (error) {
			console.error("Failed to open serial port:", error);
			return false;
		}
	}

	// Read data in a loop and pass to buffer
	async _readLoop() {
		try {
			while (this.reader) {
				const { value, done } = await this.reader.read();
				if (done) {
					console.info("Serial reader closed.");
					break;
				}
				if (value) {
					for (const char of value) {
						this.buffer.append(char, "DATA"); // Use the buffer to process incoming data
					}
				}
			}
		} catch (error) {
			console.error("Error reading from serial port:", error);
		}
	}

	// Write data to the serial port
	async write(data) {
		if (!this.writer) {
			console.error("Cannot write. Ensure the port is open.");
			return false;
		}

		try {
			await this.writer.write(data + "\r");
			console.info(`Sent: ${data}`);
			return true;
		} catch (error) {
			console.error("Failed to send data:", error);
			return false;
		}
	}

	// Close the serial port
	async withTimeout(promise, ms) {
		const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Operation timed out")), ms));
		return Promise.race([promise, timeout]);
	}

	async close() {
		try {
			this.reader.cancel();
			await this.readableStreamClosed.catch(() => {
				/* Ignore the error */
			});

			this.writer.close();
			await this.writableStreamClosed;
			this.textEncoder = null;
			this.textDecoder = null;
			await this.port.close();
		} catch (ex) {
			console.warn("Error closing port:", ex);
		}
	}
}
