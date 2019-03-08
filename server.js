const express = require('express');
const fallback = require('express-history-api-fallback');
const nocache = require('nocache');
const path = require('path');
const webPush = require('web-push');
const bodyParser = require('body-parser');
const scheduler = require('./scheduler');
const basicAuth = require('express-basic-auth');

const app = express();
const port = process.env.port || 5555;
const root = path.join(__dirname, 'public');

const summits = {};
summits['arch-pnq'] = require('./data/arch-pnq/event.json');
summits['arch-wro'] = require('./data/arch-wro/event.json');
summits['em-fra'] = require('./data/em-fra/event.json');
summits['em-pnq'] = require('./data/em-pnq/event.json');

app.use(nocache());
app.use(express.static(root));
app.use(bodyParser.json());

app.get('/api/event/:summitName', function(req, res) {
    const summitName = req.params.summitName;
    const summit = summitName && summits[summitName];

    summit ? res.json(summit) : res.sendStatus(400);
});

// diagnostic
app.post('/api/say-hello', function(req, res) {
    res.send('Hello World!');
});

app.post('/api/what-time-is-it', function(req, res) {
    res.send(new Date(Date.now()).toString());
});

const vapidKeys = {
    publicKey: 'BB1ZDDVcnKwB-Pv4aXGB3WP6QmLdSPU6FNPJe9TBrhrajsXF0mLiaSFd7A7ZBfxhw5fUk42N435psrsKvz_Mgko',
    privateKey: 'HeJs_0ZE7HU3diZpCXUVwQEUnDz-TfODzIoRTTloWHw'
};

webPush.setVapidDetails(
    'https://github.com/devonfw-ng-adv-training',
    vapidKeys.publicKey,
    vapidKeys.privateKey
);

const subscriptions = function() {
    const currentSubscriptions = [];

    return {
        add(subscription) {
            const index = currentSubscriptions.findIndex(sub => sub.endpoint === subscription.endpoint);
            if (index === -1) {
                currentSubscriptions.push(subscription);
            }
        },

        remove(endpointKey) {
            const indexToDelete = currentSubscriptions.findIndex(sub => sub.endpoint.indexOf(endpointKey) !== -1);
            if (indexToDelete > -1) {
                currentSubscriptions.splice(indexToDelete, 1);
            }
        },

        pushAll(title, msg, type) {
            let icon = getIcon(type);

            return Promise.all(currentSubscriptions.map(sub => webPush.sendNotification(
                sub, JSON.stringify({
                    notification: {
                        title: title,
                        body: msg,
                        icon: icon,
                        vibrate: [100, 50, 100],
                        data: {
                            dateOfArrival: Date.now(),
                            primaryKey: 1
                        }
                    }
                }))));
        }
    };
}();

app.post('/api/subscription', (req, res) => {
        subscriptions.add(req.body);
        res.sendStatus(200);
    }
);

app.delete('/api/subscription/:endpointKey', (req, res) => {
        subscriptions.remove(req.params.endpointKey);
        res.sendStatus(200);
    }
);

app.use('/api/message/:title/:msg/:type', basicAuth({users: {admin: 'secret'}}));

app.post('/api/message/:title/:msg/:type', (req, res) => {
    const title = req.params.title || '';
    const msg = req.params.msg || '';
    const type = req.params.type || '';

    subscriptions.pushAll(title, msg, type)
        .then(() => res.send(`Sent ${title}: ${msg}.`))
        .catch(err => {
            console.error('Error sending notification, reason: ', err);
            res.sendStatus(500);
        })
});

app.use(fallback('index.html', {root: root}));

function getIcon(type) {
    switch (type.toLowerCase()) {
        case "coffee":
            return "./assets/pub-sub/coffee.png";
        case "lunch":
            return "./assets/pub-sub/lunch.png";
        case "alert":
            return "./assets/pub-sub/alert.png";
        default:
            return "./assets/pub-sub/logo.png";
    }
}

const server = app.listen(port, function() {
    const address = server.address();
    const port = address.port;

    console.log('App is listening on port %s...', port);
});
