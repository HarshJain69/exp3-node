// Test script for the Concurrent Ticket Booking System
const axios = require("axios");

const BASE_URL = "http://localhost:3000/api";

// Helper function to make API calls with error handling
async function apiCall(method, url, data = null) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${url}`,
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return response.data;
  } catch (error) {
    if (error.response) {
      return error.response.data;
    } else {
      return { success: false, message: error.message };
    }
  }
}

// Generate random user ID
function generateUserId() {
  return `user_${Math.random().toString(36).substr(2, 9)}`;
}

// Test functions
async function testHealthCheck() {
  console.log("\n🔍 Testing Health Check...");
  const result = await apiCall("GET", "/health");
  console.log("Result:", result);
  return result.success;
}

async function testGetAllSeats() {
  console.log("\n🪑 Testing Get All Seats...");
  const result = await apiCall("GET", "/seats");
  console.log("Result:", result.success ? "Success" : result.message);
  if (result.success) {
    console.log(`Total seats: ${result.stats.totalSeats}`);
    console.log(`Available: ${result.stats.availableSeats}`);
    console.log(`Locked: ${result.stats.lockedSeats}`);
    console.log(`Booked: ${result.stats.bookedSeats}`);
  }
  return result.success;
}

async function testGetAvailableSeats() {
  console.log("\n✅ Testing Get Available Seats...");
  const result = await apiCall("GET", "/seats/available");
  console.log(
    "Result:",
    result.success ? `Found ${result.count} available seats` : result.message
  );
  return result.success;
}

async function testLockSeat(seatId, userId) {
  console.log(`\n🔒 Testing Lock Seat ${seatId} for ${userId}...`);
  const result = await apiCall("POST", `/seats/${seatId}/lock`, { userId });
  console.log("Result:", result.message);
  if (result.success && result.lockExpiresAt) {
    console.log(
      `Lock expires at: ${new Date(result.lockExpiresAt).toLocaleString()}`
    );
  }
  return result.success;
}

async function testConfirmBooking(seatId, userId) {
  console.log(`\n✅ Testing Confirm Booking ${seatId} for ${userId}...`);
  const result = await apiCall("POST", `/seats/${seatId}/confirm`, { userId });
  console.log("Result:", result.message);
  if (result.success) {
    console.log(`Booking ID: ${result.bookingId}`);
  }
  return result.success;
}

async function testReleaseLock(seatId, userId) {
  console.log(`\n🔓 Testing Release Lock ${seatId} for ${userId}...`);
  const result = await apiCall("DELETE", `/seats/${seatId}/lock`, { userId });
  console.log("Result:", result.message);
  return result.success;
}

async function testGetSpecificSeat(seatId) {
  console.log(`\n🪑 Testing Get Specific Seat ${seatId}...`);
  const result = await apiCall("GET", `/seats/${seatId}`);
  console.log("Result:", result.success ? "Success" : result.message);
  if (result.success) {
    const seat = result.data;
    console.log(
      `Seat ${seat.id}: ${seat.state} ${seat.isLocked ? "(LOCKED)" : ""}`
    );
    if (seat.isLocked) {
      console.log(`Locked by: ${seat.lockedBy}`);
      console.log(
        `Lock expires: ${new Date(seat.lockExpiresAt).toLocaleString()}`
      );
    }
  }
  return result.success;
}

async function testConcurrentLocking() {
  console.log("\n🏁 Testing Concurrent Locking...");

  const seatId = "5-5"; // Middle seat
  const user1 = generateUserId();
  const user2 = generateUserId();

  console.log(`User 1: ${user1}`);
  console.log(`User 2: ${user2}`);
  console.log(`Target seat: ${seatId}`);

  // Both users try to lock the same seat simultaneously
  console.log("\n🔄 Attempting concurrent locks...");
  const [result1, result2] = await Promise.all([
    testLockSeat(seatId, user1),
    testLockSeat(seatId, user2),
  ]);

  console.log(`User 1 lock result: ${result1}`);
  console.log(`User 2 lock result: ${result2}`);

  // Check seat status
  await testGetSpecificSeat(seatId);

  // Try to confirm booking with both users
  console.log("\n🔄 Attempting concurrent confirmations...");
  const [confirm1, confirm2] = await Promise.all([
    testConfirmBooking(seatId, user1),
    testConfirmBooking(seatId, user2),
  ]);

  console.log(`User 1 confirm result: ${confirm1}`);
  console.log(`User 2 confirm result: ${confirm2}`);

  // Final seat status
  await testGetSpecificSeat(seatId);
}

async function testLockExpiration() {
  console.log("\n⏰ Testing Lock Expiration...");

  const seatId = "7-7";
  const userId = generateUserId();

  console.log(`Testing with seat ${seatId} and user ${userId}`);

  // Lock the seat
  await testLockSeat(seatId, userId);

  console.log("Waiting for lock to expire (this may take up to 60 seconds)...");
  console.log("You can interrupt this test with Ctrl+C");

  // Check every 10 seconds for 70 seconds
  for (let i = 0; i < 7; i++) {
    await new Promise((resolve) => setTimeout(resolve, 10000));
    console.log(`\nChecking after ${(i + 1) * 10} seconds...`);
    await testGetSpecificSeat(seatId);
  }
}

async function runBasicTests() {
  console.log("🎫 CONCURRENT TICKET BOOKING SYSTEM - API TESTS");
  console.log("================================================");

  let passed = 0;
  let total = 0;

  // Basic API tests
  const tests = [
    ["Health Check", testHealthCheck],
    ["Get All Seats", testGetAllSeats],
    ["Get Available Seats", testGetAvailableSeats],
    ["Get Specific Seat", () => testGetSpecificSeat("1-1")],
    ["Lock Seat", () => testLockSeat("2-3", generateUserId())],
    ["Release Lock", () => testReleaseLock("2-3", generateUserId())], // This should fail
    [
      "Lock and Confirm",
      async () => {
        const userId = generateUserId();
        const lockResult = await testLockSeat("3-4", userId);
        if (lockResult) {
          return await testConfirmBooking("3-4", userId);
        }
        return false;
      },
    ],
  ];

  for (const [testName, testFunc] of tests) {
    total++;
    try {
      const result = await testFunc();
      if (result) {
        console.log(`✅ ${testName}: PASSED`);
        passed++;
      } else {
        console.log(`❌ ${testName}: FAILED`);
      }
    } catch (error) {
      console.log(`❌ ${testName}: ERROR - ${error.message}`);
    }

    // Wait a bit between tests
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log(`\n📊 Test Results: ${passed}/${total} tests passed`);

  return { passed, total };
}

async function runAdvancedTests() {
  console.log("\n🚀 ADVANCED TESTS");
  console.log("==================");

  await testConcurrentLocking();

  console.log("\n⚠️  Starting lock expiration test...");
  const choice = await new Promise((resolve) => {
    const readline = require("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(
      "Do you want to test lock expiration? This takes 60+ seconds (y/n): ",
      (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
      }
    );
  });

  if (choice) {
    await testLockExpiration();
  } else {
    console.log("Skipping lock expiration test.");
  }
}

// Main execution
async function main() {
  console.log("Starting API tests...");
  console.log("Make sure the server is running on http://localhost:3000\n");

  try {
    // Check if server is running
    const healthCheck = await testHealthCheck();
    if (!healthCheck) {
      console.log("❌ Server is not running or not responding");
      console.log("Please start the server with: npm start");
      process.exit(1);
    }

    const basicResults = await runBasicTests();

    if (basicResults.passed > 0) {
      await runAdvancedTests();
    }

    console.log("\n🎉 All tests completed!");
    console.log("\n📖 API Documentation:");
    console.log("GET    /api/health          - Health check");
    console.log("GET    /api/seats           - Get all seats");
    console.log("GET    /api/seats/available - Get available seats");
    console.log("GET    /api/seats/:id       - Get specific seat");
    console.log("POST   /api/seats/:id/lock  - Lock a seat");
    console.log("POST   /api/seats/:id/confirm - Confirm booking");
    console.log("DELETE /api/seats/:id/lock  - Release lock");
    console.log("GET    /api/stats           - Get system statistics");
  } catch (error) {
    console.error("Test execution failed:", error.message);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  main();
}

module.exports = {
  testHealthCheck,
  testGetAllSeats,
  testLockSeat,
  testConfirmBooking,
  testReleaseLock,
  testConcurrentLocking,
  apiCall,
};
