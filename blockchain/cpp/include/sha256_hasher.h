/**
 * @file sha256_hasher.h
 * @brief Standalone SHA-256 hashing module using OpenSSL.
 *
 * This header is designed to be #included by the teammate's ADAS Decision
 * Service so it can hash JSON payloads before publishing them over ZeroMQ.
 *
 * Dependencies: OpenSSL (libssl-dev / openssl on vcpkg)
 */

#ifndef SHA256_HASHER_H
#define SHA256_HASHER_H

#include <string>
#include <cstdint>

namespace adas_blockchain {

/**
 * Compute the SHA-256 hash of an arbitrary input string.
 *
 * @param input  The raw data to hash (e.g. a JSON payload string).
 * @return       Lowercase hex-encoded SHA-256 digest (64 characters).
 *
 * Usage example:
 * @code
 *   std::string json = R"({"timestamp":1707901200,"warning":"LANE_DEPARTURE_LEFT","speed":65})";
 *   std::string hash = adas_blockchain::sha256(json);
 *   // hash == "a3f1...64-char-hex..."
 * @endcode
 */
std::string sha256(const std::string& input);

/**
 * Helper: build the agreed-upon ADAS JSON payload as a single-line string.
 *
 * @param timestamp  Unix epoch seconds.
 * @param warning    One of LANE_DEPARTURE_LEFT, LANE_DEPARTURE_RIGHT,
 *                   LANE_CENTERING_OK, LANE_DEPARTURE_CRITICAL.
 * @param speed      Vehicle speed in km/h.
 * @return           Compact JSON string (no whitespace).
 */
std::string build_adas_json(uint64_t timestamp,
                            const std::string& warning,
                            double speed);

}  // namespace adas_blockchain

#endif  // SHA256_HASHER_H
