/**
 * @file DecisionService.cpp
 * @brief Phase 3 + Phase 4 — SOA Decision Service with ZeroMQ Publisher.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  END-TO-END DATA FLOW                                              │
 * │                                                                    │
 * │  PerceptionService                                                 │
 * │       │  LaneDeviationData (via MessageQueue / simulated SOME/IP)  │
 * │       ▼                                                            │
 * │  DecisionService                                                   │
 * │       │  1. Classify departure severity                            │
 * │       │  2. Build JSON payload (handshake format)                  │
 * │       │  3. Hash via CryptoModule (SHA-256)                        │
 * │       │  4. Publish to ZeroMQ                                      │
 * │       ▼                                                            │
 * │  ZMQ PUB (tcp://127.0.0.1:5555)                                   │
 * │       │                                                            │
 * │       ▼                                                            │
 * │  Python Web3Bridge (ZMQ SUB)                                       │
 * │       │  5. Log raw JSON to vehicle_log.txt                        │
 * │       │  6. Submit hash to Hyperledger Besu                        │
 * │       ▼                                                            │
 * │  ForensicLogger Smart Contract (immutable on-chain record)         │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * @author  Mukesh Singh
 * @date    2026-03-10
 */

#include "DecisionService.h"
#include "CryptoModule.h" // SHA-256 hashing (Phase 4)

#include <chrono>
#include <cmath> // std::abs
#include <cstring>
#include <iomanip> // std::fixed, std::setprecision
#include <iostream>
#include <sstream> // std::ostringstream
#include <stdexcept>
#include <thread>

