const nodeSchedule = require('node-schedule');

function schedule(year, month, day, h, m, s, callback) {
    nodeSchedule.scheduleJob(new Date(year, month, day, h, m, s), callback);
}

module.exports.schedule = schedule;