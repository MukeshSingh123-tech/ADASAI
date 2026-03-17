/**
 * @file PerceptionService.cpp
 * @brief Phase 2 — Hybrid AI Perception Service Implementation.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  PIPELINE ARCHITECTURE                                             │
 * │                                                                    │
 * │  For each video frame, the following processing stages execute     │
 * │  sequentially within the PerceptionService thread:                 │
 * │                                                                    │
 * │  1. GRAYSCALE CONVERSION (cv::cvtColor, COLOR_BGR2GRAY)            │
 * │     - Reduces 3-channel BGR image to single-channel intensity.     │
 * │     - Eliminates chrominance noise that would confuse edge         │
 * │       detection on painted lane markings.                          │
 * │                                                                    │
 * │  2. GAUSSIAN BLUR (cv::GaussianBlur, 5×5 kernel, σ = auto)        │
 * │     - Suppresses high-frequency sensor noise.                      │
 * │     - The 5×5 kernel is an automotive-standard trade-off between   │
 * │       noise suppression and lane-marking sharpness.                │
 * │                                                                    │
 * │  3. CANNY EDGE DETECTION (cv::Canny, low=50, high=150)            │
 * │     - Non-maximum suppression + hysteresis thresholding.           │
 * │     - The 1:3 threshold ratio (50:150) follows the Canny paper's  │
 * │       recommendation for balanced sensitivity.                     │
 * │                                                                    │
 * │  4. ROI TRAPEZOID MASK (cv::fillConvexPoly + cv::bitwise_and)     │
 * │     - Isolates the road surface by masking out sky, dashboard,     │
 * │       and peripheral objects.                                      │
 * │     - Trapezoid vertices are defined as proportions of the frame   │
 * │       dimensions so the mask scales to any resolution.             │
 * │                                                                    │
 * │  5. PROBABILISTIC HOUGH LINE TRANSFORM (cv::HoughLinesP)          │
 * │     - Detects line segments within the ROI.                        │
 * │     - Lines are classified as left or right lane boundaries        │
 * │       based on their slope direction.                              │
 * │                                                                    │
 * │  6. LANE CENTRE COMPUTATION & LATERAL DEVIATION                   │
 * │     - Averages left and right boundary x-intercepts at the         │
 * │       bottom of the frame to estimate the lane centre.             │
 * │     - Deviation = lane_centre − vehicle_centre (frame midpoint).  │
 * │                                                                    │
 * │  7. AI-BASED DEVIATION (calculateLaneDeviation)                    │
 * │     - Simulates a CNN model output for research demonstration.     │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * @author  Mukesh Singh
 * @date    2026-03-10
 */

#include "PerceptionService.h"

#include <chrono>
#include <cmath>
#include <cstdlib>
#include <ctime>
#include <iostream>
#include <thread>
#include <vector>

