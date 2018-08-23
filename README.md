# PubSub-Q

PubSub-Q helps you to receive, send, reply and manage retry messages. The underlying framework for sending messages is the Google Cloud PubSub Service. 

# Features!

  - Listener for a pull-subscription 
  - Send messages to a specified topic
  - Send reply to a previously received message, by adding the original messageID
  - Receiving and identifying a reply message for a previously published message

### ToDos
 - More Documentation
 - Testing Scenarios
 - More precise Catching/Error Throwing

### Installation

https://www.npmjs.com/package/node-pubsub-q

`` npm i node-pubsub-q ``

### Contribution

https://github.com/AndreyBulezyuk/node-pubsub-q

## Usage

```sh 
const pubsubHelper = require('node-pubsub-q'); 
pubsubHelper.init(YOUR_GCLOUD_PROJECT_ID);
```

### Message Listener
```sh
// Receives Pull Messages from Pub/Sub
pubsubHelper.listener(config.gcp.pubsub.queue_pull_sub,
  config.gcp.pubsub.retryInSeconds,
  async function handler(message) {
    messageHandler(message.data);    
 }
);
```

### Send Message
```sh
  try{
    let messageId = await pubsubHelper.sendMessage(
      config.gcp.pubsub.serviceB_topic, // Topic of receiver
      config.serviceName, // Topic of sender
      payload //payload
    )
  } catch(e) {
    console.log(e);
  }
```


### Send Reply Message

```sh
    try{
      let messageId = await pubsubHelper.sendReply(
        message.originatorTopic, // specify the topic of the service that should receive this reply
        config.serviceName, // topic of sender
        message.originalMessageId, // receiver will map this as a reply by using the original Message Id
        payload
      )
    } catch(e) {
        console.log(e);
    }
```