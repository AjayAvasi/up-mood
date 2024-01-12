const { MongoClient } = require('mongodb');
const { ReadPreference } = require('mongodb');
const {createConnection, init_conections, is_pool_full, get_connection, return_connection} = require("./mongo_pool_manager.js")

const mongoUrl = process.env.MONGO_URL;
const dbName = 'up-mood';


const crypto = require('crypto');
init_conections(10);

async function createUser(user) {
    const client = get_connection();
    try {
        
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection('users');
        const existingUser = await collection.findOne({ "username": user.username });

        if (existingUser) {
            return 409;
        }

        user.password = sha256Hash(user.password);
        await collection.insertOne(user);

        const moodsCollection = db.collection('moods');
        const newMood = {
            "user_id": user._id,
            "mood": "😊",
            "date": new Date()
        };

        await moodsCollection.insertOne(newMood);
        return 200;
    } catch (error) {
        console.error('Error creating user:', error);
        return 500;
    } finally {
        await client.close();
        return_connection(client);
    }
}

async function loginUser(user) {
    const client = get_connection();
    try {
        
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection('users');
        const existingUser = await collection.findOne({ "username": user.username, "password": sha256Hash(user.password) });

        if (!existingUser) {
            return 401;
        }

        return 200;
    } catch (error) {
        console.error('Error login user:', error);
        return 500;
    } finally {
        await client.close();
        return_connection(client);
    }
}

async function findUserByID(id) {
    const client = get_connection();
    try {
        
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection('users');
        const existingUser = await collection.findOne({ "_id": id });
        return existingUser;
    } catch (error) {
        console.error('Error finding user:', error);
        return 500;
    } finally {
        await client.close();
        return_connection(client);
    }
}

async function findUserByUsername(username) {
    const client = get_connection();
    try {
        
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection('users');
        const existingUser = await collection.findOne({ "username": username });
        return existingUser;
    } catch (error) {
        console.error('Error finding user:', error);
        return 500;
    } finally {
        await client.close();
        return_connection(client);
    }
}

async function friendRequest(user_id, friend_username) {
    const client = get_connection();
    try {
        
        const friendUser = await findUserByUsername(friend_username);
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection('friends');

        if (!friendUser) {
            return 404;
        }

        const friend_id = friendUser._id;
        const existingFriendRequest = await collection.findOne({
            "$or": [
                { "origin": user_id, "target": friend_id },
                { "origin": friend_id, "target": user_id }
            ]
        });

        if (existingFriendRequest) {
            return 409;
        }

        await collection.insertOne({ "origin": user_id, "target": friend_id, "status": "pending" });
        return 200;
    } catch (error) {
        console.error('Error requesting friend from user:', error);
        return 500;
    } finally {
        await client.close();
        return_connection(client);
    }
}

async function acceptFriendRequest(user_id, friend_username) {
    const client = get_connection();
    try {
        
        const friendUser = await findUserByUsername(friend_username);
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection('friends');
        const friend_id = friendUser._id;
        const existingFriendRequest = await collection.findOne({
            "origin": friend_id,
            "target": user_id,
            "status": "pending"
        });

        if (!existingFriendRequest) {
            return 404;
        }

        await collection.updateOne({ "origin": friend_id, "target": user_id }, { $set: { "status": "accepted" } });
        return 200;
    } catch (error) {
        console.error('Error accepting friend request:', error);
        return 500;
    } finally {
        await client.close();
        return_connection(client);
    }
}

async function rejectFriendRequest(user_id, friend_username) {
    const client = get_connection();
    try {
        
        const friendUser = await findUserByUsername(friend_username);
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection('friends');
        const friend_id = friendUser._id;
        const existingFriendRequest = await collection.findOne({
            "origin": friend_id,
            "target": user_id,
            "status": "pending"
        });

        if (!existingFriendRequest) {
            return 404;
        }

        await collection.deleteOne({ "origin": friend_id, "target": user_id });
        return 200;
    } catch (error) {
        console.error('Error rejecting friend request:', error);
        return 500;
    } finally {
        await client.close();
        return_connection(client);
    }
}

async function getFriends(user_id) {
    const client = get_connection();
    try {
        
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection('friends');
        const existingFriends = await collection.find({
            "$or": [
                { "origin": user_id },
                { "target": user_id }
            ]
        }).toArray();

        return existingFriends;
    } catch (error) {
        console.error('Error getting friends:', error);
        return 500;
    } finally {
        await client.close();
        return_connection(client);
    }
}

async function getFriendsUsername(user_id) {
    try {
        
        var friends = [];
        var temp = await getFriends(user_id);

        temp.forEach(async function (friend, index, array) {
            friends.push(friend);
        });

        var friendsUsername = [];

        for (var i = 0; i < friends.length; i++) {
            var friend = friends[i];
            var friend_id = friend.origin;
            var from = "origin";

            if (friend.origin.equals(user_id)) {
                friend_id = friend.target;
                from = "target";
            }

            var friendUser = await findUserByID(friend_id);
            var friend_relation = {
                "username": friendUser.username,
                "id": friendUser._id,
                "status": friend.status,
                "from": from
            };
            if (friend_relation.status === "accepted")
            {
                var mood = await getMood(friendUser._id);
                friend_relation.mood = mood.mood;
            }

            friendsUsername.push(friend_relation);
        }

        return friendsUsername;
    } catch (error) {
        console.error('Error getting friends usernames:', error);
        return 500;
    } finally {
        
    }
}

async function changeMood(user_id, mood) {
    const client = get_connection();
    try {
        
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection('moods');
        await collection.updateOne({ "user_id": user_id }, { $set: { "mood": mood, "date": new Date() } });
        return 200;
    } catch (error) {
        console.error('Error changing mood:', error);
        return 500;
    } finally {
        await client.close();
        return_connection(client);
    }
}

async function getMood(user_id) {
    const client = get_connection();
    try {
        
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection('moods');
        const existingMood = await collection.findOne({ "user_id": user_id });

        if (!existingMood) {
            return 404;
        }

        return existingMood;
    } catch (error) {
        console.error('Error getting mood:', error);
        return 500;
    } finally {
        await client.close();
        return_connection(client);
    }
}

async function areFriends(user_id, friend_id) {
    const client = get_connection();
    try {
       
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection('friends');
        const existingFriend = await collection.findOne({
            "$or": [
                { "origin": user_id, "target": friend_id },
                { "origin": friend_id, "target": user_id }
            ],
            "status": "accepted"
        });

        return existingFriend;
    } catch (error) {
        console.error('Error checking friendship:', error);
        return 500;
    } finally {
        await client.close();
        return_connection(client);
    }
}

function sha256Hash(inputString) {
    const changeKey = process.env.CHANGE_KEY;
    const hash = crypto.createHash('sha256');
    hash.update(inputString + changeKey);
    return hash.digest('hex');
}

module.exports = {
    createUser,
    loginUser,
    findUserByID,
    findUserByUsername,
    friendRequest,
    acceptFriendRequest,
    getFriends,
    rejectFriendRequest,
    changeMood,
    getMood,
    areFriends,
    getFriendsUsername
};
