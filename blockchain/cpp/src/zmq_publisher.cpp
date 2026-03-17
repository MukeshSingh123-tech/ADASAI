/**
 * @file zmq_publisher.cpp
 * @brief Implementation of the ZeroMQ hash publisher.
 */

#include "zmq_publisher.h"
#include <iostream>
#include <stdexcept>

namespace adas_blockchain {

ZmqPublisher::ZmqPublisher(const std::string& endpoint)
    : context_(1), socket_(context_, zmq::socket_type::pub) {
    socket_.bind(endpoint);
    std::cout << "[ZMQ-PUB] Bound to " << endpoint << "\n";
}

void ZmqPublisher::publish_hash(const std::string& hex_hash) {
    std::string message = "ADAS_HASH " + hex_hash;
    zmq::message_t zmq_msg(message.data(), message.size());
    socket_.send(zmq_msg, zmq::send_flags::none);
}

void ZmqPublisher::publish_event(const std::string& json_payload,
                                  const std::string& hex_hash) {
    std::string message = "ADAS_EVENT " + json_payload + "|" + hex_hash;
    zmq::message_t zmq_msg(message.data(), message.size());
    socket_.send(zmq_msg, zmq::send_flags::none);
}

}  // namespace adas_blockchain
