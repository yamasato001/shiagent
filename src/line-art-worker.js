import * as ort from "onnxruntime-web/webgpu";
import { AutoTokenizer } from "@huggingface/transformers";
import { buildPrompt, createLatents, tensorToLineArt, toFixedTokenIds } from "../assets/js/line-art-core.js";

const MODEL_BASE = "https://huggingface.co/schmuell/sd-turbo-ort-web/resolve/main";
const MODEL_CACHE = "shiagent-local-ai-sd-turbo-v1";
const MODEL_FILES = [
  { key: "unet", path: "unet/model.onnx", size: 640, dimensions: { batch_size: 1, num_channels: 4, height: 64, width: 64, sequence_length: 77 } },
  { key: "textEncoder", path: "text_encoder/model.onnx", size: 1700, dimensions: { batch_size: 1 } },
  { key: "vaeDecoder", path: "vae_decoder/model.onnx", size: 95, dimensions: { batch_size: 1, num_channels_latent: 4, height_latent: 64, width_latent: 64 } }
];
const TOTAL_SIZE_MB = MODEL_FILES.reduce((sum, file) => sum + file.size, 0);
const SIGMA = 14.6146;
const VAE_SCALE = 0.18215;

ort.env.wasm.numThreads = 1;
ort.env.wasm.wasmPaths = {
  wasm: new URL("/assets/dist/ort-wasm-simd-threaded.jsep.wasm", self.location.origin).href,
  mjs: new URL("/assets/dist/ort-wasm-simd-threaded.jsep.mjs", self.location.origin).href
};

let sessions = null;
let tokenizer = null;
let initializing = null;
let cancelled = false;

function emit(type, detail = {}) { self.postMessage({ type, ...detail }); }
const modelUrl = file => `${MODEL_BASE}/${file.path}`;

async function cacheStatus() {
  const cache = await caches.open(MODEL_CACHE);
  const states = await Promise.all(MODEL_FILES.map(file => cache.match(modelUrl(file))));
  return { installed: states.every(Boolean), cachedSizeMB: MODEL_FILES.reduce((sum, file, index) => sum + (states[index] ? file.size : 0), 0), totalSizeMB: TOTAL_SIZE_MB };
}

