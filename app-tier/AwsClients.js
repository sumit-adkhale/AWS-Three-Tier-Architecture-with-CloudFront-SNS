// DynamoDB only: carts, plus an events table whose stream triggers the notification Lambda.
// The backend never calls Lambda or SNS directly, so private subnets need no NAT and no paid endpoint.
const { randomUUID } = require('crypto');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION }));

// Fire-and-forget: write an event row; DynamoDB Streams then triggers the Lambda.
// A failure here is logged but never breaks the customer's request.
function notify(payload) {
  ddb.send(new PutCommand({
    TableName: process.env.EVENTS_TABLE,
    Item: {
      id: randomUUID(),
      ...payload,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      expiresAt: Math.floor(Date.now() / 1000) + 7 * 24 * 3600, // TTL: DynamoDB deletes it after 7 days
    },
  })).catch((err) => console.error('Event write failed:', err.message));
}

module.exports = { ddb, GetCommand, PutCommand, DeleteCommand, notify };
