const express = require("express");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static("public"));

// Seat states
const SEAT_STATES = {
  AVAILABLE: "available",
  LOCKED: "locked",
  BOOKED: "booked",
};

// In-memory data structure for seats
class SeatManager {
  constructor() {
    this.seats = new Map();
    this.locks = new Map();
    this.lockTimeout = 60000; // 1 minute lock timeout

    // Initialize seats (10 rows, 10 seats per row)
    this.initializeSeats();

    // Clean up expired locks every 10 seconds
    setInterval(() => this.cleanupExpiredLocks(), 10000);
  }

  initializeSeats() {
    for (let row = 1; row <= 10; row++) {
      for (let seat = 1; seat <= 10; seat++) {
        const seatId = `${row}-${seat}`;
        this.seats.set(seatId, {
          id: seatId,
          row: row,
          seat: seat,
          state: SEAT_STATES.AVAILABLE,
          bookedBy: null,
          bookedAt: null,
        });
      }
    }
  }

  getAllSeats() {
    return Array.from(this.seats.values()).map((seat) => ({
      ...seat,
      isLocked: this.isLocked(seat.id),
      lockedBy: this.locks.get(seat.id)?.userId || null,
      lockExpiresAt: this.locks.get(seat.id)?.expiresAt || null,
    }));
  }

  getSeat(seatId) {
    const seat = this.seats.get(seatId);
    if (!seat) return null;

    return {
      ...seat,
      isLocked: this.isLocked(seatId),
      lockedBy: this.locks.get(seatId)?.userId || null,
      lockExpiresAt: this.locks.get(seatId)?.expiresAt || null,
    };
  }

  isLocked(seatId) {
    const lock = this.locks.get(seatId);
    if (!lock) return false;

    // Check if lock has expired
    if (Date.now() > lock.expiresAt) {
      this.locks.delete(seatId);
      return false;
    }

    return true;
  }

  lockSeat(seatId, userId) {
    const seat = this.seats.get(seatId);

    if (!seat) {
      return { success: false, message: "Seat not found" };
    }

    if (seat.state === SEAT_STATES.BOOKED) {
      return { success: false, message: "Seat is already booked" };
    }

    if (this.isLocked(seatId)) {
      const lock = this.locks.get(seatId);
      if (lock.userId === userId) {
        // Extend lock for same user
        lock.expiresAt = Date.now() + this.lockTimeout;
        return {
          success: true,
          message: "Lock extended successfully",
          lockExpiresAt: lock.expiresAt,
        };
      } else {
        return {
          success: false,
          message: "Seat is already locked by another user",
        };
      }
    }

    // Create new lock
    const lockId = uuidv4();
    const expiresAt = Date.now() + this.lockTimeout;

    this.locks.set(seatId, {
      lockId,
      userId,
      seatId,
      expiresAt,
      createdAt: Date.now(),
    });

    return {
      success: true,
      message: "Seat locked successfully",
      lockId,
      lockExpiresAt: expiresAt,
    };
  }

  confirmBooking(seatId, userId) {
    const seat = this.seats.get(seatId);

    if (!seat) {
      return { success: false, message: "Seat not found" };
    }

    if (seat.state === SEAT_STATES.BOOKED) {
      return { success: false, message: "Seat is already booked" };
    }

    const lock = this.locks.get(seatId);

    if (!lock || lock.userId !== userId) {
      return {
        success: false,
        message: "No valid lock found for this seat and user",
      };
    }

    if (Date.now() > lock.expiresAt) {
      this.locks.delete(seatId);
      return { success: false, message: "Lock has expired" };
    }

    // Confirm booking
    seat.state = SEAT_STATES.BOOKED;
    seat.bookedBy = userId;
    seat.bookedAt = new Date().toISOString();

    // Remove lock
    this.locks.delete(seatId);

    const bookingId = uuidv4();

    return {
      success: true,
      message: "Booking confirmed successfully",
      bookingId,
      seat: this.getSeat(seatId),
    };
  }

