/**
 * @file ExecutionManager.cpp
 * @brief Phase 1 — Simulated Adaptive AUTOSAR Execution Manager.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  AUTOSAR ADAPTIVE PLATFORM SIMULATION                              │
 * │                                                                    │
 * │  In a real AUTOSAR Adaptive Platform, the Execution Manager is     │
 * │  responsible for:                                                  │
 * │    - Loading and starting application processes (ara::exec)        │
 * │    - Managing process states (Running, Terminating, Terminated)    │
 * │    - Enforcing deterministic startup ordering                      │
 * │    - Handling graceful shutdown via state machine transitions       │
 * │                                                                    │
 * │  This simulation models each AUTOSAR "Adaptive Application" as    │
 * │  an independent C++ thread, communicating via a thread-safe        │
 * │  message queue that simulates the SOME/IP (Scalable Service-      │
 * │  Oriented Middleware over IP) middleware layer.                     │
 * │                                                                    │
 * │  Lifecycle:                                                        │
 * │    1. Register POSIX signal handlers for orderly Ctrl+C shutdown   │
 * │    2. Create the shared MessageQueue (simulated SOME/IP channel)   │
 * │    3. Instantiate PerceptionService (Phase 2 — camera + CV + AI)   │
 * │    4. Instantiate DecisionService (Phase 3 — ZMQ PUB + SHA-256)   │
 * │    5. Launch both services in independent threads (SOA model)      │
 * │    6. Wait for video exhaustion or Ctrl+C, then shutdown cleanly   │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * @author  Mukesh Singh
 * @date    2026-03-10
 */

#include "ExecutionManager.h"
#include "DecisionService.h"
#include "MessageQueue.h"
#include "PerceptionService.h"
#include "ServiceTypes.h"


#include <csignal>
#include <iostream>
#include <thread>

namespace {
// File-scope pointer so the POSIX signal handler can reach the
// running_ flag owned by ExecutionManager.
std::atomic<bool> *g_running_ptr = nullptr;

void signal_handler(int /*signum*/) {
  if (g_running_ptr) {
    g_running_ptr->store(false);
    std::cout
        << "\n[EXEC-MGR] Ctrl+C received — initiating graceful shutdown...\n";
  }
}
} // anonymous namespace

namespace adas_vehicle {

void ExecutionManager::start(const std::string &video_path) {
  std::cout
      << "============================================================\n"
      << "  ADAS Vehicle Software — Adaptive AUTOSAR Simulation\n"
      << "  Execution Manager v1.0\n"
      << "============================================================\n\n";

  // ── Phase 1: Register signal handler for clean shutdown ──────────
  g_running_ptr = &running_;
  std::signal(SIGINT, signal_handler);
  std::signal(SIGTERM, signal_handler);

  // ── Phase 1: Create the simulated SOME/IP message channel ───────
  //  This thread-safe queue decouples the producer (PerceptionService)
  //  from the consumer (DecisionService), simulating the asynchronous
  //  fire-and-forget messaging pattern of SOME/IP.
  MessageQueue<LaneDeviationData> lane_queue;

  std::cout << "[EXEC-MGR] Starting services...\n\n";

  // ── Phase 2: PerceptionService (Camera + CV + CNN placeholder) ──
  PerceptionService perception(lane_queue, running_);

  // ── Phase 3: DecisionService (ZMQ Publisher + CryptoModule) ─────
  //  Default endpoint: tcp://*:5555 (binds on all interfaces)
  DecisionService decision(lane_queue, running_);

  // ── Launch services in separate threads (SOA model) ─────────────
  //  Each service runs as an independent "Adaptive Application" thread.
  //  In production AUTOSAR, these would be separate OS processes
  //  managed by a real Execution Manager (ara::exec::ExecutionClient).
  std::thread perception_thread(
      [&perception, &video_path]() { perception.run(video_path); });

  std::thread decision_thread([&decision]() { decision.run(); });

  std::cout << "[EXEC-MGR] All services running. Press Ctrl+C to stop.\n\n";

  // ── Wait for PerceptionService to finish (video exhaustion) ─────
  perception_thread.join();

  // When perception finishes, signal all services to shut down
  running_ = false;
  lane_queue.shutdown();

  // Wait for DecisionService to finish processing remaining messages
  decision_thread.join();

  std::cout << "\n[EXEC-MGR] All services stopped. ECU shutdown complete.\n";
}

} // namespace adas_vehicle
