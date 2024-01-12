const express = require('express');

const {connect, close, createUser, loginUser, findUserByID, findUserByUsername, friendRequest, acceptFriendRequest, getFriends,  rejectFriendRequest, changeMood, getMood, areFriends, getFriendsUsername} = require('./mongo_functions');
const { ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const port = process.env.PORT;

const secretKey = process.env.JWT_SIGN;


app.use(express.json());
app.use(cookieParser());
app.use(express.static(__dirname + '/public'));


app.get("/login", (req, res) =>{

    res.sendFile(__dirname + "/html-files/login.html");
});
app.get("/", (req, res) =>{
  const decoded = verifyToken(req, res);
  if(decoded){
  res.sendFile(__dirname + "/html-files/index.html");
  }
  
});



app.post('/api/signup', (req, res) => {
    if (req.body.username === undefined || req.body.password === undefined) {
        res.status(400).json({error: "Username or password not provided"});
        return;
    }
    const user = req.body;
    if(user.username.length < 8 || user.username.length > 15 || user.password.length < 8)
    {
      res.status(400).json({error: "Invalid length for username or password"});
      return;
    }
    createUser(user).then(result => {
        res.status(result).send();
    }).catch(error => {
      res.status(500).send();
      console.error(error);
    });
    
});

app.post('/api/login', (req, res) => {
    const user = req.body;
    if (user.username === undefined || user.password === undefined) {
        res.status(400).json({error: "Username or password not provided"});
        return;
    }
    
    loginUser(user).then(result => {
        if (result === 200) {
          findUserByUsername(user.username).then(user => {
            const token = jwt.sign( {id: user._id.toString()} , secretKey, { expiresIn: "1h" });
            res.cookie('jwt', token);
             res.json({ message: 'Login successful' });
          }).catch(error => {
            res.status(500).send();
            console.error(error);
          });
        }else {
          res.status(result).json({error: "Invalid username or password"});
        }
        
    }).catch(error => {
      res.status(500).send();
      console.error(error);
    });
    
});
app.post('/api/sendFriendRequest', (req, res) => {
  const friend_username = req.body.username;
  if (friend_username === undefined) {
      res.status(400).json({error: "Username not provided"});
      return;
  }
  
  const decoded = verifyToken(req, res);
  if(!decoded)
  {
    return ;
  }
  
  const id = new ObjectId(decoded.id);
  friendRequest(id, friend_username).then(result => {
    res.status(result).send();
  }).catch(error => {
    res.status(500).send();
    console.error(error);
  });
 
});

app.post('/api/acceptFriendRequest', (req, res) => {
  const friend_username = req.body.username;
  if (friend_username === undefined) {
      res.status(400).json({error: "Username not provided"});
      return;
  }
  const decoded = verifyToken(req, res);
  if(!decoded)
  {
    return;
  }
  const id = new ObjectId(decoded.id);
  acceptFriendRequest(id, friend_username).then(result => {
    res.status(result).send();
  }).catch(error => {
    res.status(500).send();
    console.error(error);
  });
 
});
app.post('/api/rejectFriendRequest', (req, res) => {
  const friend_username = req.body.username;
  if (friend_username === undefined) {
      res.status(400).json({error: "Username not provided"});
      return;
  }
  const decoded = verifyToken(req, res);
  if(!decoded)
  {
    return;
  }
  const id = new ObjectId(decoded.id);
  rejectFriendRequest(id, friend_username).then(result => {
    res.status(result).send();
  }).catch(error => {
    res.status(500).send();
    console.error(error);
  });
 
});
app.get('/api/getFriends', (req, res) => {
  const decoded = verifyToken(req, res);
  if(!decoded)
  {
    return;
  }
  const id = new ObjectId(decoded.id);
  getFriends(id).then(result => {
    res.json(result);
  }).catch(error => {
    res.status(500).send();
    console.error(error);
  });
 
}
);
app.get('/api/getFriendsUsername', (req, res) => {
  const decoded = verifyToken(req, res);
  if(!decoded)
  {
    return;
  }
  const id = new ObjectId(decoded.id);
  getFriendsUsername(id).then(result => {
    res.json(result);
  }).catch(error => {
    res.status(500).send();
    console.error(error);
  });
 
});
app.post('/api/getMood', (req, res) => {
  const decoded = verifyToken(req, res);
  if(!decoded)
  {
    return;
  }
  const origin_id = new ObjectId(decoded.id);
  if(req.body.friend_id === undefined)
  {
    res.status(400).json({error: "Friend id not provided"});
    return;
  }
  const target_id = new ObjectId(req.body.friend_id);
  if(!areFriends(origin_id, target_id))
  {
    res.status(400).json({error: "You are not friends with this user"});
    return;
  }
  getMood(target_id).then(result => {
    if(result === 404)
    {
      res.status(404).json({error: "Mood not found"});
      return;
    }
    res.json(result);
  }).catch(error => {
    res.status(500).send();
    console.error(error);
  });
 
});
app.get("/api/getMyInfo", (req, res) => {
  const decoded = verifyToken(req, res);
  if(!decoded)
  {
    return;
  }
  const id = new ObjectId(decoded.id);
  var data = {};
  findUserByID(id).then(result => {
    
    data.username = result.username;
    
  }).catch(error => {
    res.status(500).send();
    console.error(error);
  });
  getMood(id).then(result => {
    if(result === 404)
    {
      res.status(404).json({error: "Mood not found"});
      return;
    }
    data.mood = result.mood;
    res.json(data);
  }).catch(error => {
    res.status(500).send();
    console.error(error);
  });
});



var users = {};

io.on('connection', (socket) => {
  try
  {
    const token = socket.handshake.query.jwt;
    
    const decoded = jwt.verify(token, secretKey);

    const id = decoded.id;
    users[id] = socket;
    socket.userId = id;
  }catch(error){
    
  }
  // Send a welcome message when a client connects
  socket.on('change-mood', (mood) => {
    
    var userID = new ObjectId(socket.userId);
    getFriendsUsername(userID).then(result => {
      result.forEach(friend => {
        if(users[friend.id.toString()] && friend.status === "accepted")
        {
          var data = {
            mood: mood.mood,
            id: socket.userId
          }
          users[friend.id.toString()].emit('mood-change', data);
        }
      });
    }).catch(error => {
      console.error(error);
    });
    changeMood(userID, mood.mood).then(result => {
      if(result === 404)
      {
        console.log("Mood not found");
      }
      
    }).catch(error => {
      console.error(error);
    });
  });
 
  // Handle disconnects
  socket.on('disconnect', () => {
    delete users[socket.userId];
  });
});


server.listen(port, () => {
  console.log(`Server is running on PORT:${port}`);
});

function verifyToken(req, res) {
  const token = req.cookies.jwt;
  if (!token) {
    
    return res.redirect("/login");
  }

  try {
    const decoded = jwt.verify(token, secretKey);
    return decoded;
  } catch (error) {
    
    return res.redirect("/login");
  }
}