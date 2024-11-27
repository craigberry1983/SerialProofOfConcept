navigator.serial.addEventListener("connect", (e) => {
	// Connect to `e.target` or add it to a list of available ports.
	console.log("connect event:", e.target);
});

navigator.serial.addEventListener("disconnect", (e) => {
	// Remove `e.target` from the list of available ports.
	console.log("disconnect event:", e.target);
});

var port, textEncoder, writableStreamClosed, writer;

const connectButton = document.getElementById("connectButton");
const textInput = document.getElementById("textInput");
const clearButton = document.getElementById("clearBtn");
const sendButton = document.getElementById("sendBtn");
const terminalHistory = document.getElementById("terminalHistory");
var connected = false;

clearButton.addEventListener("click", () => {
	terminalHistory.innerHTML = "";
});

sendButton.addEventListener("click", () => {
	sendSerialLine();
});

connectButton.addEventListener("click", async () => {
	await connectSerial();
});

async function connectSerial() {
	if (!connected) {
		try {
			// Prompt user to select any serial port.
			port = await navigator.serial.requestPort();
			await port.open({ baudRate: 9600 });

			textEncoder = new TextEncoderStream();
			writableStreamClosed = textEncoder.readable.pipeTo(port.writable);

			writer = textEncoder.writable.getWriter();
			listenToPort();
			connected = true;
			connectButton.innerHTML = "Disconnect";
			alert("Connected!");
		} catch {
			alert("Connection Failed");
		}
	} else {
		try {
			//properly clean up streams and resources before closing the port.
			if (writer) {
				writer.releaseLock(); //release the writer lock
				writer = null;
			}
			if (textEncoder) {
				await writableStreamClosed; //wait for the writable stream to finish
				textEncoder = null;
			}

			if (port.readable) {
				port.readable.cancel(); //cancel the readable stream
			}

			await port.close(); //close the port
		} catch (ex) {
			alert(`Disconnect Failed: ${ex}`);
		} finally {
			connected = false;
			connectButton.innerHTML = "Connect";
		}
	}
}

async function listenToPort() {
	const textDecoder = new TextDecoderStream();
	const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
	const reader = textDecoder.readable.getReader();
	// Listen to data coming from the serial device.
	while (true) {
		const { value, done } = await reader.read();
		if (done) {
			// Allow the serial port to be closed later.
			reader.releaseLock();
			break;
		}
		// value is a string.
		appendToTerminal(value);
	}
}

async function sendSerialLine() {
	dataToSend = textInput.value + "\r";
	appendToTerminal(dataToSend, true);
	await writer.write(dataToSend);
}

async function appendToTerminal(data, fromUser = false) {
	var li = document.createElement("p");
	li.textContent = data;
	if (fromUser) {
		li.classList.add("sent");
	}
	terminalHistory.appendChild(li);
	if (terminalHistory.innerHTML.length > 3000) terminalHistory.innerHTML = terminalHistory.innerHTML.slice(terminalHistory.innerHTML.length - 3000);

	//scroll down to bottom of div
	terminalHistory.scrollTop = terminalHistory.scrollHeight;
}
