/**
 * @file zmq_publisher.h
 * @brief ZeroMQ PUB socket that broadcasts SHA-256 hashes of ADAS events.
 *
 * The teammate's Decision Service calls `publish_hash()` after computing the
 * SHA-256.  The Python subscriber on the blockchain side picks it up.
 *
 * Dependencies: libzmq, cppzmq (header-only C++ binding)
 */

#ifndef ZMQ_PUBLISHER_H
#define ZMQ_PUBLISHER_H

#include <zmq.hpp>
#include <string>
#include <memory>

namespace adas_blockchain {

class ZmqPublisher {
public:
    /**
     * Construct a publisher bound to the given endpoint.
     * @param endpoint  ZMQ endpoint, e.g. "tcp://*:5555"
     */
    explicit ZmqPublisher(const std::string& endpoint = "tcp://*:5555");

    ~ZmqPublisher() = default;

    // Non-copyable
    ZmqPublisher(const ZmqPublisher&) = delete;
    ZmqPublisher& operator=(const ZmqPublisher&) = delete;

    /**
     * Publish a hash string on the "ADAS_HASH" topic.
     * Message format on the wire:  "ADAS_HASH <64-char-hex-hash>"
     */
    void publish_hash(const std::string& hex_hash);

    /**
     * Publish the full JSON payload along with its hash.
     * Message format:  "ADAS_EVENT <json>|<hash>"
     */
    void publish_event(const std::string& json_payload,
                       const std::string& hex_hash);

private:
    zmq::context_t context_;
    zmq::socket_t  socket_;
};

}  // namespace adas_blockchain

#endif  // ZMQ_PUBLISHER_H
