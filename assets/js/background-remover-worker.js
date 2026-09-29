import { processBackground } from "./background-remover-core.js";

self.addEventListener("message", event => {
  const { id, buffer, width, height, options } = event.data;
  try {
    const result = processBackground(new Uint8ClampedArray(buffer), width, height, options);
    self.postMessage({
      id,
      buffer: result.data.buffer,
      keyColor: result.keyColor,
      detected: result.detected,
      removedRatio: result.removedRatio
    }, [result.data.buffer]);
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
});
