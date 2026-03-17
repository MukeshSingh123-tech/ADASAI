/**
 * @file test_sha256.cpp
 * @brief Quick standalone test for the SHA-256 hashing module.
 *
 * Build:
 *   g++ -std=c++17 -I../include src/sha256_hasher.cpp src/test_sha256.cpp \
 *       -lssl -lcrypto -o test_sha256
 *
 * Run:
 *   ./test_sha256
 */

#include "sha256_hasher.h"
#include <iostream>
#include <cassert>

int main() {
    // ---- Test 1: Known SHA-256 of empty string ----------------------------
    {
        std::string hash = adas_blockchain::sha256("");
        std::string expected =
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
        assert(hash == expected);
        std::cout << "[PASS] SHA-256 of empty string\n";
    }

    // ---- Test 2: Hash from the agreed ADAS payload ------------------------
    {
        std::string json = adas_blockchain::build_adas_json(
            1707901200, "LANE_DEPARTURE_LEFT", 65);
        std::cout << "JSON payload : " << json << "\n";

        std::string hash = adas_blockchain::sha256(json);
        std::cout << "SHA-256 hash : " << hash << "\n";

        assert(hash.size() == 64);  // 256 bits = 64 hex chars
        std::cout << "[PASS] ADAS payload hash is 64 hex chars\n";
    }

    // ---- Test 3: Different inputs produce different hashes ----------------
    {
        std::string h1 = adas_blockchain::sha256(
            adas_blockchain::build_adas_json(1707901200, "LANE_DEPARTURE_LEFT", 65));
        std::string h2 = adas_blockchain::sha256(
            adas_blockchain::build_adas_json(1707901200, "LANE_DEPARTURE_RIGHT", 65));
        assert(h1 != h2);
        std::cout << "[PASS] Different payloads produce different hashes\n";
    }

    // ---- Test 4: Same input always gives the same hash --------------------
    {
        std::string json = adas_blockchain::build_adas_json(
            1707901210, "LANE_CENTERING_OK", 60);
        assert(adas_blockchain::sha256(json) == adas_blockchain::sha256(json));
        std::cout << "[PASS] Deterministic hashing\n";
    }

    std::cout << "\nAll SHA-256 tests passed.\n";
    return 0;
}
