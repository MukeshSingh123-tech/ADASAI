"""
train.py — LaneNet Training Script
═══════════════════════════════════

Trains the LaneNet CNN on lane segmentation data.

Usage:
    # Train with default settings
    python train.py --data-dir ./dataset --epochs 20

    # Resume from checkpoint
    python train.py --data-dir ./dataset --resume lanenet_today.pth

    # Quick test run (1 epoch, small batch)
    python train.py --data-dir ./dataset --epochs 1 --batch-size 4 --quick

@author  Mukesh Singh
@date    2026-03-11
"""

import os
import sys
import json
import time
import argparse
from pathlib import Path
from datetime import datetime

import numpy as np
import cv2
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader

from model import LaneNet

# ─────────────────────────────────────────────────────────────────────
#  Dataset — Loads road images + lane masks
# ─────────────────────────────────────────────────────────────────────

class LaneDataset(Dataset):
    """
    Lane segmentation dataset.

    Expected directory structure:
        data-dir/
        ├── images/       # RGB road images (*.jpg / *.png)
        └── masks/        # Binary lane masks (same filenames)

    If no dataset directory is provided (or doesn't exist), the dataset
    generates synthetic training samples for demonstration purposes.
    """

    def __init__(self, data_dir: str = None, img_size=(256, 128), synthetic_count=500):
        self.img_size = img_size
        self.items = []
        self.synthetic = False

        if data_dir and Path(data_dir).exists():
            img_dir = Path(data_dir) / "images"
            mask_dir = Path(data_dir) / "masks"
            if img_dir.exists() and mask_dir.exists():
                for img_path in sorted(img_dir.glob("*.*")):
                    mask_path = mask_dir / img_path.name
                    if mask_path.exists():
                        self.items.append((str(img_path), str(mask_path)))

        if len(self.items) == 0:
            # Generate synthetic data for demonstration
            print(f"[TRAIN] No dataset found. Generating {synthetic_count} synthetic samples...")
            self.synthetic = True
            self.synthetic_count = synthetic_count

    def __len__(self):
        return len(self.items) if not self.synthetic else self.synthetic_count

    def __getitem__(self, idx):
        if self.synthetic:
            return self._generate_synthetic()

        img_path, mask_path = self.items[idx]
        img = cv2.imread(img_path)
        img = cv2.resize(img, self.img_size).astype(np.float32) / 255.0

        mask = cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE)
        mask = cv2.resize(mask, self.img_size).astype(np.float32) / 255.0

        img_tensor = torch.tensor(img).permute(2, 0, 1)       # [3, H, W]
        mask_tensor = torch.tensor(mask).unsqueeze(0)          # [1, H, W]

        return img_tensor, mask_tensor

    def _generate_synthetic(self):
        """Generate a synthetic road image with lane markings."""
        W, H = self.img_size
        # Create dark grey road
        img = np.full((H, W, 3), 60, dtype=np.float32)
        mask = np.zeros((H, W), dtype=np.float32)

        # Draw lane lines
        center = W // 2 + np.random.randint(-30, 30)
        lane_width = np.random.randint(60, 100)

        for y in range(H):
            offset = int((y / H) * np.random.randint(5, 15))
            for dx in [-lane_width // 2, lane_width // 2]:
                x = center + dx + offset
                if 0 <= x < W - 3:
                    img[y, x:x+3, :] = [200, 200, 200]
                    mask[y, x:x+3] = 1.0

        img /= 255.0
        img_tensor = torch.tensor(img).permute(2, 0, 1)
        mask_tensor = torch.tensor(mask).unsqueeze(0)
        return img_tensor, mask_tensor


# ─────────────────────────────────────────────────────────────────────
#  Training Loop
# ─────────────────────────────────────────────────────────────────────

def train(args):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"\n{'='*60}")
    print(f"  LaneNet Training — {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"  Device:     {device}")
    print(f"  Epochs:     {args.epochs}")
    print(f"  Batch Size: {args.batch_size}")
    print(f"  LR:         {args.lr}")
    print(f"  Data Dir:   {args.data_dir or 'Synthetic'}")
    print(f"{'='*60}\n")

    # Model
    model = LaneNet().to(device)
    total_params = sum(p.numel() for p in model.parameters())
    print(f"[TRAIN] Model parameters: {total_params:,}")

    # Resume from checkpoint
    if args.resume and Path(args.resume).exists():
        model.load_state_dict(torch.load(args.resume, map_location=device, weights_only=True))
        print(f"[TRAIN] Resumed from {args.resume}")

    # Dataset
    dataset = LaneDataset(args.data_dir)
    dataloader = DataLoader(dataset, batch_size=args.batch_size, shuffle=True, num_workers=0)
    print(f"[TRAIN] Dataset: {len(dataset)} samples, {len(dataloader)} batches/epoch")

    # Loss & Optimizer
    criterion = nn.BCELoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=args.lr)

    # Training log
    training_log = {
        "start_time": datetime.now().isoformat(),
        "device": str(device),
        "epochs": args.epochs,
        "batch_size": args.batch_size,
        "lr": args.lr,
        "total_params": total_params,
        "history": [],
    }

    best_loss = float("inf")

    for epoch in range(1, args.epochs + 1):
        model.train()
        epoch_loss = 0.0
        start_time = time.time()

        for batch_idx, (images, masks) in enumerate(dataloader):
            images = images.to(device)
            masks = masks.to(device)

            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, masks)
            loss.backward()
            optimizer.step()

            epoch_loss += loss.item()

        avg_loss = epoch_loss / len(dataloader)
        elapsed = time.time() - start_time

        training_log["history"].append({
            "epoch": epoch,
            "loss": round(avg_loss, 6),
            "time_seconds": round(elapsed, 1),
        })

        # Save best model
        if avg_loss < best_loss:
            best_loss = avg_loss
            torch.save(model.state_dict(), "lanenet_today.pth")

        print(f"  Epoch {epoch:>3}/{args.epochs}  loss={avg_loss:.6f}  "
              f"time={elapsed:.1f}s  {'★ best' if avg_loss <= best_loss else ''}")

    # Save training log
    training_log["end_time"] = datetime.now().isoformat()
    training_log["best_loss"] = round(best_loss, 6)
    with open("training_log.json", "w") as f:
        json.dump(training_log, f, indent=2)

    print(f"\n{'='*60}")
    print(f"  Training Complete!")
    print(f"  Best Loss: {best_loss:.6f}")
    print(f"  Weights:   lanenet_today.pth")
    print(f"  Log:       training_log.json")
    print(f"{'='*60}\n")


# ─────────────────────────────────────────────────────────────────────
#  CLI
# ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train LaneNet lane detection model")
    parser.add_argument("--data-dir", type=str, default=None,
                        help="Path to dataset (images/ + masks/)")
    parser.add_argument("--epochs", type=int, default=20)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--resume", type=str, default=None,
                        help="Path to checkpoint to resume from")
    parser.add_argument("--quick", action="store_true",
                        help="Quick test run (1 epoch, batch=4)")
    args = parser.parse_args()

    if args.quick:
        args.epochs = 1
        args.batch_size = 4

    train(args)