namespace adas_vehicle {

// ───────────────────────────────────────────────────────────────────────
//  Construction — bind the ZMQ PUB socket
// ───────────────────────────────────────────────────────────────────────

DecisionService::DecisionService(MessageQueue<LaneDeviationData> &queue,
                                 std::atomic<bool> &running,
                                 const std::string &zmq_endpoint)
    : queue_(queue), running_(running), zmq_ctx_(1),
      zmq_pub_(zmq_ctx_, zmq::socket_type::pub) {

  // Bind the PUB socket — the Python subscriber will connect() to this.
  zmq_pub_.bind(zmq_endpoint);
  std::cout << "[DECISION] ZMQ PUB bound to " << zmq_endpoint << "\n";

  // Allow subscribers time to connect before we start publishing.
  // This mitigates the ZeroMQ "slow joiner" problem where the first
  // few messages are lost because the SUB socket has not yet completed
  // the TCP handshake with the PUB socket.
  std::this_thread::sleep_for(std::chrono::milliseconds(500));
}

// ───────────────────────────────────────────────────────────────────────
//  Main Processing Loop
// ───────────────────────────────────────────────────────────────────────

void DecisionService::run() {
  std::cout << "[DECISION] Service started — waiting for perception data...\n";

  uint64_t events_published = 0;

  while (running_) {
    // Pop a message from the SOME/IP-simulated queue with 500 ms timeout
    auto msg = queue_.pop(std::chrono::milliseconds(500));
    if (!msg.has_value())
      continue;

    const LaneDeviationData &data = msg.value();

    // ── Step 1: Classify departure severity ─────────────────────
    std::string event_type =
        classifyDeparture(data.deviation_px, data.confidence);

    // Only publish actual departure warnings (not LANE_CENTERING_OK)
    if (event_type == "LANE_CENTERING_OK")
      continue;

    // ── Step 2: Build JSON payload (agreed handshake format) ─────
    //  Exact spec: {"timestamp":<epoch>,"frame":<id>,"event_type":"LANE_DEPARTURE",
    //               "vehicle_id":"ELC23027","driver":"Mukesh Singh",
    //               "confidence":98.5}
    std::string json =
        buildEventJson(data.timestamp, data.frame_number, event_type, data.confidence);

    // ── Step 3: Hash via CryptoModule (SHA-256, Phase 4) ────────
    //  The hash is computed by the standalone CryptoModule to maintain
    //  separation of concerns (cryptography ≠ decision logic).
    std::string hash = CryptoModule::sha256(json);

    // ── Step 4: Publish BOTH JSON and Hash over ZMQ ─────────────
    //  Two topics are sent so the Python backend can:
    //    - ADAS_EVENT: capture the raw JSON for local logging
    //    - ADAS_HASH:  submit the hash to the blockchain
    publishToZmq(json, hash);
    ++events_published;

    std::cout << "[DECISION] ⚠  " << event_type << "  dev=" << data.deviation_px
              << "px"
              << "  conf=" << data.confidence << "  hash=" << hash.substr(0, 16)
              << "..."
              << "  (total=" << events_published << ")\n";
  }

  std::cout << "[DECISION] Shutting down. Published " << events_published
            << " events.\n";
}

// ───────────────────────────────────────────────────────────────────────
//  Event Classification
// ───────────────────────────────────────────────────────────────────────
//
//  Severity levels (per ISO 11270:2014 lane departure warning systems):
//
//    |deviation| ≤ 50 px   →  Normal lane centering (no alert)
//    |deviation| ≤ 120 px  →  Standard departure (LEFT or RIGHT)
//    |deviation| >  120 px →  Critical departure (imminent collision risk)
//
std::string DecisionService::classifyDeparture(double deviation_px,
                                               double confidence) const {
  double abs_dev = std::abs(deviation_px);

  if (abs_dev <= DEPARTURE_THRESHOLD_PX)
    return "LANE_CENTERING_OK";

  if (abs_dev > 120.0)
    return "LANE_DEPARTURE_CRITICAL";

  return (deviation_px < 0) ? "LANE_DEPARTURE_LEFT" : "LANE_DEPARTURE_RIGHT";
}

// ───────────────────────────────────────────────────────────────────────
//  JSON Payload Builder — Exact Handshake Specification
// ───────────────────────────────────────────────────────────────────────
//
//  The payload MUST be a compact single-line JSON string with NO
//  whitespace between keys/values.  This is critical because the
//  SHA-256 hash must be deterministically reproducible:
//
//    - The C++ side hashes this exact string
//    - The Python Auditor re-hashes the same string from vehicle_log.txt
//    - If there is any difference (even a single space), the hashes
//      will not match and the Auditor will flag tampering
//
//  Required format (per user specification):
//    {"timestamp":<epoch>,"event_type":"<type>",
//     "vehicle_id":"ELC23027","driver":"Mukesh Singh",
//     "confidence":<value>}
//
std::string DecisionService::buildEventJson(uint64_t timestamp,
                                            uint64_t frame_number,
                                            const std::string &event_type,
                                            double confidence) const {
  std::ostringstream oss;
  oss << "{\"timestamp\":" << timestamp << ",\"frame\":" << frame_number
      << ",\"event_type\":\"" << event_type << "\""
      << ",\"vehicle_id\":\"ELC23027\""
      << ",\"driver\":\"Mukesh Singh\""
      << ",\"confidence\":" << std::fixed << std::setprecision(1) << confidence
      << "}";
  return oss.str();
}

// ───────────────────────────────────────────────────────────────────────
//  ZMQ Publishing — Dual-Topic for Backend Compatibility
// ───────────────────────────────────────────────────────────────────────
//
//  The C++ publisher sends TWO messages for each departure event:
//
//  Topic 1 — "ADAS_EVENT <json>|<hash>"
//    The Python Web3Bridge captures the JSON portion and writes it to
//    vehicle_log.txt for forensic auditing (Phase 6).
//
//  Topic 2 — "ADAS_HASH <hash>"
//    The Python Web3Bridge extracts the 64-character hex hash and
//    submits it as a bytes32 value to the ForensicLogger smart
//    contract on Hyperledger Besu (Phase 5).
//
void DecisionService::publishToZmq(const std::string &json_payload,
                                   const std::string &hex_hash) {
  // Topic 1: full event  →  "ADAS_EVENT <json>|<hash>"
  {
    std::string msg = "ADAS_EVENT " + json_payload + "|" + hex_hash;
    zmq::message_t zmq_msg(msg.data(), msg.size());
    zmq_pub_.send(zmq_msg, zmq::send_flags::none);
  }

  // Topic 2: hash only   →  "ADAS_HASH <hash>"
  {
    std::string msg = "ADAS_HASH " + hex_hash;
    zmq::message_t zmq_msg(msg.data(), msg.size());
    zmq_pub_.send(zmq_msg, zmq::send_flags::none);
  }
}

} // namespace adas_vehicle
