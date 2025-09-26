# Concurrent Ticket Booking System

A Node.js and Express.js application that simulates a ticket booking system for events or movie theaters with seat locking mechanism and automatic expiration.

## Features

- **Seat Management**: 100 seats (10 rows × 10 seats) with real-time status tracking
- **Concurrent Seat Locking**: Prevents double booking with temporary locks
- **Automatic Lock Expiration**: Locks expire after 1 minute if not confirmed
- **RESTful API**: Complete API for seat operations
- **Web Interface**: Interactive HTML dashboard for testing
- **Concurrent Testing**: Built-in test suite for concurrent scenarios

## Installation

```bash
# Install dependencies
npm install

# Start the server
npm start

# For development with auto-restart
npm run dev

# Run API tests
npm test
```

## API Endpoints

### Health Check
```
GET /api/health
```

### Seat Management
```
GET /api/seats                    # Get all seats with status
GET /api/seats/available          # Get only available seats
GET /api/seats/:seatId            # Get specific seat details
GET /api/stats                    # Get system statistics
```

### Seat Operations
```
POST /api/seats/:seatId/lock      # Lock a seat temporarily
POST /api/seats/:seatId/confirm   # Confirm booking (requires lock)
DELETE /api/seats/:seatId/lock    # Release lock manually
```

## Seat States

- **Available**: Seat can be locked and booked
- **Locked**: Temporarily reserved (expires in 1 minute)
- **Booked**: Permanently reserved

## Usage Examples

### Lock a Seat
```bash
curl -X POST http://localhost:3000/api/seats/5-5/lock \
  -H "Content-Type: application/json" \
  -d '{"userId": "user123"}'
```

### Confirm Booking
```bash
curl -X POST http://localhost:3000/api/seats/5-5/confirm \
  -H "Content-Type: application/json" \
  -d '{"userId": "user123"}'
```

### Check Seat Status
```bash
curl http://localhost:3000/api/seats/5-5
```

## Web Interface

Open http://localhost:3000 in your browser to access the interactive dashboard where you can:

- View real-time seat availability
- Lock and unlock seats
- Confirm bookings
- Test concurrent scenarios
- Monitor system statistics

## Testing Concurrent Scenarios

The system includes a comprehensive test suite that simulates concurrent requests:

```bash
# Run the test suite
node test.js
```

The tests include:
- Basic API functionality
- Concurrent locking attempts
- Lock expiration verification
- Double booking prevention
- Error handling scenarios

## Architecture

### Seat Locking Mechanism
- Seats are locked with a unique lock ID and user ID
- Locks automatically expire after 60 seconds
- Only the lock owner can confirm the booking
- Cleanup process removes expired locks every 10 seconds

### Concurrency Handling
- In-memory data structure with Map for O(1) operations
- Atomic operations prevent race conditions
- Lock validation before any seat state changes
- Proper error messages for all scenarios

### Data Structure
```javascript
seats: Map<seatId, {
  id, row, seat, state, bookedBy, bookedAt
}>

locks: Map<seatId, {
  lockId, userId, seatId, expiresAt, createdAt
}>
```

## Configuration

- **Lock Timeout**: 60 seconds (configurable in server.js)
- **Cleanup Interval**: 10 seconds
- **Theater Size**: 10×10 seats (configurable)
- **Port**: 3000 (configurable via PORT environment variable)

## Error Handling

The system provides clear error messages for:
- Attempting to lock already booked seats
- Trying to lock seats already locked by others
- Confirming bookings without valid locks
- Expired lock confirmations
- Invalid seat IDs
- Missing user IDs

## Production Considerations

For production deployment, consider:
- Using a persistent database (Redis/MongoDB) instead of in-memory storage
- Implementing user authentication
- Adding seat pricing and payment integration
- Scaling with multiple server instances
- Adding logging and monitoring
- Implementing rate limiting

## File Structure

```
├── server.js          # Main Express server
├── test.js           # API test suite
├── package.json      # Dependencies and scripts
├── public/
│   └── index.html    # Web interface
└── README.md         # This file
```