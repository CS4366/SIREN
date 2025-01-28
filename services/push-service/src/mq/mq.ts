import amqp from "amqplib";

let channel: amqp.Channel;

export const connectToMQ = async (
  queue: string,
  onMessage: (msg: any) => void
) => {
  try {
    const connection = await amqp.connect(
      process.env.RABBITMQ_URL || "amqp://127.0.0.1"
    );
    channel = await connection.createChannel();
    await channel.assertQueue(queue, { durable: true });
    console.log(`Connected to MQ and listening to queue ${queue}`);

    channel.consume(
      queue,
      (msg) => {
        if (msg) {
          const content = msg.content.toString();
          onMessage(content);
          channel.ack(msg);
        }
      },
      { noAck: false }
    );
  } catch (error) {
    console.error("Error connecting to MQ", error);
  }
};

export const closeMQ = async () => {
  if (channel) {
    await channel.close();
    console.log("RabbitMQ channel closed");
  }
};
