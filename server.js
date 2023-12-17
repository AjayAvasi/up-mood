const express = require('express');
const {connect, close, createUser, loginUser, findUserByID, findUserByUsername, friendRequest, acceptFriendRequest, getFriends} = require('./mongo_functions');
const { ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const app = express();
const port = 3000;

secretKey = "akjfhasdkjlfhkjsdf";



app.use(express.json());
app.use(cookieParser());
app.use(express.static(__dirname + '/public'));

app.get('/', (req, res) => {
  if(!req.cookies.jwt) {
    res.redirect('/login');
  }else {
    res.sendFile(__dirname + '/public/index.html');
  }
});
app.get('/login', (req, res) => {
  res.sendFile(__dirname + '/public/login.html');
}); 



app.post('/api/signup', (req, res) => {

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
          res.status(result).send();
        }
        
    }).catch(error => {
      res.status(500).send();
      console.error(error);
    });
    
});
app.post('/api/sendFriendRequest', (req, res) => {
  const friend_username = req.body.username;
  const token = req.cookies.jwt;
  const decoded = jwt.verify(token, secretKey);
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
  const token = req.cookies.jwt;
  const decoded = jwt.verify(token, secretKey);
  const id = new ObjectId(decoded.id);
  acceptFriendRequest(id, friend_username).then(result => {
    res.status(result).send();
  }).catch(error => {
    res.status(500).send();
    console.error(error);
  });
 
});
app.get('/api/getFriends', (req, res) => {
  const token = req.cookies.jwt;
  const decoded = jwt.verify(token, secretKey);
  const id = new ObjectId(decoded.id);
  getFriends(id).then(result => {
    res.json(result);
  }).catch(error => {
    res.status(500).send();
    console.error(error);
  });
 
}
);



app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});