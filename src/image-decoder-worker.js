import { decode as decodeHeic } from "@discourse/heic";
import UTIF from "utif";
import { pick } from "../assets/js/i18n.js";
import converterText from "../assets/js/i18n/image-converter.js";

const copy = pick(converterText);

async function decodeSpecial(buffer, format) {
  if (format === "heic") {
    const image = await decodeHeic(buffer);
    return { width: image.width, height: image.height, data: image.data };
  }
  if (format === "tiff") {
    const ifds = UTIF.decode(buffer);
    if (!ifds.length) throw new Error(copy.tiffEmpty);
    const candidates = [...ifds, ...(ifds[0].subIFD || [])];
    const page = candidates.reduce((largest, item) => {
      const area = (item.t256?.[0] || item.width || 0) * (item.t257?.[0] || item.height || 0);
      const largestArea = (largest.t256?.[0] || largest.width || 0) * (largest.t257?.[0] || largest.height || 0);
      return area > largestArea ? item : largest;
    }, candidates[0]);
    UTIF.decodeImage(buffer, page, ifds);
    return { width: page.width, height: page.height, data: new Uint8ClampedArray(UTIF.toRGBA8(page)) };
  }
  throw new Error(copy.decoderUnsupported(format));
}

self.addEventListener("message", async event => {
  const { id, buffer, format } = event.data;
  try {
    const result = await decodeSpecial(buffer, format);
    self.postMessage({ id, result }, [result.data.buffer]);
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
});
