/**
 * @file PerceptionService.h
 * @brief Phase 2 — Hybrid AI Perception Service (Camera + CNN Placeholder).
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  CLASSICAL COMPUTER VISION PIPELINE                                │
 * │                                                                    │
 * │  Raw Frame → Grayscale → Gaussian Blur → Canny Edge Detection     │
 * │           → ROI Trapezoid Mask → Hough Line Transform             │
 * │           → Lane Centre Computation → Lateral Deviation            │
 * │                                                                    │
 * │  A placeholder CNN validator simulates a deep-learning step        │
 * │  (ONNX / TensorRT) that would exist in a production ADAS ECU.     │
 * │                                                                    │
 * │  The calculateLaneDeviation() function simulates a trained AI      │
 * │  model outputting a lateral deviation value, as would be produced  │
 * │  by a convolutional neural network in a real deployment.           │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * Dependencies:
 *   - OpenCV >= 4.x  (libopencv-dev / opencv via vcpkg)
 *
 * @author  Mukesh Singh
 * @date    2026-03-10
 */

#ifndef PERCEPTION_SERVICE_H
#define PERCEPTION_SERVICE_H

#include "MessageQueue.h"
#include "ServiceTypes.h"

#include <atomic>
#include <opencv2/opencv.hpp>
#include <string>
#include <utility>


namespace adas_vehicle {

/**
 * @class PerceptionService
 * @brief AUTOSAR Adaptive Service responsible for camera-based lane detection.
 *
 * This service runs as an independent SOA component managed by the
 * ExecutionManager.  It reads video frames, applies a classical CV
 * pipeline, and pushes LaneDeviationData messages to the DecisionService
 * via a thread-safe MessageQueue (simulating the SOME/IP middleware).
 */
class PerceptionService {
public:
  /**
   * @param queue    Shared message queue (producer side → DecisionService).
   * @param running  Global shutdown flag shared with ExecutionManager.
   */
  PerceptionService(MessageQueue<LaneDeviationData> &queue,
                    std::atomic<bool> &running);

  /** Main loop — reads video frames and pushes deviation data to queue. */
  void run(const std::string &video_path);

  /**
   * @brief Simulate an AI-based lane deviation calculation.
   *
   * In a production ADAS system this would invoke a trained CNN model
   * (e.g., LaneNet, SCNN, or a custom architecture) via ONNX Runtime
   * or NVIDIA TensorRT to compute the vehicle's lateral offset from
   * the lane centre in real-world units (metres).
   *
   * For this research prototype, the function returns a simulated
   * deviation value in the range [-1.5, +1.5] metres, modulated by
   * a sine wave to emulate natural drifting behaviour.
   *
   * @return Lateral deviation in metres (negative = left, positive = right).
   *         Typical highway lane width is ~3.7 m, so values beyond
   *         ±0.9 m indicate a departure condition.
   */
  float calculateLaneDeviation();

private:
  // ── Classical CV Pipeline Steps ──────────────────────────────────
  cv::Mat applyGrayscale(const cv::Mat &frame);
  cv::Mat applyGaussianBlur(const cv::Mat &gray);
  cv::Mat applyCannyEdge(const cv::Mat &blurred);
  cv::Mat applyROIMask(const cv::Mat &edges, int width, int height);

  // ── Deep Learning Placeholder ────────────────────────────────────
  bool validateLaneWithCNN(const cv::Mat &roi);

  // ── Lane Geometry ────────────────────────────────────────────────
  std::pair<double, double> detectLaneLines(const cv::Mat &masked, int width,
                                            int height);
  double computeDeviation(double lane_center, int frame_width);

  // ── Member State ─────────────────────────────────────────────────
  MessageQueue<LaneDeviationData> &queue_;
  std::atomic<bool> &running_;
  uint64_t ai_frame_counter_ = 0; ///< Frame counter for AI simulation
};

} // namespace adas_vehicle

#endif // PERCEPTION_SERVICE_H