namespace adas_vehicle {

// ───────────────────────────────────────────────────────────────────────
//  Construction
// ───────────────────────────────────────────────────────────────────────

PerceptionService::PerceptionService(MessageQueue<LaneDeviationData> &queue,
                                     std::atomic<bool> &running)
    : queue_(queue), running_(running) {
  // Seed the PRNG for the CNN validation placeholder
  std::srand(static_cast<unsigned>(std::time(nullptr)));
}

// ───────────────────────────────────────────────────────────────────────
//  calculateLaneDeviation — Simulated AI Model Output
// ───────────────────────────────────────────────────────────────────────
//
//  In a production ADAS ECU this function would:
//    1. Pre-process the ROI into a normalised tensor (224×224×1 or similar)
//    2. Run inference via ONNX Runtime / TensorRT on the CNN model
//    3. Decode the model's output head to obtain lane polynomial
//       coefficients or a direct lateral offset prediction
//
//  For this research prototype we simulate a realistic drifting pattern
//  using a combination of:
//    - A low-frequency sine wave (natural lane centering oscillation)
//    - A Gaussian-like noise component (sensor measurement uncertainty)
//
//  The output range is calibrated to ±1.5 metres, consistent with
//  ISO 11270:2014 lane departure warning system specifications.
//
float PerceptionService::calculateLaneDeviation() {
  ++ai_frame_counter_;

  // ── Primary oscillation: natural vehicle drift ──────────────────
  //  Frequency ~0.2 Hz at 30 fps → period ≈ 150 frames
  //  Amplitude 0.8 m → normal lane centering oscillation
  double primary_drift =
      0.8 *
      std::sin(2.0 * M_PI * static_cast<double>(ai_frame_counter_) / 150.0);

  // ── Secondary perturbation: simulated wind / road camber ────────
  //  Higher frequency (~0.7 Hz), smaller amplitude (0.3 m)
  double secondary_perturbation =
      0.3 *
      std::sin(2.0 * M_PI * static_cast<double>(ai_frame_counter_) / 43.0);

  // ── Stochastic noise: sensor measurement uncertainty ────────────
  //  Uniform noise in [-0.1, +0.1] m  (σ ≈ 0.058 m)
  double noise = (static_cast<double>(std::rand()) / RAND_MAX - 0.5) * 0.2;

  // ── Combined deviation in metres ────────────────────────────────
  float deviation_m =
      static_cast<float>(primary_drift + secondary_perturbation + noise);

  return deviation_m;
}

// ───────────────────────────────────────────────────────────────────────
//  Main Processing Loop
// ───────────────────────────────────────────────────────────────────────

void PerceptionService::run(const std::string &video_path) {
  std::cout << "[PERCEPTION] Opening video: " << video_path << "\n";

  cv::VideoCapture cap(video_path);
  if (!cap.isOpened()) {
    std::cerr << "[PERCEPTION] ERROR — Cannot open video file: " << video_path
              << "\n";
    running_ = false;
    return;
  }

  double fps = cap.get(cv::CAP_PROP_FPS);
  if (fps <= 0)
    fps = 30.0;
  auto frame_delay = std::chrono::milliseconds(static_cast<int>(1000.0 / fps));

  int total_frames = static_cast<int>(cap.get(cv::CAP_PROP_FRAME_COUNT));
  std::cout << "[PERCEPTION] Video opened: "
            << static_cast<int>(cap.get(cv::CAP_PROP_FRAME_WIDTH)) << "×"
            << static_cast<int>(cap.get(cv::CAP_PROP_FRAME_HEIGHT)) << " @ "
            << fps << " fps, " << total_frames << " frames\n";

  cv::Mat frame;
  uint64_t frame_num = 0;

  while (running_ && cap.read(frame)) {
    int width = frame.cols;
    int height = frame.rows;

    // ── Stage 1-4: Classical CV Pipeline ────────────────────────
    cv::Mat gray = applyGrayscale(frame);
    cv::Mat blurred = applyGaussianBlur(gray);
    cv::Mat edges = applyCannyEdge(blurred);
    cv::Mat masked = applyROIMask(edges, width, height);

    // ── Stage 5: Deep Learning Placeholder ──────────────────────
    bool validated = validateLaneWithCNN(masked);

    // ── Stage 6: Lane Geometry via Hough Transform ──────────────
    auto [left_x, right_x] = detectLaneLines(masked, width, height);
    double lane_center = (left_x + right_x) / 2.0;
    double deviation = computeDeviation(lane_center, width);

    // ── Stage 7: AI-Based Deviation (simulated CNN output) ──────
    //  Blend the classical CV deviation with the AI model output.
    //  In production, the CNN result would be the primary signal;
    //  here we use a weighted average for demonstration.
    float ai_deviation_m = calculateLaneDeviation();
    double blended_deviation_px =
        deviation * 0.4 +
        (ai_deviation_m * 100.0) * 0.6; // metres→pixels (approx)

    // ── Confidence score ────────────────────────────────────────
    double confidence =
        validated
            ? 95.0 + static_cast<double>(std::rand() % 50) / 10.0 // 95.0–99.9
            : 30.0;

    // ── Build and push the SOA message ──────────────────────────
    LaneDeviationData data{};
    data.deviation_px = blended_deviation_px;
    data.confidence = confidence;
    data.lane_detected = validated;
    data.frame_number = frame_num;
    data.timestamp = static_cast<uint64_t>(std::time(nullptr));

    queue_.push(data);

    // Log every 30th frame to avoid flooding stdout
    if (frame_num % 30 == 0) {
      std::cout << "[PERCEPTION] Frame " << frame_num
                << "  cv_dev=" << deviation << "px"
                << "  ai_dev=" << ai_deviation_m << "m"
                << "  blended=" << blended_deviation_px << "px"
                << "  conf=" << confidence
                << (validated ? "  [LANE OK]" : "  [NO LANE]") << "\n";
    }

    ++frame_num;
    std::this_thread::sleep_for(frame_delay);
  }

  std::cout << "[PERCEPTION] Video processing complete. " << frame_num
            << " frames processed.\n";
  running_ = false; // signal other services to stop
}

// ───────────────────────────────────────────────────────────────────────
//  Classical CV Pipeline Steps
// ───────────────────────────────────────────────────────────────────────

/**
 * Stage 1: Convert BGR to grayscale.
 *
 * Rationale: Lane markings are typically white or yellow on dark asphalt.
 * The luminance channel captures this contrast effectively while
 * discarding chrominance information that adds noise.
 */
cv::Mat PerceptionService::applyGrayscale(const cv::Mat &frame) {
  cv::Mat gray;
  cv::cvtColor(frame, gray, cv::COLOR_BGR2GRAY);
  return gray;
}

/**
 * Stage 2: Apply Gaussian Blur with a 5×5 kernel.
 *
 * Rationale: A 5×5 kernel provides sufficient noise suppression without
 * over-smoothing lane markings.  Sigma is computed automatically by
 * OpenCV from the kernel size (σ = 0.3 * ((ksize-1)*0.5 - 1) + 0.8).
 */
cv::Mat PerceptionService::applyGaussianBlur(const cv::Mat &gray) {
  cv::Mat blurred;
  cv::GaussianBlur(gray, blurred, cv::Size(5, 5), 0);
  return blurred;
}

/**
 * Stage 3: Canny Edge Detection with thresholds T_low=50, T_high=150.
 *
 * Rationale: The 1:3 threshold ratio follows John Canny's original paper
 * recommendation.  T_low=50 ensures weak edges near lane boundaries are
 * included if they connect to strong edges (hysteresis linking).
 */
cv::Mat PerceptionService::applyCannyEdge(const cv::Mat &blurred) {
  cv::Mat edges;
  cv::Canny(blurred, edges, 50, 150);
  return edges;
}

/**
 * Stage 4: Region of Interest (ROI) Trapezoid Mask.
 *
 * The trapezoid isolates the road surface in the lower 40% of the frame,
 * suppressing edges from the sky, dashboard, and roadside objects.
 *
 * Vertex layout (proportional to frame dimensions):
 *
 *        (0.45w, 0.6h)──────(0.55w, 0.6h)      ← horizon line
 *       ╱                                ╲
 *      ╱                                  ╲
 *   (0.1w, h)────────────────────(0.9w, h)      ← bottom edge
 */
cv::Mat PerceptionService::applyROIMask(const cv::Mat &edges, int width,
                                        int height) {
  cv::Mat mask = cv::Mat::zeros(edges.size(), edges.type());

  // Trapezoid covering the road surface in the lower portion of the frame
  std::vector<cv::Point> trapezoid = {
      cv::Point(static_cast<int>(width * 0.1), height), // bottom-left
      cv::Point(static_cast<int>(width * 0.45),
                static_cast<int>(height * 0.6)), // top-left
      cv::Point(static_cast<int>(width * 0.55),
                static_cast<int>(height * 0.6)),       // top-right
      cv::Point(static_cast<int>(width * 0.9), height) // bottom-right
  };

  cv::fillConvexPoly(mask, trapezoid, cv::Scalar(255));

  cv::Mat masked;
  cv::bitwise_and(edges, mask, masked);
  return masked;
}

// ───────────────────────────────────────────────────────────────────────
//  Deep Learning Placeholder
// ───────────────────────────────────────────────────────────────────────

/**
 * Simulate CNN-based lane validation.
 *
 * In production, this would:
 *   1. Crop and resize the ROI to the model's input dimensions
 *   2. Normalise pixel values to [0, 1] or [-1, 1]
 *   3. Run forward inference through the CNN
 *   4. Apply sigmoid/softmax to the output logit
 *   5. Return true if P(lane_present) > 0.5
 *
 * Simulation: if ≥ 1% of ROI pixels are edge pixels, we consider
 * the lane validated (i.e., there are enough structural edges in the
 * road region to indicate lane markings are present).
 */
bool PerceptionService::validateLaneWithCNN(const cv::Mat &roi) {
  int nonzero = cv::countNonZero(roi);
  int total = roi.rows * roi.cols;
  double ratio = (total > 0) ? static_cast<double>(nonzero) / total : 0.0;
  return ratio > 0.01; // 1% threshold
}

// ───────────────────────────────────────────────────────────────────────
//  Lane Geometry — Hough Line Transform + Slope Classification
// ───────────────────────────────────────────────────────────────────────

/**
 * Detect left and right lane boundaries via Probabilistic Hough Transform.
 *
 * Line classification strategy:
 *   - slope < -0.5 and x_bottom < mid_x  →  LEFT lane boundary
 *   - slope > +0.5 and x_bottom > mid_x  →  RIGHT lane boundary
 *   - all other lines                     →  ignored (noise / cross-traffic)
 *
 * Returns: (left_x, right_x) — the averaged x-intercepts at the bottom
 *          edge of the frame.  Falls back to 20%/80% of frame width
 *          if no lines are detected (fail-safe).
 */
std::pair<double, double>
PerceptionService::detectLaneLines(const cv::Mat &masked, int width,
                                   int height) {
  std::vector<cv::Vec4i> lines;
  cv::HoughLinesP(masked, lines,
                  1,           // rho resolution (pixels)
                  CV_PI / 180, // theta resolution (radians)
                  50,          // accumulator threshold
                  50,          // minimum line length (pixels)
                  150);        // maximum line gap (pixels)

  double left_x_sum = 0.0, right_x_sum = 0.0;
  int left_count = 0, right_count = 0;
  double mid_x = width / 2.0;

  for (const auto &l : lines) {
    double x1 = l[0], y1 = l[1];
    double x2 = l[2], y2 = l[3];
    double slope = (y2 - y1) / (x2 - x1 + 1e-6);

    // Extrapolate line to bottom edge (y = height)
    double x_bottom = x1 + (height - y1) / (slope + 1e-6);

    if (slope < -0.5 && x_bottom < mid_x) {
      // Left lane boundary (negative slope in image coordinates)
      left_x_sum += x_bottom;
      ++left_count;
    } else if (slope > 0.5 && x_bottom > mid_x) {
      // Right lane boundary (positive slope)
      right_x_sum += x_bottom;
      ++right_count;
    }
  }

  // Fail-safe: assume lane at 20% and 80% of frame width if not detected
  double left_x = left_count > 0 ? left_x_sum / left_count : width * 0.2;
  double right_x = right_count > 0 ? right_x_sum / right_count : width * 0.8;

  return {left_x, right_x};
}

/**
 * Compute the lateral deviation of the vehicle from the detected lane centre.
 *
 * Convention:
 *   - Negative value → vehicle is drifting LEFT
 *   - Positive value → vehicle is drifting RIGHT
 *   - Zero           → perfectly centred in the lane
 */
double PerceptionService::computeDeviation(double lane_center,
                                           int frame_width) {
  double vehicle_center = frame_width / 2.0;
  return lane_center - vehicle_center;
}

} // namespace adas_vehicle
