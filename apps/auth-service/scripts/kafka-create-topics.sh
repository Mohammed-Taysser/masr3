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

# Must stay in sync with AuthKafkaTopic in libs/src/lib/kafka/auth/auth.topics.ts.
TOPICS=(
  "auth.user-register"
  "auth.user-logged-in"
  "auth.user-logged-out"
  "auth.user-change-password"
  "auth.password-reset-requested"
  "auth.password-reset-completed"
)

# The password-reset event carries the raw reset token. Keep it in the log no
# longer than the token could be useful (PASSWORD_RESET_TOKEN_TTL_MS, 10 min
# in .env.example) plus slack for a consumer that is briefly down.
declare -A TOPIC_CONFIGS=(
  ["auth.password-reset-requested"]="retention.ms=3600000"
)

for topic in "${TOPICS[@]}"; do
  echo "Creating Kafka topic: $topic"

  config_args=()

  if [[ -n "${TOPIC_CONFIGS[$topic]:-}" ]]; then
    config_args=(--config "${TOPIC_CONFIGS[$topic]}")
  fi

  docker exec "$CONTAINER" /opt/kafka/bin/kafka-topics.sh \
    --bootstrap-server "$BOOTSTRAP" \
    --create \
    --if-not-exists \
    --topic "$topic" \
    --partitions "$PARTITIONS" \
    --replication-factor "$REPLICATION_FACTOR" \
    "${config_args[@]}"

  # --if-not-exists skips --config for a topic that already exists, so apply
  # it explicitly; this is what makes re-running the script converge.
  if [[ -n "${TOPIC_CONFIGS[$topic]:-}" ]]; then
    docker exec "$CONTAINER" /opt/kafka/bin/kafka-configs.sh \
      --bootstrap-server "$BOOTSTRAP" \
      --alter \
      --entity-type topics \
      --entity-name "$topic" \
      --add-config "${TOPIC_CONFIGS[$topic]}"
  fi
done

echo "All Kafka topics created successfully."
