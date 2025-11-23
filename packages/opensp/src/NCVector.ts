// NCVector is a non-copying version of Vector
// In C++ this was achieved through preprocessor macros
// In TypeScript, Vector already doesn't do unnecessary copies due to reference semantics
// So NCVector is just an alias to Vector

import { Vector } from './Vector';

export { Vector as NCVector };
