const { MongoClient } = require('mongodb');
const mongoUrl = 'mongodb://localhost:27017';
const dbName = 'up-mood';
const client = new MongoClient(mongoUrl); 
const crypto = require('crypto');



async function createUser(user) {
    try {
        // Connect to MongoDB
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection('users');

        // Check if the user already exists
        const existingUser = await collection.findOne({ "username": user.username });

        if (existingUser) {
            return 409; // Conflict - User already exists
        }
        user.password = sha256Hash(user.password);
        // Insert the new user
        await collection.insertOne(user);
        return 200; // OK - User created successfully
    } catch (error) {
        console.error('Error creating user:', error);
        return 500; // Internal Server Error
    } finally {
        await client.close();
    }
}
async function loginUser(user) {
    try {
        // Connect to MongoDB
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection('users');

        // Check if the user exists
        const existingUser = await collection.findOne({ "username": user.username, "password": sha256Hash(user.password) });

        if (!existingUser) {
            return 401; // Unauthorized - Invalid username or password
        }

        return 200; // OK - User logged in successfully
    } catch (error) {
        console.error('Error login user:', error);
        return 500; // Internal Server Error
    } finally {
        await client.close();
    }
}
async function findUserByID(id) {
    try {
        // Connect to MongoDB
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection('users');

        // Check if the user exists
        const existingUser = await collection.findOne({ "_id": id });

        return existingUser; // OK
    } catch (error) {
        console.error('Error finding user:', error);
        return 500; // Internal Server Error
    } finally {
        await client.close();
    }
}
async function findUserByUsername(username) {
    try {
        // Connect to MongoDB
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection('users');

        // Check if the user exists
        const existingUser = await collection.findOne({ "username": username });


        return existingUser; // OK
    } catch (error) {
        console.error('Error finding user:', error);
        return 500; // Internal Server Error
    } finally {
        await client.close();
    }
}

async function friendRequest(user_id, friend_username) {
    try {
        // Connect to MongoDB
        
        const friendUser = await findUserByUsername(friend_username);
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection('friends');
        if (!friendUser) {
            return 404; // Not Found - User not found
        }
        const friend_id = friendUser._id;
        const existingFriendRequest = await collection.findOne({"$or": [{"origin": user_id, "target": friend_id}, {"origin": friend_id, "target": user_id}]});
        if (existingFriendRequest) {
            return 409; // Conflict - Friend request already exists
        }
        await collection.insertOne({"origin": user_id, "target": friend_id, "status": "pending"});
        return 200; // OK - Friend request sent successfully
    } catch (error) {
        console.error('Error requesting friend from user:', error);
        return 500; // Internal Server Error
    } finally {
        await client.close();
    }
}

async function acceptFriendRequest(user_id, friend_username) {
    try {
        const friendUser = await findUserByUsername(friend_username);
        if (!friendUser) {
            return 404; // Not Found - User not found
        }
        const friend_id = friendUser._id;
        // Connect to MongoDB
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection('friends');

        // Check if the user exists
        const existingFriendRequest = await collection.findOne({"origin": friend_id, "target": user_id, "status": "pending"});
        if (!existingFriendRequest) {
            return 404; // Not Found - Friend request not found
        }
        await collection.updateOne({"origin": friend_id, "target": user_id}, {$set: {"status": "accepted"}});
        return 200; // OK - Friend request accepted successfully
    } catch (error) {
        console.error('Error accepting friend request:', error);
        return 500; // Internal Server Error
    } finally {
        await client.close();
    }
}
async function rejectFriendRequest(user_id, friend_username) {
    try {
        const friendUser = await findUserByUsername(friend_username);
        if (!friendUser) {
            return 404; // Not Found - User not found
        }
        const friend_id = friendUser._id;
        // Connect to MongoDB
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection('friends');

        // Check if the user exists
        const existingFriendRequest = await collection.findOne({"origin": friend_id, "target": user_id, "status": "pending"});
        if (!existingFriendRequest) {
            return 404; // Not Found - Friend request not found
        }
        await collection.deleteOne({"origin": friend_id, "target": user_id});
        return 200; // OK - Friend request accepted successfully
    } catch (error) {
        console.error('Error accepting friend request:', error);
        return 500; // Internal Server Error
    } finally {
        await client.close();
    }
}
async function getFriends(user_id) {
    try {
        // Connect to MongoDB
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection('friends');

        const existingFriends = await collection.find({"$or": [{"origin": user_id}, {"target": user_id}]}).toArray();
        return existingFriends; // OK
    } catch (error) {
        console.error('Error finding user:', error);
        return 500; // Internal Server Error
    } finally {
        await client.close();
    }
}
function sha256Hash(inputString) {
    const hash = crypto.createHash('sha256');
    hash.update(inputString + "ldjsakdlskaklsda");
    return hash.digest('hex');
  }
  

module.exports = { createUser, loginUser, findUserByID, findUserByUsername, friendRequest, acceptFriendRequest, getFriends};