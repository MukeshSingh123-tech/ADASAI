/**
 * @file MessageQueue.h
 * @brief Thread-safe message queue simulating SOME/IP SOA middleware.
 *
 * This replaces a real SOME/IP or DDS middleware layer with a lock-free-style
 * concurrent queue for inter-service communication within the ECU.
 */

#ifndef MESSAGE_QUEUE_H
#define MESSAGE_QUEUE_H

#include <queue>
#include <mutex>
#include <condition_variable>
#include <optional>
#include <chrono>

namespace adas_vehicle {

template <typename T>
class MessageQueue {
public:
    /**
     * Push a message into the queue (producer side).
     * Notifies one waiting consumer.
     */
    void push(T item) {
        {
            std::lock_guard<std::mutex> lock(mutex_);
            queue_.push(std::move(item));
        }
        cv_.notify_one();
    }

    /**
     * Pop a message with a timeout.
     * Returns std::nullopt if the timeout expires or shutdown was requested.
     */
    std::optional<T> pop(std::chrono::milliseconds timeout =
                             std::chrono::milliseconds(500)) {
        std::unique_lock<std::mutex> lock(mutex_);
        if (cv_.wait_for(lock, timeout,
                         [this] { return !queue_.empty() || shutdown_; })) {
            if (queue_.empty()) return std::nullopt;   // shutdown with empty queue
            T item = std::move(queue_.front());
            queue_.pop();
            return item;
        }
        return std::nullopt;   // timeout
    }

    /**
     * Signal all waiting consumers to wake up and exit.
     */
    void shutdown() {
        {
            std::lock_guard<std::mutex> lock(mutex_);
            shutdown_ = true;
        }
        cv_.notify_all();
    }

private:
    std::queue<T>           queue_;
    std::mutex              mutex_;
    std::condition_variable cv_;
    bool                    shutdown_ = false;
};

}  // namespace adas_vehicle

#endif  // MESSAGE_QUEUE_H
