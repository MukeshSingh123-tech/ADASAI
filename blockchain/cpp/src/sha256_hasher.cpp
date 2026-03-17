/**
 * @file sha256_hasher.cpp
 * @brief Implementation of the SHA-256 hashing module using OpenSSL EVP API.
 */

#include "sha256_hasher.h"

#include <openssl/evp.h>
#include <iomanip>
#include <sstream>
#include <stdexcept>
#include <cstring>
#include <memory>

namespace adas_blockchain {

// ---------------------------------------------------------------------------
// SHA-256 using the modern OpenSSL 3.x / 1.1.1 EVP interface
// ---------------------------------------------------------------------------
std::string sha256(const std::string& input) {
    // Create and manage the digest context with a custom deleter
    std::unique_ptr<EVP_MD_CTX, decltype(&EVP_MD_CTX_free)> ctx(
        EVP_MD_CTX_new(), EVP_MD_CTX_free);

    if (!ctx) {
        throw std::runtime_error("Failed to create EVP_MD_CTX");
    }

    if (EVP_DigestInit_ex(ctx.get(), EVP_sha256(), nullptr) != 1) {
        throw std::runtime_error("EVP_DigestInit_ex failed");
    }

    if (EVP_DigestUpdate(ctx.get(),
                         input.c_str(),
                         input.size()) != 1) {
        throw std::runtime_error("EVP_DigestUpdate failed");
    }

    unsigned char hash[EVP_MAX_MD_SIZE];
    unsigned int hash_len = 0;

    if (EVP_DigestFinal_ex(ctx.get(), hash, &hash_len) != 1) {
        throw std::runtime_error("EVP_DigestFinal_ex failed");
    }

    // Convert raw bytes to lowercase hex string
    std::ostringstream hex_stream;
    hex_stream << std::hex << std::setfill('0');
    for (unsigned int i = 0; i < hash_len; ++i) {
        hex_stream << std::setw(2) << static_cast<int>(hash[i]);
    }

    return hex_stream.str();
}

// ---------------------------------------------------------------------------
// Build compact JSON payload matching the agreed handshake format
// ---------------------------------------------------------------------------
std::string build_adas_json(uint64_t timestamp,
                            const std::string& warning,
                            double speed) {
    std::ostringstream oss;
    oss << "{\"timestamp\":" << timestamp
        << ",\"warning\":\"" << warning
        << "\",\"speed\":" << static_cast<int>(speed) << "}";
    return oss.str();
}

}  // namespace adas_blockchain
