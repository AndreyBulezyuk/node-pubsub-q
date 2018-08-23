'use strict';

const PubSub = require(`@google-cloud/pubsub`)

module.exports = {
    pubsub:null,
    init: (projectId) => {
      this.pubsub = new PubSub({projectId:projectId});
    },
  retryInSeconds: 5,
  solved: async (message) => {
    message.ack();
    return;
  },
  requeue: async (message) => {
    console.log(`requeueing message ${message.id}. Timer ${this.retryInSeconds+1}s`);
    message.ack();
    message.data['__last_received_datetime'] = new Date(message.received);
    message.data['__times_requeued'] += 1;
    const dataBuffer = Buffer.from(JSON.stringify(message.data));
    const requeue = setInterval(async function() {
        this.pubsub
        .topic('caresoap-worker')
        .publisher()
        .publish(dataBuffer)
        .then(messageId => {
            console.log(`Message ${messageId} requeued.`);
        })
        .catch(err => {
            console.error('ERROR:', err);
        });
        clearTimeout(requeue);
    }, this.retryInSeconds*1000+1000);
    return;
  },
  check: async (message) => {
  const retryMilliSeconds = 10000;
  const maxRetries = 5;  
  console.log(`<--------------${message.id}--------------->`);
  try {
    message.data = JSON.parse(String(message.data));
    if (!message.data.hasOwnProperty('originalMessageId')) {
      message.data.originalMessageId = message.id;
    }
    if (message.data.hasOwnProperty('__last_received_datetime') 
        && message.data.hasOwnProperty('__times_requeued')
        && message.data.hasOwnProperty('__times_processed')) {
      message.data.__times_processed += 1; 
      if (message.data.__times_requeued >= maxRetries || message.data.__times_processed >= maxRetries) {
        console.log('max requeues/processings reached.');
        // @TODO: Send this message to dead-letter-queue (MongoDB, DataStore)
        message.ack();
        return false;
      }
      if (message.data.__times_requeued == 0) { 
        console.log('processing first time (counter=0). can process.');
        message.ack()
        return message; 
      }
      let nextRetryDatetime = new Date(Date.parse(message.data.__last_received_datetime)).getTime()+this.retryInSeconds*1000;
      if (nextRetryDatetime > message.received) {
        console.log('retry period not due. requeuing');
        console.log(`next retry after ${nextRetryDatetime} - now ${message.received}`);
        module.exports.requeue(message);
        return false;
      }
      console.log('retry treshhold passed, can processed msg');
      message.data['__times_processed'] += 1;
      message.ack();
      return message;
       
    } else {
      //set queue data
      console.log('queue parameters not set. setting...');
      message.data['__last_received_datetime'] = new Date(message.received);
      message.data['__times_requeued'] = 0;
      message.data['__times_processed'] = 1;
      message.ack();
      return message;
    }
} catch (e) {
  console.log(e);
  console.log('failed to process msg. requeueing.');
  module.exports.requeue(message);
  return false;
}
return;
  },
  listener:  async (subscription, retryInSeconds, handler) => {
    this.retryInSeconds = retryInSeconds;
    const sub = this.pubsub.subscription(subscription);
    sub.on(`message`, async (message) => {
        message = await module.exports.check(message); 
        if (message === false) {
          return false;
        }
        handler(message);
    });
  },
  sendMessage: async (targetTopic, publisherTopic, message) => {
    try {
      message['originatorTopic'] = publisherTopic;
      message['__last_received_datetime'] = new Date();
      message['__times_requeued'] = 0;
      message['__times_processed'] = 0;

      const messageId = await this.pubsub
      .topic(targetTopic)
      .publisher(publisherTopic)
      .publish(Buffer.from(JSON.stringify(message)));
      console.log(`Message ${messageId} sent to ${targetTopic} at ${new Date()}.`);
      return messageId;
    } catch(e) {
      console.error('ERROR in SendMessage:', e);
    }
  },
  sendReply: async (targetTopic, publisherTopic, originalMessageId, message) => {
    try {
      message['originalMessageId'] = originalMessageId;
      const messageId = await this.pubsub
      .topic(targetTopic)
      .publisher(publisherTopic)
      .publish(Buffer.from(JSON.stringify(message)));
      console.log(`Reply ${messageId} to original msg ${originalMessageId} sent to ${targetTopic} at ${new Date()}.`);
      return messageId;
  } catch(e) {
    console.error('ERROR in sendReply:', err);
  }
  }
};
