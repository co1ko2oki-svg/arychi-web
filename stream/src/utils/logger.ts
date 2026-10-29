import winston from "winston";
import Transport from "winston-transport";
import { EventEmitter } from "events";

export interface LogEntry {
	id: string;
	timestamp: string;
	level: string;
	message: string;
}

export const logBuffer: LogEntry[] = [];
export const logEmitter = new EventEmitter();

class BufferTransport extends Transport {
	override log(info: winston.Logform.TransformableInfo, callback: () => void): void {
		const rawLevel = typeof info[Symbol.for("level")] === "string"
			? (info[Symbol.for("level")] as string)
			: (typeof info.level === "string" ? info.level.replace(/\u001b\[\d+m/g, "") : "info");
		const rawMessage = typeof info.message === "string"
			? info.message
			: JSON.stringify(info.message);

		const entry: LogEntry = {
			id: Math.random().toString(36).substring(2, 9),
			timestamp: new Date().toISOString(),
			level: rawLevel,
			message: rawMessage
		};
		logBuffer.push(entry);
		if (logBuffer.length > 300) {
			logBuffer.shift();
		}
		logEmitter.emit("log", entry);
		callback();
	}
}

const logFormat = winston.format.combine(
	winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
	winston.format.colorize(),
	winston.format.printf(({ level, message, timestamp }) => {
		return `[${timestamp}] ${level}: ${message}`;
	})
);

const logger = winston.createLogger({
	level: "info",
	format: logFormat,
	transports: [
		new winston.transports.Console(),
		new BufferTransport()
	]
});

export default logger;
