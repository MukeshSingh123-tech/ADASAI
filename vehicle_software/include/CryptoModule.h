/**
 * @file CryptoModule.h
 * @brief Phase 4 — Standalone Cryptographic Hashing Module (OpenSSL SHA-256).
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  RESEARCH CONTEXT                                                  │
 * │  This module provides a deterministic SHA-256 fingerprint for      │
 * │  every ADAS event payload before it is transmitted over the        │
 * │  asynchronous ZeroMQ channel to the blockchain backend.            │
 * │                                                                    │
 * │  The hash serves as a tamper-evident seal: if any field in the     │
 * │  JSON payload is altered after transmission, the re-computed       │
 * │  hash will differ from the on-chain record, and the Auditor       │
 * │  script (Phase 6) will flag the discrepancy.                      │
 * │                                                                    │
 * │  Implementation uses the OpenSSL 3.x EVP API (not the deprecated  │
 * │  SHA256() one-shot function) to remain forward-compatible.         │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * Dependencies:
 *   - OpenSSL >= 1.1.1  (libssl-dev / openssl via vcpkg)
 *
 * @author  Mukesh Singh
 * @date    2026-03-10
 */

#ifndef CRYPTO_MODULE_H
#define CRYPTO_MODULE_H

#include <string>

namespace adas_vehicle {

/**
 * @class CryptoModule
 * @brief Static utility class providing SHA-256 hashing via OpenSSL EVP.
 *
 * Usage:
 * @code
 *   std::string hash = CryptoModule::sha256(json_payload);
 *   // hash == "a3f1..." (64 lowercase hex characters, 256 bits)
 * @endcode
 *
 * Thread Safety:
 *   The OpenSSL EVP API is thread-safe when each call creates its own
 *   EVP_MD_CTX (as we do here), so multiple threads may call sha256()
 *   concurrently without external synchronisation.
 */
class CryptoModule {
public:
    /**
     * Compute the SHA-256 digest of an arbitrary input string.
     *
     * @param input  Raw data to hash (e.g., a compact JSON payload).
     * @return       Lowercase hex-encoded SHA-256 digest (exactly 64 characters).
     * @throws       std::runtime_error if OpenSSL context allocation fails.
     *
     * Algorithm:
     *   1. Allocate EVP_MD_CTX via EVP_MD_CTX_new() with RAII deleter
     *   2. Initialise the digest context for SHA-256
     *   3. Feed the input bytes into the digest
     *   4. Finalise and extract the 32-byte raw hash
     *   5. Convert to a 64-character lowercase hex string
     */
    static std::string sha256(const std::string& input);

    // Delete constructor — this is a static-only utility class.
    CryptoModule() = delete;
};

}  // namespace adas_vehicle

#endif  // CRYPTO_MODULE_H
