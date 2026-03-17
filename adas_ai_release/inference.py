"""
inference.py — AI Lane Detection Inference Pipeline
════════════════════════════════════════════════════

Phase 2 — Runs the trained LaneNet model on individual video frames
to produce lane segmentation masks and lateral offset predictions.

┌─────────────────────────────────────────────────────────────────────┐
│  INFERENCE PIPELINE                                                 │
│                                                                     │
│  Raw Camera Frame (BGR, any resolution)                             │
│       │                                                             │
│       ▼                                                             │
│  Pre-processing:                                                    │
│    1. Resize to 256×128 (model input dimensions)                   │
│    2. Normalise pixel values to [0, 1]                              │
│    3. Convert to PyTorch tensor [1, 3, 128, 256]                   │
│       │                                                             │
│       ▼                                                             │
│  LaneNet CNN Forward Pass (torch.no_grad)                          │
│       │                                                             │
│       ▼                                                             │
│  Post-processing:                                                   │
│    1. Extract binary lane mask                                      │
│    2. Compute lane centre from mask pixels                          │
│    3. Calculate lateral offset (metres)                             │
│    4. Compute detection confidence [0–1]                            │
│       │                                                             │
│       ▼                                                             │
│  Output: {"lane_offset": float, "confidence": float,               │
│           "lane_detected": bool, "mask": np.ndarray}               │
└─────────────────────────────────────────────────────────────────────┘

Usage:
    from inference import predict, predict_video

    # Single frame prediction
    result = predict(frame)

    # Process entire video
    results = predict_video("lane_video.mp4")

@author  Mukesh Singh
@date    2026-03-10
"""

import os
import sys
from typing import Dict, List, Optional

import cv2
import numpy as np
import torch

from model import LaneNet
from offset import compute_offset


# ─────────────────────────────────────────────────────────────────────
#  Model Loading — One-Time Initialisation
# ─────────────────────────────────────────────────────────────────────

# Resolve the path to the pre-trained weights relative to this file
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_WEIGHTS_PATH = os.path.join(_SCRIPT_DIR, "lanenet_today.pth")

# Select computation device (GPU if available, else CPU)
_DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Load the LaneNet model and pre-trained weights
model = LaneNet().to(_DEVICE)
model.load_state_dict(
    torch.load(_WEIGHTS_PATH, map_location=_DEVICE, weights_only=True)
)
model.eval()  # Set to evaluation mode (disables dropout, batchnorm updates)

print(f"[AI MODEL] LaneNet loaded on {_DEVICE} from {_WEIGHTS_PATH}")
print(f"[AI MODEL] Parameters: {sum(p.numel() for p in model.parameters()):,}")


# ─────────────────────────────────────────────────────────────────────
#  Single Frame Prediction
# ─────────────────────────────────────────────────────────────────────

def predict(frame: np.ndarray) -> Dict:
    """
    Run lane detection inference on a single video frame.

    Args:
        frame: Input image as a NumPy array (BGR, any resolution).
               This is the raw output from cv2.VideoCapture.read().

    Returns:
        Dictionary containing:
            - "lane_offset": float — lateral offset in metres
              (negative = left, positive = right)
            - "confidence": float — detection confidence [0, 1]
            - "lane_detected": bool — True if confidence > 0.2
            - "mask": np.ndarray — binary lane mask [128, 256]

    Processing Steps:
        1. Resize the input frame to 256×128 (model's expected input size)
        2. Normalise pixel values from [0, 255] to [0.0, 1.0]
        3. Rearrange axes from HWC (OpenCV) to CHW (PyTorch)
        4. Add batch dimension: [H, W, C] → [1, C, H, W]
        5. Run forward pass through LaneNet (no gradient computation)
        6. Extract the lane mask and compute offset via compute_offset()
    """
    # ── Pre-processing ───────────────────────────────────────────────
    #  OpenCV loads images as BGR with shape (H, W, 3) and dtype uint8.
    #  PyTorch expects RGB tensors with shape (B, 3, H, W) and dtype float32.

    # Resize to model input dimensions (256 wide × 128 tall)
    img = cv2.resize(frame, (256, 128))

    # Normalise to [0, 1] range
    img = img.astype(np.float32) / 255.0

    # Convert HWC → CHW and add batch dimension → [1, 3, 128, 256]
    tensor = torch.tensor(img).permute(2, 0, 1).unsqueeze(0).to(_DEVICE)

    # ── Inference ────────────────────────────────────────────────────
    #  torch.no_grad() disables gradient computation, reducing memory
    #  usage and accelerating inference (no need to build gradient graph).
    with torch.no_grad():
        mask = model(tensor)    # Output: [1, 1, 128, 256], values ∈ [0, 1]

    # ── Post-processing ──────────────────────────────────────────────
    offset, confidence = compute_offset(mask)

    # Convert mask to numpy for optional visualisation
    mask_np = mask.squeeze().cpu().numpy()

    return {
        "lane_offset":   float(offset),
        "confidence":    float(confidence),
        "lane_detected": bool(confidence > 0.2),
        "mask":          mask_np,
    }


