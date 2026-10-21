// Runtime: Node.js 20.x (AWS SDK v3 is built in). Handler: index.handler
// Trigger: DynamoDB Streams on the shop-events table (new image).
import { SNSClient, SubscribeCommand, PublishCommand } from '@aws-sdk/client-sns';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const sns = new SNSClient({});
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TOPIC = process.env.TOPIC_ARN;
const EVENTS_TABLE = process.env.EVENTS_TABLE; // shop-events

export const handler = async (event) => {
  for (const record of event.Records) {
    if (record.eventName !== 'INSERT') continue; // ignore our own status updates

    const img = record.dynamodb.NewImage;
    const get = (k) => img[k]?.S ?? img[k]?.N;
    const { id, type, email, name, orderId, total } = {
      id: get('id'), type: get('type'), email: get('email'),
      name: get('name'), orderId: get('orderId'), total: get('total'),
    };

    let status = 'SENT';
    try {
      if (type === 'USER_REGISTERED') {
        // Subscribe the customer's email. The filter policy means they only receive messages addressed to them.
        await sns.send(new SubscribeCommand({
          TopicArn: TOPIC, Protocol: 'email', Endpoint: email,
          Attributes: { FilterPolicy: JSON.stringify({ email: [email] }) },
          ReturnSubscriptionArn: true,
        }));
        status = 'SUBSCRIPTION_CONFIRMATION_SENT';
      } else if (type === 'ORDER_PLACED') {
        await sns.send(new PublishCommand({
          TopicArn: TOPIC,
          Subject: `Order #${orderId} confirmed`,
          Message: `Hi ${name},\n\nThanks for your order #${orderId}. Total: Rs. ${Number(total).toFixed(2)}.\n\nWe'll let you know when it ships.`,
          MessageAttributes: { email: { DataType: 'String', StringValue: email } },
        }));
      } else {
        status = 'IGNORED';
      }
    } catch (err) {
      console.error(err);
      status = 'FAILED';
    }

    // Record the result on the same event row (status is a reserved word, so we alias it)
    await ddb.send(new UpdateCommand({
      TableName: EVENTS_TABLE, Key: { id },
      UpdateExpression: 'SET #s = :s, processedAt = :t',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: { ':s': status, ':t': new Date().toISOString() },
    }));
  }
};