async function downloadModels() {
  const cache = await caches.open(MODEL_CACHE);
  let completedMB = 0;
  for (let index = 0; index < MODEL_FILES.length; index += 1) {
    const file = MODEL_FILES[index];
    const url = modelUrl(file);
    const existing = await cache.match(url);
    if (!existing) {
      emit("model-progress", { phase: "download", file: file.key, index, total: MODEL_FILES.length, completedMB, totalSizeMB: TOTAL_SIZE_MB });
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Model download failed (${response.status}): ${file.path}`);
      await cache.put(url, response);
    }
    completedMB += file.size;
    emit("model-progress", { phase: "download", file: file.key, index: index + 1, total: MODEL_FILES.length, completedMB, totalSizeMB: TOTAL_SIZE_MB });
  }
  emit("model-installed", await cacheStatus());
}

async function loadModelBytes(file) {
  const cache = await caches.open(MODEL_CACHE);
  const response = await cache.match(modelUrl(file));
  if (!response) throw new Error("Model files are not installed.");
  return response.arrayBuffer();
}

async function initialize() {
  if (sessions && tokenizer) return;
  if (initializing) return initializing;

  initializing = (async () => {
    const status = await cacheStatus();
    if (!status.installed) throw new Error("Model files are not installed.");
    const options = {
      executionProviders: ["webgpu"],
      enableMemPattern: false,
      enableCpuMemArena: false,
      preferredOutputLocation: { last_hidden_state: "gpu-buffer" },
      extra: { session: { disable_prepacking: "1", use_device_allocator_for_initializers: "1", use_ort_model_bytes_directly: "1", use_ort_model_bytes_for_initializers: "1" } }
    };
    const createdSessions = {};
    let currentFile = null;
    try {
      emit("model-progress", { phase: "initialize", file: "runtime", index: 0, total: MODEL_FILES.length });
      for (let index = 0; index < MODEL_FILES.length; index += 1) {
        currentFile = MODEL_FILES[index];
        emit("model-progress", { phase: "initialize", file: currentFile.key, index, total: MODEL_FILES.length });
        const bytes = await loadModelBytes(currentFile);
        createdSessions[currentFile.key] = await ort.InferenceSession.create(bytes, { ...options, freeDimensionOverrides: currentFile.dimensions });
        emit("model-progress", { phase: "initialize", file: currentFile.key, index: index + 1, total: MODEL_FILES.length });
      }
      const createdTokenizer = await AutoTokenizer.from_pretrained("Xenova/clip-vit-base-patch16");
      createdTokenizer.pad_token_id = 0;
      sessions = createdSessions;
      tokenizer = createdTokenizer;
      emit("model-ready");
    } catch (error) {
      await Promise.allSettled(Object.values(createdSessions).map(session => session.release?.()));
      sessions = null;
      tokenizer = null;
      const reason = error instanceof Error ? error.message : String(error);
      const label = currentFile?.key || "runtime";
      throw new Error(`${label}: ${reason}`);
    }
  })();

  try {
    await initializing;
  } finally {
    initializing = null;
  }
}

function scaleInput(tensor) {
  const divisor = Math.sqrt(SIGMA ** 2 + 1);
  const data = Float32Array.from(tensor.data, value => value / divisor);
  return new ort.Tensor("float32", data, tensor.dims);
}

function schedulerStep(modelOutput, sample) {
  const output = new Float32Array(modelOutput.data.length);
  for (let index = 0; index < output.length; index += 1) {
    const predicted = sample.data[index] - SIGMA * modelOutput.data[index];
    const derivative = (sample.data[index] - predicted) / SIGMA;
    output[index] = (sample.data[index] - derivative * SIGMA) / VAE_SCALE;
  }
  return new ort.Tensor("float32", output, modelOutput.dims);
}

async function imageBlob(tensor, strength) {
  const [, , height, width] = tensor.dims;
  const rgba = tensorToLineArt(tensor.data, width, height, strength);
  const canvas = new OffscreenCanvas(width, height);
  canvas.getContext("2d").putImageData(new ImageData(rgba, width, height), 0, 0);
  return canvas.convertToBlob({ type: "image/png" });
}

async function generateOne(item, style, strength) {
  const fullPrompt = buildPrompt(item.prompt, style);
  const tokens = await tokenizer(fullPrompt, { padding: "max_length", max_length: 77, truncation: true, return_tensor: false });
  const inputIds = toFixedTokenIds(tokens.input_ids, 77, tokenizer.pad_token_id);
  const { last_hidden_state: hiddenState } = await sessions.textEncoder.run({ input_ids: new ort.Tensor("int32", inputIds, [1, 77]) });
  const latentShape = [1, 4, 64, 64];
  const latent = new ort.Tensor("float32", createLatents(latentShape, SIGMA, item.seed), latentShape);
  const { out_sample: predictedNoise } = await sessions.unet.run({
    sample: scaleInput(latent),
    timestep: new ort.Tensor("int64", BigInt64Array.from([999n]), [1]),
    encoder_hidden_states: hiddenState
  });
  const decodedLatents = schedulerStep(predictedNoise, latent);
  const { sample } = await sessions.vaeDecoder.run({ latent_sample: decodedLatents });
  const blob = await imageBlob(sample, strength);
  hiddenState.dispose?.();
  predictedNoise.dispose?.();
  sample.dispose?.();
  return blob;
}

async function generate(items, style, strength) {
  cancelled = false;
  await initialize();
  for (let index = 0; index < items.length; index += 1) {
    if (cancelled) break;
    const item = items[index];
    emit("generation-progress", { id: item.id, index, total: items.length, phase: "generating" });
    try {
      const blob = await generateOne(item, style, strength);
      emit("generation-result", { id: item.id, blob, prompt: item.prompt, seed: item.seed });
    } catch (error) {
      emit("generation-error", { id: item.id, message: error instanceof Error ? error.message : String(error) });
    }
  }
  emit("generation-complete", { cancelled });
}

self.addEventListener("message", async event => {
  const { action } = event.data || {};
  try {
    if (action === "status") emit("model-status", await cacheStatus());
    if (action === "download") await downloadModels();
    if (action === "initialize") await initialize();
    if (action === "generate") await generate(event.data.items, event.data.style, event.data.strength);
    if (action === "cancel") cancelled = true;
    if (action === "delete-model") {
      if (sessions) await Promise.all(Object.values(sessions).map(session => session.release?.()));
      sessions = null;
      tokenizer = null;
      await caches.delete(MODEL_CACHE);
      emit("model-status", await cacheStatus());
    }
  } catch (error) {
    emit("worker-error", { action, message: error instanceof Error ? error.message : String(error) });
  }
});