  releaseLock(seatId, userId) {
    const lock = this.locks.get(seatId);

    if (!lock) {
      return { success: false, message: "No lock found for this seat" };
    }

    if (lock.userId !== userId) {
      return {
        success: false,
        message: "Cannot release lock - not owned by user",
      };
    }

    this.locks.delete(seatId);

    return { success: true, message: "Lock released successfully" };
  }

  cleanupExpiredLocks() {
    const now = Date.now();
    const expiredLocks = [];

    for (const [seatId, lock] of this.locks.entries()) {
      if (now > lock.expiresAt) {
        expiredLocks.push(seatId);
      }
    }

    expiredLocks.forEach((seatId) => {
      this.locks.delete(seatId);
    });

    if (expiredLocks.length > 0) {
      console.log(`Cleaned up ${expiredLocks.length} expired locks`);
    }
  }

  getAvailableSeats() {
    return Array.from(this.seats.values())
      .filter(
        (seat) =>
          seat.state === SEAT_STATES.AVAILABLE && !this.isLocked(seat.id)
      )
      .map((seat) => this.getSeat(seat.id));
  }

  getBookedSeats() {
    return Array.from(this.seats.values())
      .filter((seat) => seat.state === SEAT_STATES.BOOKED)
      .map((seat) => this.getSeat(seat.id));
  }

  getLockedSeats() {
    return Array.from(this.seats.values())
      .filter((seat) => this.isLocked(seat.id))
      .map((seat) => this.getSeat(seat.id));
  }

  getStats() {
    const totalSeats = this.seats.size;
    const availableSeats = this.getAvailableSeats().length;
    const bookedSeats = this.getBookedSeats().length;
    const lockedSeats = this.getLockedSeats().length;

    return {
      totalSeats,
      availableSeats,
      bookedSeats,
      lockedSeats,
      activeLocks: this.locks.size,
    };
  }
}

// Initialize seat manager
const seatManager = new SeatManager();

// Routes

// Get all seats with their current status
app.get("/api/seats", (req, res) => {
  try {
    const seats = seatManager.getAllSeats();
    res.json({
      success: true,
      data: seats,
      stats: seatManager.getStats(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving seats",
      error: error.message,
    });
  }
});

// Get available seats only
app.get("/api/seats/available", (req, res) => {
  try {
    const availableSeats = seatManager.getAvailableSeats();
    res.json({
      success: true,
      data: availableSeats,
      count: availableSeats.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving available seats",
      error: error.message,
    });
  }
});

// Get a specific seat
app.get("/api/seats/:seatId", (req, res) => {
  try {
    const { seatId } = req.params;
    const seat = seatManager.getSeat(seatId);

    if (!seat) {
      return res.status(404).json({
        success: false,
        message: "Seat not found",
      });
    }

    res.json({
      success: true,
      data: seat,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving seat",
      error: error.message,
    });
  }
});

// Lock a seat
app.post("/api/seats/:seatId/lock", (req, res) => {
  try {
    const { seatId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const result = seatManager.lockSeat(seatId, userId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error locking seat",
      error: error.message,
    });
  }
});

// Confirm booking
app.post("/api/seats/:seatId/confirm", (req, res) => {
  try {
    const { seatId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const result = seatManager.confirmBooking(seatId, userId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error confirming booking",
      error: error.message,
    });
  }
});

// Release lock
app.delete("/api/seats/:seatId/lock", (req, res) => {
  try {
    const { seatId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const result = seatManager.releaseLock(seatId, userId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error releasing lock",
      error: error.message,
    });
  }
});

// Get system statistics
app.get("/api/stats", (req, res) => {
  try {
    const stats = seatManager.getStats();
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving statistics",
      error: error.message,
    });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Ticket booking system is running",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Serve HTML interface
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "Something went wrong!",
    error: err.message,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Endpoint not found",
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🎫 Ticket Booking System running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
  console.log(`💺 Total seats available: ${seatManager.getStats().totalSeats}`);
});

module.exports = app;