# ─────────────────────────────────────────────────────────────────────
#  Video Prediction — Process Entire Video File
# ─────────────────────────────────────────────────────────────────────

def predict_video(video_path: str, max_frames: Optional[int] = None,
                  show_preview: bool = False, output_path: Optional[str] = None) -> List[Dict]:
    """
    Run lane detection on an entire video file.

    Args:
        video_path:   Path to the input video (MP4, AVI, etc.)
        max_frames:   Maximum number of frames to process (None = all)
        show_preview: If True, display the lane mask overlay in a window
        output_path:  If provided, save the annotated video to this path

    Returns:
        List of prediction dictionaries, one per frame.
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"[AI MODEL] ERROR: Cannot open video: {video_path}")
        return []

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    print(f"[AI MODEL] Processing: {video_path}")
    print(f"[AI MODEL] Resolution: {width}×{height} @ {fps:.0f} fps, "
          f"{total} frames")

    results = []
    frame_idx = 0
    writer = None

    if output_path:
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        writer = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
        print(f"[AI MODEL] Writing output video to: {output_path}")

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        if max_frames is not None and frame_idx >= max_frames:
            break

        result = predict(frame)
        results.append(result)

        # Log every 30th frame
        if frame_idx % 30 == 0:
            status = "LANE" if result["lane_detected"] else "NO LANE"
            print(f"[AI MODEL] Frame {frame_idx:>5}/{total}  "
                  f"offset={result['lane_offset']:+.3f}m  "
                  f"conf={result['confidence']:.3f}  [{status}]")

        # Annotated output frame
        blended = frame.copy()
        if result["lane_detected"]:
            mask_resized = cv2.resize(
                (result["mask"] * 255).astype(np.uint8), (width, height))
            overlay = frame.copy()
            overlay[mask_resized > 128] = [0, 255, 0]  # Green lane overlay
            blended = cv2.addWeighted(frame, 0.7, overlay, 0.3, 0)
        
        if writer is not None:
            writer.write(blended)

        # Optional preview window
        if show_preview and result["lane_detected"]:
            cv2.imshow("LaneNet Detection", blended)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

        frame_idx += 1

    cap.release()
    if writer is not None:
        writer.release()
    if show_preview:
        cv2.destroyAllWindows()

    print(f"[AI MODEL] Done. Processed {frame_idx} frames.")

    # Summary statistics
    detected = sum(1 for r in results if r["lane_detected"])
    avg_conf = (sum(r["confidence"] for r in results) / len(results)
                if results else 0)
    avg_offset = (sum(abs(r["lane_offset"]) for r in results) / len(results)
                  if results else 0)
    print(f"[AI MODEL] Detection rate: {detected}/{frame_idx} "
          f"({100*detected/max(frame_idx,1):.1f}%)")
    print(f"[AI MODEL] Avg confidence: {avg_conf:.3f}")
    print(f"[AI MODEL] Avg |offset|:   {avg_offset:.3f}m")

    return results


# ─────────────────────────────────────────────────────────────────────
#  Standalone Execution — Demo / Test
# ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if len(sys.argv) > 1:
        import argparse
        parser = argparse.ArgumentParser(description="LaneNet Video Inference")
        parser.add_argument("video_path", help="Path to input video")
        parser.add_argument("--output", default=None, help="Save annotated video to path")
        parser.add_argument("--preview", action="store_true", help="Show detection preview")
        p_args = parser.parse_args()
        
        # Process a video file
        predict_video(p_args.video_path, show_preview=p_args.preview, output_path=p_args.output)
    else:
        # Demo: create a synthetic test frame
        print("[AI MODEL] No video path provided. Running synthetic test...")
        dummy_frame = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)
        result = predict(dummy_frame)
        print(f"  lane_offset:   {result['lane_offset']:+.4f} m")
        print(f"  confidence:    {result['confidence']:.4f}")
        print(f"  lane_detected: {result['lane_detected']}")
        print(f"  mask shape:    {result['mask'].shape}")
