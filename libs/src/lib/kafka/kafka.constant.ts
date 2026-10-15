// Retries for the client's connections and for each send. A relay tick holds
// its transaction open while it sends, so it should fail fast and leave its
// rows pending for the next tick rather than retry for minutes.
const KAFKA_PRODUCER_RETRIES = 2;

export { KAFKA_PRODUCER_RETRIES };
