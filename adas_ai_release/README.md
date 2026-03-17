# ADAS AI Release — LaneNet Lane Detection Model

## Overview

This module contains the **deep learning component** (Phase 2) of the ADAS perception pipeline. It uses a lightweight **LaneNet CNN** (encoder-decoder architecture) trained on the TuSimple dataset for binary lane segmentation.

## Files

| File | Description |
|------|-------------|
| `model.py` | LaneNet CNN architecture (~41K parameters) |
| `inference.py` | Prediction pipeline for frames and videos |
| `offset.py` | Lane offset (metres) and confidence computation |
| `lanenet_today.pth` | Pre-trained model weights |
| `requirements.txt` | Python dependencies (PyTorch, OpenCV, etc.) |

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Run on a video file
python inference.py path/to/lane_video.mp4

# Run with OpenCV preview window
python inference.py path/to/lane_video.mp4 --preview

# Run synthetic test (no video needed)
python inference.py
```

## Integration with Vehicle Software

The AI model output integrates with the C++ PerceptionService via the `calculateLaneDeviation()` function, which simulates calling this CNN model. In a production system, the C++ code would:

1. Pre-process the camera frame to a 256×128 tensor
2. Run ONNX Runtime or TensorRT inference using the exported LaneNet model
3. Call `compute_offset()` logic to get the lateral deviation
4. Feed the result into the DecisionService for departure classification

## Architecture

```
Input: [B, 3, 128, 256] RGB image
  │
  ├─ Conv2d(3→16)  + ReLU       ← Edge detection
  ├─ Conv2d(16→32) + ReLU + Pool ← Pattern extraction
  ├─ Conv2d(32→64) + ReLU       ← Semantic encoding
  │
  ├─ Upsample(×2, bilinear)     ← Spatial recovery
  ├─ Conv2d(64→16) + ReLU       ← Feature refinement
  └─ Conv2d(16→1)  + Sigmoid    ← Binary lane mask

Output: [B, 1, 128, 256] probability mask
```
