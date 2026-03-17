/**
 * @file CryptoModule.cpp
 * @brief Phase 4 — OpenSSL EVP SHA-256 Implementation.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  WHY OpenSSL EVP?                                                  │
 * │                                                                    │
 * │  OpenSSL provides two API families for message digests:            │
 * │                                                                    │
 * │  1. Legacy one-shot:  SHA256(data, len, out)                       │
 * │     - Deprecated in OpenSSL 3.0                                    │
 * │     - Will emit compiler warnings on modern toolchains             │
 * │                                                                    │
 * │  2. EVP (Envelope) API:  EVP_DigestInit / Update / Final           │
 * │     - Forward-compatible with OpenSSL 3.x provider model           │
 * │     - Allows algorithm selection at runtime                        │
 * │     - FIPS-compliant when linked against a FIPS provider           │
 * │                                                                    │
 * │  We use the EVP API exclusively for research-grade compliance.     │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * @author  Mukesh Singh
 * @date    2026-03-10
 */

#include "CryptoModule.h"

// OpenSSL EVP headers — the modern high-level digest API
#include <openssl/evp.h>

#include <iomanip>      // std::setfill, std::setw
#include <memory>       // std::unique_ptr (RAII for EVP_MD_CTX)
#include <sstream>      // std::ostringstream
#include <stdexcept>    // std::runtime_error

namespace adas_vehicle {

// ---------------------------------------------------------------------------
//  CryptoModule::sha256 — Deterministic SHA-256 via OpenSSL EVP
// ---------------------------------------------------------------------------
//
//  Complexity: O(n) where n = input.size()
//  Output:     64-character lowercase hex string (256-bit digest)
//
//  RAII:  The EVP_MD_CTX is wrapped in a std::unique_ptr with a custom
//         deleter (EVP_MD_CTX_free) so it is automatically released even
//         if an exception is thrown during the digest computation.
//
std::string CryptoModule::sha256(const std::string& input) {

    // ── Step 1: Create EVP digest context with RAII cleanup ──────────
    //
    //  EVP_MD_CTX_new() allocates an opaque context structure on the heap.
    //  We attach EVP_MD_CTX_free as the custom deleter so the context is
    //  always freed, even on early return or exception.
    //
    std::unique_ptr<EVP_MD_CTX, decltype(&EVP_MD_CTX_free)> ctx(
        EVP_MD_CTX_new(), EVP_MD_CTX_free);

    if (!ctx) {
        throw std::runtime_error(
            "[CryptoModule] FATAL: EVP_MD_CTX_new() returned nullptr — "
            "probable OpenSSL memory allocation failure.");
    }

    // ── Step 2: Initialise the context for SHA-256 ───────────────────
    //
    //  EVP_sha256() returns a pointer to the SHA-256 algorithm descriptor.
    //  The third argument (ENGINE*) is nullptr → use the default provider.
    //
    if (EVP_DigestInit_ex(ctx.get(), EVP_sha256(), nullptr) != 1) {
        throw std::runtime_error(
            "[CryptoModule] EVP_DigestInit_ex failed for SHA-256.");
    }

    // ── Step 3: Feed the input data into the digest ──────────────────
    //
    //  This can be called multiple times for streamed input; here we send
    //  the entire payload in one shot for simplicity.
    //
    if (EVP_DigestUpdate(ctx.get(), input.c_str(), input.size()) != 1) {
        throw std::runtime_error(
            "[CryptoModule] EVP_DigestUpdate failed.");
    }

    // ── Step 4: Finalise the digest — extract the raw 32-byte hash ──
    //
    //  EVP_MAX_MD_SIZE (64 bytes) is large enough for any digest
    //  algorithm supported by OpenSSL.  For SHA-256, hash_len == 32.
    //
    unsigned char hash[EVP_MAX_MD_SIZE];
    unsigned int  hash_len = 0;

    if (EVP_DigestFinal_ex(ctx.get(), hash, &hash_len) != 1) {
        throw std::runtime_error(
            "[CryptoModule] EVP_DigestFinal_ex failed.");
    }

    // ── Step 5: Convert raw bytes → 64-character lowercase hex string ─
    //
    //  Each byte is formatted as a two-digit zero-padded lowercase hex
    //  value.  For SHA-256 (32 bytes), this produces exactly 64 chars.
    //
    std::ostringstream hex;
    hex << std::hex << std::setfill('0');
    for (unsigned int i = 0; i < hash_len; ++i) {
        hex << std::setw(2) << static_cast<int>(hash[i]);
    }

    return hex.str();
}

}  // namespace adas_vehicle
