const bodyParser = require('body-parser');
const crypto = require('crypto');
const express = require('express');
const fetch = require('node-fetch');
const request = require('request');
const config = require('config');
const axios = require("axios")


const APP_SECRET = (process.env.MESSENGER_APP_SECRET) ?
    process.env.MESSENGER_APP_SECRET :
    config.get('appSecret');

const VALIDATION_TOKEN = (process.env.MESSENGER_VALIDATION_TOKEN) ?
    (process.env.MESSENGER_VALIDATION_TOKEN) :
    config.get('validationToken');

const PAGE_ACCESS_TOKEN = (process.env.MESSENGER_PAGE_ACCESS_TOKEN) ?
    (process.env.MESSENGER_PAGE_ACCESS_TOKEN) :
    config.get('pageAccessToken');

if (!(APP_SECRET && VALIDATION_TOKEN && PAGE_ACCESS_TOKEN)) {
    console.error("Missing config values");
    process.exit(1);
}

var app = express();
app.set('port', process.env.PORT || 5000);
app.set('view engine', 'ejs');
app.use(bodyParser.json({
    verify: verifyRequestSignature
}));

app.get('/webhook', function (req, res) {
    if (req.query['hub.mode'] === 'subscribe' &&
        req.query['hub.verify_token'] === VALIDATION_TOKEN) {
        console.log("Validating webhook");
        res.status(200).send(req.query['hub.challenge']);
    } else {
        console.error("Failed validation. Make sure the validation tokens match.");
        res.sendStatus(403);
    }
});


function firstEntity(nlp, name) {
    return nlp && nlp.entities && nlp.entities[name] && nlp.entities[name][0];
}

app.listen(app.get('port'), function () {
    console.log('Node app is running on port', app.get('port'));
});

function receivedMessage(event) {
    var senderID = event.sender.id;
    var recipientID = event.recipient.id;
    var timeOfMessage = event.timestamp;
    var message = event.message;

    console.log("Received message for user %d and page %d at %d with message:",
        senderID, recipientID, timeOfMessage);
    console.log(JSON.stringify(message));

    var messageId = message.mid;

    // You may get a text or attachment but not both
    var messageText = message.text;
    var messageAttachments = message.attachments;
    var quickReply = message.quick_reply;

    const cryptocurrency_type = firstEntity(message.nlp, 'cryptocurrency_type');
    const query_price = firstEntity(message.nlp, 'query_price');

    if (messageText) {
        if (cryptocurrency_type && cryptocurrency_type.confidence > 0.8 && !query_price) {
            // if (cryptocurrency_type.value == 'Bitcoin') {
            //     sendTextMessage(senderID, "You say Bitcoin?");
            // } else if (cryptocurrency_type.value == 'IOTA') {
            //     sendTextMessage(senderID, "You say Iota?");
            // } else if (cryptocurrency_type.value = 'Ethereum') {
            //     sendTextMessage(senderID, "You say Ethereum?");
            // }else if (cryptocurrency_type.value = 'EOS') {
            //     sendTextMessage(senderID, "You say Eos?");
            // }
            switch (cryptocurrency_type.value) {
                case 'Bitcoin':
                    sendTextMessage(senderID, "You say Bitcoin?");
                    break;
                case 'IOTA':
                    sendTextMessage(senderID, "You say Iota?");
                    break;
                case 'Ethereum':
                    sendTextMessage(senderID, "You say Ethereum?");
                    break;
                case 'EOS':
                    sendTextMessage(senderID, "You say Eos?");
                    break;
            }
        }
        if (query_price && query_price.confidence > 0.8 && cryptocurrency_type && cryptocurrency_type.confidence > 0.8) {
            // if (cryptocurrency_type.value == 'Bitcoin') {
            //     getPrice("bitcoin", senderID);
            // } else if (cryptocurrency_type.value == 'IOTA') {
            //     getPrice("iota", senderID);
            // } else if (cryptocurrency_type.value == 'EOS') {
            //     getPrice("eos", senderID);
            // } else if (cryptocurrency_type.value == 'Ethereum') {
            //     getPrice("ethereum", senderID);
            // }

            switch (cryptocurrency_type.value) {
                case 'Bitcoin':
                getPrice("bitcoin", senderID);
                    break;
                case 'IOTA':
                getPrice("iota", senderID);
                    break;
                case 'Ethereum':
                getPrice("ethereum", senderID);
                    break;
                case 'EOS':
                getPrice("eos", senderID);
                    break;
            }
        }
    }
}

// Sending messages
function callSendAPI(messageData) {
    request({
        uri: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {
            access_token: PAGE_ACCESS_TOKEN
        },
        method: 'POST',
        json: messageData

    }, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var recipientId = body.recipient_id;
            var messageId = body.message_id;

            if (messageId) {
                console.log("Successfully sent message with id %s to recipient %s",
                    messageId, recipientId);
            } else {
                console.log("Successfully called Send API for recipient %s",
                    recipientId);
            }
        } else {
            console.error("Failed calling Send API", response.statusCode, response.statusMessage, body.error);
        }
    });
}


function verifyRequestSignature(req, res, buf) {
    var signature = req.headers["x-hub-signature"];

    if (!signature) {
        // For testing, let's log an error. In production, you should throw an
        // error.
        console.error("Couldn't validate the signature.");
    } else {
        var elements = signature.split('=');
        var method = elements[0];
        var signatureHash = elements[1];

        var expectedHash = crypto.createHmac('sha1', APP_SECRET)
            .update(buf)
            .digest('hex');

        if (signatureHash != expectedHash) {
            throw new Error("Couldn't validate the request signature.");
        }
    }
};

app.post('/webhook', function (req, res) {
    var data = req.body;
    var orderSubtitle;

    // Make sure this is a page subscription
    if (data.object == 'page') {
        // Iterate over each entry
        // There may be multiple if batched
        data.entry.forEach(function (pageEntry) {
            var pageID = pageEntry.id;
            var timeOfEvent = pageEntry.time;

            // Iterate over each messaging event
            pageEntry.messaging.forEach(function (messagingEvent) {
                if (messagingEvent.message) {
                    receivedMessage(messagingEvent);
                } else {
                    console.log("Webhook received unknown messagingEvent: ", messagingEvent);
                }
            });
        });
        res.sendStatus(200);
    }
});

function sendTextMessage(recipientId, messageText) {
    var messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            text: messageText,
            metadata: "DEVELOPER_DEFINED_METADATA"
        }
    };

    callSendAPI(messageData);
}

function getPrice(currency, senderID) {
    axios.get(`https://api.coinmarketcap.com/v1/ticker/${currency}/`)
        .then(response => {
            let price = response.data[0].price_usd;
            printPrice(currency, price, senderID)
        })
        .catch(error => {
            console.log(error);
        });
}


function printPrice(currency, price, senderID) {
    let cost = `The price of ${currency} is ${price} US Dollars`;
    sendTextMessage(senderID, cost);
}