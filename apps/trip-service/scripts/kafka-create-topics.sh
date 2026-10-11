#!/usr/bin/env bash

set -euo pipefail

# Runs the Kafka CLI inside the broker container, so nothing has to be
# installed on the host. Inside the container the broker is reached on its
# INTERNAL listener (9092), not the host-published 42000.
CONTAINER="${KAFKA_CONTAINER:-masr3-kafka}"
BOOTSTRAP="localhost:9092"
PARTITIONS=3
REPLICATION_FACTOR=1

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "Error: container $CONTAINER is not running. Start it with: docker compose up -d kafka"
  exit 1
fi

# Must stay in sync with TripKafkaTopic in libs/src/lib/kafka/trip/trip.topics.ts.
TOPICS=(
  "trip.status-changed"
)

for topic in "${TOPICS[@]}"; do
  echo "Creating Kafka topic: $topic"

  docker exec "$CONTAINER" /opt/kafka/bin/kafka-topics.sh \
    --bootstrap-server "$BOOTSTRAP" \
    --create \
    --if-not-exists \
    --topic "$topic" \
    --partitions "$PARTITIONS" \
    --replication-factor "$REPLICATION_FACTOR"
done

echo "All Kafka topics created successfully."
