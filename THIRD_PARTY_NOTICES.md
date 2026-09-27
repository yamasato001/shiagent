# Third-party notices

## jSquash OxiPNG

PNG lossless optimization uses `@jsquash/oxipng`, distributed under the Apache
License 2.0. Its WebAssembly codec is based on OxiPNG.

https://github.com/jamsinclair/jSquash/tree/main/packages/oxipng

## image-q

Balanced and Smallest color quantization uses `image-q`, distributed under the
MIT License. The bundled algorithms support alpha-aware palette quantization.

https://github.com/ibezkrovnyi/image-quantization/tree/main/packages/image-q

## ONNX Runtime Web

The local AI proof of concept uses ONNX Runtime Web, distributed under the MIT
License. The inference flow is based on Microsoft's `sd-turbo` browser example:

https://github.com/microsoft/onnxruntime-inference-examples/tree/main/js/sd-turbo

## Transformers.js

The CLIP tokenizer is loaded with Hugging Face Transformers.js, distributed
under the Apache License 2.0.

## SD-Turbo ONNX proof-of-concept model

The current model adapter points to `schmuell/sd-turbo-ort-web` on Hugging Face.
The repository identifies the model license as `stabilityai-non-comercial`.
This adapter is for technical validation only and must be replaced or separately
licensed before commercial release.
