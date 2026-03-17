"""
zmq_subscriber.py
-----------------
ZeroMQ SUB socket that listens for ADAS hashes published by the C++ side.

This is the first half of the Python bridge.  It receives SHA-256 hashes
from ZeroMQ and forwards them to the Web3 bridge for on-chain submission.

Usage:
    python zmq_subscriber.py [--endpoint tcp://localhost:5555]

Press Ctrl+C to stop.
"""

import argparse
import signal
import sys
import time

import zmq


def create_subscriber(endpoint: str = "tcp://localhost:5555",
                      topic: str = "ADAS_HASH") -> tuple:
    """Create and return a ZMQ SUB socket subscribed to the given topic."""
    context = zmq.Context()
    socket = context.socket(zmq.SUB)
    socket.connect(endpoint)
    socket.setsockopt_string(zmq.SUBSCRIBE, topic)
    print(f"[ZMQ-SUB] Connected to {endpoint}, topic='{topic}'")
    return context, socket


def run_subscriber(endpoint: str = "tcp://localhost:5555"):
    """
    Main loop: receive hashes from ZMQ and print them.
    In production, each hash is forwarded to the Web3 bridge.
    """
    context, socket = create_subscriber(endpoint, topic="ADAS_")

    # Graceful shutdown on Ctrl+C
    running = True

    def _signal_handler(sig, frame):
        nonlocal running
        print("\n[ZMQ-SUB] Shutting down...")
        running = False

    signal.signal(signal.SIGINT, _signal_handler)

    received_count = 0
    start_time = time.time()

    print("[ZMQ-SUB] Waiting for messages...\n")

    while running:
        try:
            # Non-blocking poll with 500 ms timeout so we can check `running`
            if socket.poll(500):
                raw_msg = socket.recv_string()

                if raw_msg.startswith("ADAS_HASH "):
                    hex_hash = raw_msg[len("ADAS_HASH "):]
                    received_count += 1
                    elapsed = time.time() - start_time
                    rate = received_count / elapsed if elapsed > 0 else 0

                    print(f"[{received_count:>5}] hash={hex_hash[:16]}...  "
                          f"({rate:.1f} msg/s)")

                elif raw_msg.startswith("ADAS_EVENT "):
                    # Full event: "ADAS_EVENT <json>|<hash>"
                    body = raw_msg[len("ADAS_EVENT "):]
                    parts = body.rsplit("|", 1)
                    if len(parts) == 2:
                        json_payload, hex_hash = parts
                        print(f"  [EVENT] {json_payload}")

        except zmq.ZMQError as e:
            if e.errno == zmq.ETERM:
                break
            raise

    socket.close()
    context.term()
    print(f"[ZMQ-SUB] Done. Received {received_count} messages.")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="ZMQ Subscriber for ADAS blockchain hashes")
    parser.add_argument("--endpoint", default="tcp://localhost:5555",
                        help="ZMQ endpoint to connect to (default: tcp://localhost:5555)")
    args = parser.parse_args()

    run_subscriber(endpoint=args.endpoint)
