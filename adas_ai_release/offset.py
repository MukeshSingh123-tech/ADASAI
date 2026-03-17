"""
offset.py — Lane Offset and Confidence Computation
═══════════════════════════════════════════════════

Phase 2 — Post-processing module that converts the LaneNet binary
segmentation mask into a meaningful lateral offset (in metres) and
a detection confidence score.

┌─────────────────────────────────────────────────────────────────────┐
│  ALGORITHM                                                          │
│                                                                     │
│  1. Extract the bottom 20% of the mask (near-field road region)    │
│     - This region has the highest spatial accuracy for offset       │
│       estimation because perspective distortion is minimal.         │
│                                                                     │
│  2. Find all pixels with activation > threshold (0.2)              │
│     - These pixels correspond to detected lane marking locations.  │
│                                                                     │
│  3. Compute lane centre as the mean x-coordinate of active pixels  │
│     - Assumes the detected markings are roughly symmetric.         │
│                                                                     │
│  4. Calculate offset = (lane_centre - vehicle_centre) × scale      │
│     - vehicle_centre = image_width / 2 (camera is forward-facing)  │
│     - scale = 0.01 converts pixel offset to approximate metres     │
│       (calibrated for 256px width ≈ 3.7m lane width)              │
│                                                                     │
│  5. Confidence = mean activation in the ROI                         │
│     - Higher mean activation → more lane pixels detected → higher  │
│       certainty that the offset estimate is reliable.               │
│                                                                     │
│  Calibration Note:                                                  │
│    The pixel-to-metre conversion factor (0.01) is approximate.     │
│    In production, this would be calibrated using camera intrinsics  │
│    (focal length, principal point) and the known lane width.        │
│    For this research prototype, 0.01 m/px provides realistic       │
│    offset values in the range [-1.5, +1.5] metres.                 │
└─────────────────────────────────────────────────────────────────────┘

@author  Mukesh Singh
@date    2026-03-10
"""

import numpy as np
import torch
from typing import Tuple


def compute_offset(mask: torch.Tensor,
                   threshold: float = 0.2,
                   roi_fraction: float = 0.2,
                   pixel_to_metre: float = 0.01) -> Tuple[float, float]:
    """
    Compute the vehicle's lateral offset from the lane centre.

    Args:
        mask:           Lane segmentation mask from LaneNet.
                        Shape: [B, 1, H, W] or [1, H, W] or [H, W].
                        Values ∈ [0, 1] (sigmoid probability).

        threshold:      Minimum activation to consider a pixel as "lane".
                        Default: 0.2 (20% probability).

        roi_fraction:   Fraction of the mask height to use from the bottom.
                        Default: 0.2 (bottom 20% = near-field road region).

        pixel_to_metre: Conversion factor from pixel displacement to metres.
                        Default: 0.01 (calibrated for 256px ≈ 3.7m lane).

    Returns:
        Tuple of (offset, confidence):
            - offset:     Lateral displacement in metres.
                          Negative = vehicle is left of centre.
                          Positive = vehicle is right of centre.
                          Zero = no lane detected (fallback).

            - confidence: Detection confidence [0, 1].
                          Mean activation in the ROI.
                          Zero = no lane pixels detected.

    Raises:
        None — returns (0.0, 0.0) gracefully if no lane is detected.
    """
    # ── Convert to NumPy ─────────────────────────────────────────────
    #  Squeeze out batch and channel dimensions to get [H, W]
    if isinstance(mask, torch.Tensor):
        mask_np = mask.squeeze().cpu().numpy()
    else:
        mask_np = np.squeeze(mask)

    h, w = mask_np.shape

    # ── Extract Region of Interest (bottom 20% of mask) ──────────────
    #  The bottom region of the image corresponds to the road surface
    #  closest to the vehicle, where perspective distortion is minimal
    #  and lane marking positions are most reliable for offset estimation.
    roi_start = int(h * (1.0 - roi_fraction))
    region = mask_np[roi_start:, :]

    # ── Find activated lane pixels ───────────────────────────────────
    ys, xs = np.where(region > threshold)

    if len(xs) == 0:
        # No lane pixels detected — return zero offset with zero confidence
        return 0.0, 0.0

    # ── Compute lane centre ──────────────────────────────────────────
    #  The mean x-coordinate of all activated pixels gives an estimate
    #  of where the lane markings are centred in the image.
    lane_center = float(xs.mean())

    # ── Compute vehicle centre ───────────────────────────────────────
    #  Assumes the camera is mounted at the vehicle's centreline,
    #  so the image centre corresponds to the vehicle's position.
    vehicle_center = w / 2.0

    # ── Calculate lateral offset ─────────────────────────────────────
    #  Positive offset = lane centre is to the right of vehicle centre
    #                   = vehicle is drifting LEFT relative to lane
    #  This matches the convention used by DecisionService.cpp
    offset = (lane_center - vehicle_center) * pixel_to_metre

    # ── Compute confidence score ─────────────────────────────────────
    #  Mean activation across the ROI indicates how much of the road
    #  region contains detected lane markings.  Higher values → more
    #  certain that the lane detection is valid.
    confidence = float(region.mean())

    return offset, confidence
