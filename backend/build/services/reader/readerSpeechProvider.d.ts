import WebSocket from "ws";
import { type ReaderSpeechVoice } from "./readerSpeechConfig";
import type { SpeechAudio } from "./readerSpeechStore";
type SpeechInput = {
    text: string;
    voice: ReaderSpeechVoice;
    userId: string;
};
type SpeechOptions = {
    key: string;
    model: string;
    signal: AbortSignal;
    timeoutMs?: number;
    maxPcmBytes?: number;
};
type Connect = (url: string, options: WebSocket.ClientOptions) => WebSocket;
export declare function readerSpeechWav(pcm: Buffer): Buffer;
/** One bounded, out-of-conversation response; no microphone, tools, or client API key. */
export declare function generateReaderSpeech(input: SpeechInput, options: SpeechOptions, connect?: Connect): Promise<SpeechAudio>;
export {};
