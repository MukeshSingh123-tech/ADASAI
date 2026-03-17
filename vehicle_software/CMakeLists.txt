# ===========================================================================
#  CMakeLists.txt — ADAS Vehicle Software (Phases 1-4)
# ===========================================================================
#
#  This build configuration compiles the full vehicle-side ADAS simulation:
#    - PerceptionService  (Phase 2: OpenCV classical CV + AI placeholder)
#    - CryptoModule       (Phase 4: OpenSSL SHA-256 hashing)
#    - DecisionService    (Phase 3: SOA decision logic + ZeroMQ publisher)
#    - ExecutionManager   (Phase 1: AUTOSAR Execution Manager simulation)
#
#  Prerequisites:
#    ┌───────────────────────────────────────────────────────────────────┐
#    │  Ubuntu / Debian:                                                │
#    │    sudo apt-get install -y libopencv-dev libssl-dev              │
#    │                          libzmq3-dev libcppzmq-dev               │
#    │                                                                  │
#    │  Windows (vcpkg):                                                │
#    │    vcpkg install opencv4 openssl cppzmq                          │
#    │                                                                  │
#    │  macOS (Homebrew):                                               │
#    │    brew install opencv openssl zeromq cppzmq                     │
#    └───────────────────────────────────────────────────────────────────┘
#
#  Build:
#    mkdir build && cd build
#    cmake .. [-DCMAKE_TOOLCHAIN_FILE=<vcpkg-root>/scripts/buildsystems/vcpkg.cmake]
#    cmake --build .
#
#  Run:
#    ./adas_vehicle ../data/lane_video.mp4
#
# ===========================================================================

cmake_minimum_required(VERSION 3.16)
project(AdasVehicleSoftware VERSION 1.0.0 LANGUAGES CXX)

# ---------------------------------------------------------------------------
# C++17 Standard — required for:
#   - std::optional     (MessageQueue timed pop)
#   - structured bindings (auto [left_x, right_x] = ...)
#   - std::atomic<bool> (shared shutdown flag)
# ---------------------------------------------------------------------------
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# ---------------------------------------------------------------------------
# External Dependencies
# ---------------------------------------------------------------------------

# OpenCV — computer vision pipeline (Phase 2)
find_package(OpenCV  REQUIRED)

# OpenSSL — SHA-256 cryptographic hashing (Phase 4)
find_package(OpenSSL REQUIRED)

# cppzmq — header-only C++ binding for ZeroMQ (Phase 3/4)
#           This automatically pulls in the underlying libzmq
find_package(cppzmq  REQUIRED)

# Threads — std::thread for SOA service isolation
find_package(Threads REQUIRED)

# ---------------------------------------------------------------------------
# ADAS Vehicle Executable
# ---------------------------------------------------------------------------
#
# Source files are organised by AUTOSAR service:
#   main.cpp             → Entry point (arg parsing)
#   ExecutionManager.cpp → Phase 1: SOA lifecycle management
#   PerceptionService.cpp→ Phase 2: Camera + CV + AI perception
#   DecisionService.cpp  → Phase 3: Departure classification + ZMQ PUB
#   CryptoModule.cpp     → Phase 4: SHA-256 hashing (standalone module)
#
add_executable(adas_vehicle
    src/main.cpp
    src/ExecutionManager.cpp
    src/PerceptionService.cpp
    src/DecisionService.cpp
    src/CryptoModule.cpp
)

# Include directory for all headers
target_include_directories(adas_vehicle PRIVATE include)

# Link all required libraries
target_link_libraries(adas_vehicle PRIVATE
    ${OpenCV_LIBS}          # cv::VideoCapture, cv::Canny, cv::HoughLinesP, etc.
    OpenSSL::Crypto         # EVP_DigestInit_ex, EVP_sha256, etc.
    cppzmq                  # zmq::context_t, zmq::socket_t, zmq::message_t
    Threads::Threads        # std::thread, std::mutex, std::condition_variable
)
