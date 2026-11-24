CREATE TABLE rides (
  id INTEGER PRIMARY KEY,
  driver_id TEXT NOT NULL REFERENCES discord_users(user_id),
  origin TEXT NOT NULL CHECK (length(origin) BETWEEN 1 AND 120),
  destination TEXT NOT NULL CHECK (length(destination) BETWEEN 1 AND 120),
  departure_at TEXT NOT NULL,
  departure_day TEXT NOT NULL,
  total_seats INTEGER NOT NULL CHECK (total_seats BETWEEN 1 AND 8),
  available_seats INTEGER NOT NULL CHECK (available_seats BETWEEN 0 AND total_seats)
);

CREATE INDEX idx_rides_day ON rides(departure_day, departure_at);
CREATE INDEX idx_rides_driver ON rides(driver_id, departure_at);

CREATE TABLE ride_reservations (
  ride_id INTEGER NOT NULL REFERENCES rides(id),
  passenger_id TEXT NOT NULL REFERENCES discord_users(user_id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (ride_id, passenger_id)
);

CREATE TRIGGER ride_reservation_decrement
AFTER INSERT ON ride_reservations
BEGIN
  UPDATE rides SET available_seats = available_seats - 1
  WHERE id = NEW.ride_id;
END;
