const { MongoClient } = require('mongodb');
const { ReadPreference } = require('mongodb');

const mongoUrl = 'mongodb://localhost:27017';
const dbName = 'up-mood';
var connections = [];

function createConnection() {
    const client = new MongoClient(mongoUrl);
    return client;
}
function init_conections(pool_size) {
    for (let i = 0; i < pool_size; i++) {
        connections[i] = createConnection();
    }
}
function is_pool_full() {
    return connections.length === 0;
}
function get_connection() {
    if (!is_pool_full()) {
        return connections.pop();
    }
    return null;
}
function return_connection(connection) {
    connections.push(connection);
}
module.exports = {createConnection, init_conections, is_pool_full, get_connection, return_connection};