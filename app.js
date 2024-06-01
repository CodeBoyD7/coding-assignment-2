const express = require('express')
const app = express()
const path = require('path')
const dbPath = path.join('twitterClone.db')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const {format} = require('date-fns')
let db = null
app.use(express.json())

const connectDB = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server is running on http://localhost:3000/')
    })

    console.log('data base is connected to')
  } catch (err) {
    console.error('Error at Connection ', err)
    process.exit(1)
  }
}

connectDB()

app.post('/register/', async (req, res) => {
  const {username, password, name, gender} = req.body
  const usrname = await db.get(`SELECT username FROM user WHERE username = ?`, [
    username,
  ])
  if (!username || !password || !name || gender) {
    res.send('required all fields')
  }

  if (usrname) {
    return res.status(400).send('User already exists')
  }
  const hashedPassword = await bcrypt.hash(password, 10)
  if (password.length < 6) {
    return res.status(400).send('Password is too short')
  }
  await db.run(
    `insert into user(name,username,password,gender) values (?,?,?,?)`,
    [name, username, hashedPassword, gender],
  )
  res.status(200).send('User created successfully')
})

app.post('/login/', async (req, res) => {
  const {username, password} = req.body
  const userDetails = await db.get(`SELECT * FROM user WHERE username = ?`, [
    username,
  ])
  if (!userDetails.username) {
    res.status(400).send('Invalid user')
  }

  if (!(await bcrypt.compare(password, userDetails.password))) {
    res.status(400).send('Invalid password')
  }
  let payload = {
    id: userDetails.id,
    username: userDetails.username,
  }
  let secretKey = userDetails.password
  const createToken = jwt.sign(payload, secretKey)
  res.status(200).send(createToken)
})

app.get('/user/tweets/feed/', async (req, res) => {
  try {
    const usersDetails =
      await db.all(`SELECT username, tweet, date_time AS dateTime FROM user INNER JOIN tweet ON (user.user_id = tweet.user_id) ORDER BY date_time DESC LIMIT 4
    `)
    return res.status(200).send(usersDetails)
  } catch (error) {
    console.error('Error fetching user tweets:', error)
    return res.status(500).send('Internal server error')
  }
})

app.get('/user/following/', async (req, res) => {
  try {
    const followingList = await db.all(
      `SELECT DISTINCT name FROM user INNER JOIN follower ON (user.user_id = follower.following_user_id) ORDER BY follower_id ASC;`,
    )
    return res.status(200).json(followingList)
  } catch (err) {
    return res.status(400).send('error not found connection ' + err)
  }
})

app.get('/user/followers/', async (req, res) => {
  try {
    const getFollowers = await db.all(
      `select DISTINCT name from user inner join follower on (follower.follower_user_id = user.user_id)`,
    )
    return res.status(200).json(getFollowers)
  } catch (err) {
    return res.status(400).send(err)
  }
})
app.get('/tweets/:tweetId/likes/', async (req, res) => {
  try {
    const whoLiked = await db.all(
      `select user.username from like left join user on (like.user_id = user.user_id) where tweet_id=?`,
      [req.params.tweetId],
    )
    const arr = {likes: whoLiked.map(data => data.username)}
    if (!whoLiked) {
      return res.status(401).send('Invalid Request')
    }
    return res.status(200).json(arr)
  } catch (err) {
    return res.status(401).send(err)
  }
})

app.get('/tweets/:tweetId/replies/', async (req, res) => {
  try {
    const repliesDetails = await db.all(
      `select reply,name,user.user_id from reply inner join user on (reply.user_id = user.user_id) where tweet_id = ?`,
      [req.params.tweetId],
    )
    const replyArr = {
      replies: repliesDetails.map(data => ({
        name: data.name,
        reply: data.reply,
      })),
    }
    if (!repliesDetails) {
      return res.status(401).send('Invalid Request')
    }
    return res.status(200).json(replyArr)
  } catch (err) {
    return res.status(400).send(err)
  }
})

app.get('/user/tweets', async (req, res) => {
  try {
    const tweetArr = await db.all(
      `select tweet.tweet, COUNT(DISTINCT like_id) as likes,COUNT(DISTINCT reply_id) as replies,date_time as dateTime  from tweet left join like on (tweet.tweet_id = like.tweet_id) left join reply on (tweet.tweet_id = reply.tweet_id) GROUP BY tweet.tweet_id`,
    )

    return res.status(200).json(tweetArr)
  } catch (err) {
    return res.status(400).send(err)
  }
})

app.post('/user/tweets/', async (req, res) => {
  try {
    const newTweet = {
      tweet: req.body.tweet,
      date_time: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
    }
    if (
      await db.run(`insert into tweet(tweet,date_time) values (?,?)`, [
        newTweet.tweet,
        newTweet.date_time,
      ])
    ) {
      return res.status(200).json('Created a Tweet')
    }
  } catch (err) {
    return res.status(400).send(err)
  }
})

app.delete('/tweets/:tweetId', async (req, res) => {
  try {
    if (
      await db.run(`delete from tweet where tweet_id = ?`, [req.params.tweetId])
    ) {
      return res.status(200).send('Tweet Removed')
    }
    return res.status(401).send('Invalid Request')
  } catch (err) {
    return res.status(400).send(err)
  }
})

export default app
