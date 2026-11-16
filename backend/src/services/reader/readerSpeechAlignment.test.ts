import { alignReaderSpeech, matchReaderSpeechWords } from "./readerSpeechAlignment";

describe("audiobook word alignment", () => {
  it("maps repeated words and punctuation to exact UTF-16 source ranges", () => {
    const text = "Go, go! 😀 Can't well-known שלום Cafe\u0301.";
    const words = ["Go", "go", "can", "t", "well", "known", "שלום", "Café"]
      .map((word,index) => ({word,start:index,end:index+0.8}));
    const result = matchReaderSpeechWords(text, words, 9)!;
    expect(result.map(word => text.slice(word.startChar, word.endChar))).toEqual(["Go,", "go!", "Can't", "well-known", "שלום", "Cafe\u0301."]);
    expect(result[2]).toMatchObject({startSeconds:2,endSeconds:3.8});
    expect(result[3]).toMatchObject({startSeconds:4,endSeconds:5.8});
    expect(result[1].startChar).toBe(4);
  });
  it.each([
    [], [{word:"Wrong",start:0,end:1}], [{word:"Go",start:0,end:1},{word:"extra",start:1,end:2}],
    [{word:"Go",start:-1,end:1}], [{word:"Go",start:1,end:1}], [{word:"Go",start:0,end:99}],
    [{word:"Go",start:NaN,end:1}], [{word:"Go",start:0,end:Infinity}],
  ].map(words => ({words})))("falls back rather than inventing timings for invalid or mismatched words %j", ({words}) => {
    expect(matchReaderSpeechWords("Go.",words,3)).toBeNull();
  });
  it("rejects merged source words, missing words and reversed timestamps", () => {
    expect(matchReaderSpeechWords("ice cream",[{word:"icecream",start:0,end:1}],2)).toBeNull();
    expect(matchReaderSpeechWords("Go now",[{word:"Go",start:0,end:1}],2)).toBeNull();
    expect(matchReaderSpeechWords("Go now",[{word:"Go",start:1,end:2},{word:"now",start:0,end:1}],3)).toBeNull();
  });
  it("uploads actual audio with word timestamps using only a backend key", async () => {
    const request = jest.fn().mockResolvedValue(new Response(JSON.stringify({words:[{word:"Hello",start:0.1,end:0.8}]})));
    const signal = new AbortController().signal;
    const result = await alignReaderSpeech("Hello.",Buffer.from("wav-bytes"),1,"test-secret",signal,request);
    expect(result).toEqual([{startChar:0,endChar:6,startSeconds:0.1,endSeconds:0.8}]);
    const [url, options] = request.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/audio/transcriptions");
    expect(options.headers.Authorization).toBe("Bearer test-secret");
    expect(options.body.get("model")).toBe("whisper-1");
    expect(options.body.get("response_format")).toBe("verbose_json");
    expect(options.body.get("timestamp_granularities[]")).toBe("word");
    expect(Buffer.from(await options.body.get("file").arrayBuffer()).toString()).toBe("wav-bytes");
  });
  it("returns no timing after provider errors, malformed JSON or text mismatch", async () => {
    for (const response of [new Response("error",{status:429}),new Response("bad json"),new Response(JSON.stringify({words:[{word:"Wrong",start:0,end:1}]}))]) {
      expect(await alignReaderSpeech("Hello",Buffer.alloc(1),2,"test",new AbortController().signal,jest.fn().mockResolvedValue(response))).toBeNull();
    }
  });
  it("cancels upstream requests and bounds a stalled alignment call", async () => {
    const controller = new AbortController();
    let began!: () => void;
    const started = new Promise<void>(resolve => {began=resolve;});
    const request = jest.fn((_url, options) => new Promise<Response>((_resolve,reject) => {
      options.signal.addEventListener("abort",()=>reject(new Error("aborted"))); began();
    }));
    const pending = alignReaderSpeech("Hello",Buffer.alloc(1),2,"test",controller.signal,request as typeof fetch);
    await started; controller.abort(); expect(await pending).toBeNull();
    expect(await alignReaderSpeech("Hello",Buffer.alloc(1),2,"test",new AbortController().signal,request as typeof fetch,2)).toBeNull();
    const never = jest.fn();
    expect(await alignReaderSpeech("Hello",Buffer.alloc(1),2,"test",controller.signal,never)).toBeNull();
    expect(never).not.toHaveBeenCalled();
  });
});
