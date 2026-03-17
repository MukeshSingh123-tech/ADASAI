/**
 * @file zmq_pub_demo.cpp
 * @brief Demo: fires 10 hashes/second using dummy ADAS data over ZeroMQ.
 *
 * Build (after cmake):
 *   cmake --build build --target zmq_pub_demo
 *
 * Run:
 *   ./build/zmq_pub_demo
 *
 * The Python subscriber (zmq_subscriber.py) should receive them instantly.
 */

#include "sha256_hasher.h"
#include "zmq_publisher.h"

#include <iostream>
#include <thread>
#include <chrono>
#include <cstdint>
#include <ctime>
#include <string>
#include <vector>

int main() {
    // Warning types from the handshake spec
    const std::vector<std::string> warnings = {
        "LANE_DEPARTURE_LEFT",
        "LANE_DEPARTURE_RIGHT",
        "LANE_CENTERING_OK",
        "LANE_DEPARTURE_CRITICAL"
    };

    const std::vector<double> speeds = {55, 60, 65, 70, 72, 80, 85, 90, 95, 100};

    try {
        adas_blockchain::ZmqPublisher publisher("tcp://*:5555");

        // Give subscribers time to connect (ZMQ slow-joiner problem)
        std::cout << "[DEMO] Waiting 1 second for subscribers to connect...\n";
        std::this_thread::sleep_for(std::chrono::seconds(1));

        std::cout << "[DEMO] Publishing 10 hashes per second. Press Ctrl+C to stop.\n\n";

        uint64_t seq = 0;
        while (true) {
            uint64_t timestamp = static_cast<uint64_t>(std::time(nullptr));
            const std::string& warning = warnings[seq % warnings.size()];
            double speed = speeds[seq % speeds.size()];

            // 1. Build the agreed-upon JSON payload
            std::string json = adas_blockchain::build_adas_json(
                timestamp, warning, speed);

            // 2. Hash it
            std::string hash = adas_blockchain::sha256(json);

            // 3. Publish the hash (and the full event for debugging)
            publisher.publish_hash(hash);
            publisher.publish_event(json, hash);

            std::cout << "[" << seq << "] " << json
                      << "  ->  " << hash.substr(0, 16) << "...\n";

            ++seq;

            // 10 messages per second => sleep 100 ms
            std::this_thread::sleep_for(std::chrono::milliseconds(100));
        }

    } catch (const std::exception& ex) {
        std::cerr << "Error: " << ex.what() << "\n";
        return 1;
    }

    return 0;
}
