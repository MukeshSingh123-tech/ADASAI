# ===========================================================================
#  CMakeLists.txt — ADAS Blockchain Integration (C++ side)
# ===========================================================================
#
#  Prerequisites (install via vcpkg or system package manager):
#    • OpenSSL   (libssl-dev on Ubuntu, openssl via vcpkg on Windows)
#    • ZeroMQ    (libzmq3-dev on Ubuntu, zeromq / cppzmq via vcpkg on Windows)
#    • cppzmq    (header-only C++ binding for ZeroMQ)
#
#  Build instructions:
#    mkdir build && cd build
#    cmake .. -DCMAKE_TOOLCHAIN_FILE=<vcpkg-root>/scripts/buildsystems/vcpkg.cmake
#    cmake --build .
#
# ===========================================================================

cmake_minimum_required(VERSION 3.16)
project(AdasBlockchain VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ---------------------------------------------------------------------------
# Dependencies
# ---------------------------------------------------------------------------
find_package(OpenSSL REQUIRED)
find_package(cppzmq  REQUIRED)  # pulls in libzmq automatically

# ---------------------------------------------------------------------------
# 1.  Static library: sha256 hasher
# ---------------------------------------------------------------------------
add_library(sha256_hasher STATIC
    src/sha256_hasher.cpp
)
target_include_directories(sha256_hasher PUBLIC include)
target_link_libraries(sha256_hasher PUBLIC OpenSSL::Crypto)

# ---------------------------------------------------------------------------
# 2.  Static library: ZMQ publisher
# ---------------------------------------------------------------------------
add_library(zmq_publisher STATIC
    src/zmq_publisher.cpp
)
target_include_directories(zmq_publisher PUBLIC include)
target_link_libraries(zmq_publisher PUBLIC cppzmq)

# ---------------------------------------------------------------------------
# 3.  Executable: SHA-256 unit test
# ---------------------------------------------------------------------------
add_executable(test_sha256 src/test_sha256.cpp)
target_link_libraries(test_sha256 PRIVATE sha256_hasher)

# ---------------------------------------------------------------------------
# 4.  Executable: ZMQ Publisher demo (10 hashes / sec)
# ---------------------------------------------------------------------------
add_executable(zmq_pub_demo src/zmq_pub_demo.cpp)
target_link_libraries(zmq_pub_demo PRIVATE sha256_hasher zmq_publisher)

# ---------------------------------------------------------------------------
# Install targets (optional)
# ---------------------------------------------------------------------------
install(TARGETS sha256_hasher zmq_publisher
        ARCHIVE DESTINATION lib)
install(DIRECTORY include/ DESTINATION include)
