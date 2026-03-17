/**
 * @file DecisionService.h
 * @brief Phase 3 — SOA Decision Service with ZeroMQ Publisher.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  SERVICE RESPONSIBILITIES                                          │
 * │                                                                    │
 * │  1. Consume LaneDeviationData from the PerceptionService via the   │
 * │     simulated SOME/IP message queue.                               │
 * │                                                                    │
 * │  2. Apply severity thresholds to classify lane departure events:   │
 * │       |dev| ≤ 50 px  → LANE_CENTERING_OK    (suppressed)          │
 * │       dev  < -50 px  → LANE_DEPARTURE_LEFT                        │
 * │       dev  >  50 px  → LANE_DEPARTURE_RIGHT                       │
 * │       |dev| > 120 px → LANE_DEPARTURE_CRITICAL                    │
 * │                                                                    │
 * │  3. Build a compact JSON payload matching the agreed handshake:    │
 * │     {"timestamp":<epoch>,"event_type":"LANE_DEPARTURE",            │
 * │      "vehicle_id":"ELC23027","driver":"Mukesh Singh",              │
 * │      "confidence":98.5}                                            │
 * │                                                                    │
 * │  4. Hash the JSON via CryptoModule (SHA-256, Phase 4).             │
 * │                                                                    │
 * │  5. Publish over ZeroMQ on two topics:                             │
 * │       "ADAS_EVENT <json>|<sha256>"                                 │
 * │       "ADAS_HASH  <sha256>"                                        │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * Dependencies:
 *   - ZeroMQ / cppzmq  (libzmq3-dev / cppzmq via vcpkg)
 *   - CryptoModule      (OpenSSL SHA-256, see CryptoModule.h)
 *
 * @author  Mukesh Singh
 * @date    2026-03-10
 */

#ifndef DECISION_SERVICE_H
#define DECISION_SERVICE_H

#include "MessageQueue.h"
#include "ServiceTypes.h"

#include <atomic>
#include <string>
#include <zmq.hpp>


namespace adas_vehicle {

/**
 * @class DecisionService
 * @brief AUTOSAR Adaptive Service that classifies lane departures and
 *        publishes forensic event payloads over ZeroMQ.
 *
 * This service acts as the ZeroMQ PUB endpoint (Phase 4 integration
 * handshake) that bridges the vehicle-side C++ software with the
 * off-board Python blockchain backend.
 */
class DecisionService {
public:
  /**
   * @param queue         Shared message queue (consumer side).
   * @param running       Global shutdown flag shared with ExecutionManager.
   * @param zmq_endpoint  ZMQ PUB bind address (default tcp://*:5555).
   */
  DecisionService(MessageQueue<LaneDeviationData> &queue,
                  std::atomic<bool> &running,
                  const std::string &zmq_endpoint = "tcp://*:5555");

  /** Main loop — consumes deviation data and publishes warnings. */
  void run();

private:
  /** Lateral deviation beyond which a lane departure is flagged (pixels). */
  static constexpr double DEPARTURE_THRESHOLD_PX = 50.0;

  /** Determine the warning string from deviation direction & magnitude. */
  std::string classifyDeparture(double deviation_px, double confidence) const;

  /**
   * Build compact single-line JSON matching the agreed handshake spec.
   *
   * Output format (per user specification):
   *   {"timestamp":<epoch>,"event_type":"<type>",
   *    "vehicle_id":"ELC23027","driver":"Mukesh Singh",
   *    "confidence":<value>}
   */
  std::string buildEventJson(uint64_t timestamp, uint64_t frame_number,
                             const std::string &event_type,
                             double confidence) const;

  /** Publish event + hash over ZMQ on dual topics. */
  void publishToZmq(const std::string &json_payload,
                    const std::string &hex_hash);

  // ── Member State ─────────────────────────────────────────────────
  MessageQueue<LaneDeviationData> &queue_;
  std::atomic<bool> &running_;

  zmq::context_t zmq_ctx_;
  zmq::socket_t zmq_pub_;
};

} // namespace adas_vehicle

#endif // DECISION_SERVICE_H
