/**
 * @file ExecutionManager.h
 * @brief Phase 1 — Simulated Adaptive AUTOSAR Execution Manager.
 *
 * Spawns and manages the lifecycle of independent SOA services
 * (PerceptionService, DecisionService) as separate threads within
 * a single POSIX process, simulating an automotive ECU runtime.
 */

#ifndef EXECUTION_MANAGER_H
#define EXECUTION_MANAGER_H

#include <atomic>
#include <string>

namespace adas_vehicle {

class ExecutionManager {
public:
    ExecutionManager() = default;

    /**
     * Boot the ECU simulation: launch all services in their own threads,
     * wait for orderly shutdown when the video ends or Ctrl+C is pressed.
     *
     * @param video_path  Path to the dashcam video file (lane_video.mp4).
     */
    void start(const std::string& video_path);

private:
    std::atomic<bool> running_{true};
};

}  // namespace adas_vehicle

#endif  // EXECUTION_MANAGER_H
