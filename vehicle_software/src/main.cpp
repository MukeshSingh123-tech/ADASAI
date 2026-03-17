/**
 * @file main.cpp
 * @brief Entry point for the ADAS Vehicle Software simulation.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  SYSTEM ARCHITECTURE OVERVIEW                                      │
 * │                                                                    │
 * │  This executable simulates an Adaptive AUTOSAR ECU running a       │
 * │  lane departure warning system with blockchain forensic logging.   │
 * │                                                                    │
 * │  ┌─────────────────────────────────────────────┐                   │
 * │  │          Execution Manager (Phase 1)         │                  │
 * │  │  ┌───────────────┐  ┌──────────────────┐    │                  │
 * │  │  │  Perception   │→→│   Decision       │    │                  │
 * │  │  │  Service      │  │   Service        │    │                  │
 * │  │  │  (Phase 2)    │  │   (Phase 3)      │    │                  │
 * │  │  │  OpenCV +     │  │   ZMQ PUB +      │    │                  │
 * │  │  │  AI Model     │  │   CryptoModule   │    │                  │
 * │  │  └───────────────┘  └──────┬───────────┘    │                  │
 * │  └────────────────────────────┼────────────────┘                   │
 * │                               │ tcp://127.0.0.1:5555               │
 * │                               ▼                                    │
 * │                     Python Web3Bridge (Phase 5)                    │
 * │                               │                                    │
 * │                               ▼                                    │
 * │                     Hyperledger Besu (Phase 5)                     │
 * │                     ForensicLogger.sol                             │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * Usage:
 *   ./adas_vehicle <path_to_lane_video.mp4>
 *
 * Prerequisites:
 *   - A dashcam / lane video file (e.g., data/lane_video.mp4)
 *   - Optionally, start the Python ZMQ subscriber first:
 *       cd blockchain/python && python web3_bridge.py
 *
 * @author  Mukesh Singh
 * @date    2026-03-10
 */

#include "ExecutionManager.h"

#include <iostream>
#include <string>

int main(int argc, char *argv[]) {
  std::cout << "\n"
            << "╔══════════════════════════════════════════════════════════╗\n"
            << "║  ADAS Vehicle Software — Blockchain Forensic Logging    ║\n"
            << "║  Secure Adaptive AUTOSAR Architecture v1.0              ║\n"
            << "║  Author: Mukesh Singh                                   ║\n"
            << "╚══════════════════════════════════════════════════════════╝\n"
            << "\n";

  if (argc < 2) {
    std::cerr << "Usage: " << argv[0] << " <video_path>\n"
              << "  e.g.: " << argv[0] << " ../data/lane_video.mp4\n";
    return 1;
  }

  std::string video_path = argv[1];

  adas_vehicle::ExecutionManager manager;
  manager.start(video_path);

  return 0;
}
