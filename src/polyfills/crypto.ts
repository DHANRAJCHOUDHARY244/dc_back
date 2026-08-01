import { webcrypto } from "node:crypto";

// MongoDB driver (mongoose 9+) uses Web Crypto for SCRAM auth.
// Node 18 does not expose globalThis.crypto by default.
if (!globalThis.crypto) {
	globalThis.crypto = webcrypto as Crypto;
}
