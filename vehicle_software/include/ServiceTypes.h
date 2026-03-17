/**
 * @file ServiceTypes.h
 * @brief Shared data types exchanged between ADAS SOA services.
 *
 * LaneDeviationData is the message contract between the PerceptionService
 * (producer) and the DecisionService (consumer), transmitted via the
 * simulated SOME/IP message queue.
 */

#ifndef SERVICE_TYPES_H
#define SERVICE_TYPES_H

#include <cstdint>

namespace adas_vehicle {

/**
 * Data produced by PerceptionService for every processed video frame.
 */
struct LaneDeviationData {
    double   deviation_px;    ///< Lateral offset in pixels (negative = left, positive = right)
    double   confidence;      ///< Lane detection confidence [0 – 100]
    bool     lane_detected;   ///< True if at least one lane boundary was found
    uint64_t frame_number;    ///< Sequential frame index
    uint64_t timestamp;       ///< Unix epoch (seconds) when the frame was processed
};

}  // namespace adas_vehicle

#endif  // SERVICE_TYPES_H
