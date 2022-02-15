const { Sequelize, DataTypes, Model } = require("sequelize");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

// const { STRING } = Sequelize;
const config = {
  logging: false,
};

if (process.env.LOGGING) {
  delete config.logging;
}
const conn = new Sequelize(
  process.env.DATABASE_URL || "postgres://localhost/acme_db",
  config
);

const User = conn.define("user", {
  username: DataTypes.STRING,
  password: DataTypes.STRING,
});

User.byToken = async (token) => {
  try {
    const { userId } = jwt.verify(token, process.env.SECRET_KEY);
    const user = await User.findByPk(userId, { include: Note });
    if (user) {
      return user;
    }
    const error = Error("bad credentials");
    error.status = 401;
    throw error;
  } catch (ex) {
    const error = Error("bad credentials");
    error.status = 401;
    throw error;
  }
};

User.authenticate = async ({ username, password }) => {
  const user = await User.findOne({
    where: {
      username,
    },
  });

  const match = bcrypt.compare(password, user.password);

  if (match) {
    const token = jwt.sign({ userId: user.id }, process.env.SECRET_KEY);
    return token;
  }
  const error = Error("bad credentials");
  error.status = 401;
  throw error;
};

const syncAndSeed = async () => {
  await conn.sync({ force: true });
  const credentials = [
    { username: "lucy", password: "lucy_pw" },
    { username: "moe", password: "moe_pw" },
    { username: "larry", password: "larry_pw" },
  ];
  const [lucy, moe, larry] = await Promise.all(
    credentials.map((credential) => User.create(credential))
  );
  const notes = [
    { text: "hello world" },
    { text: "my note" },
    { text: "buy groceries" },
  ];

  const [note1, note2, note3] = await Promise.all(
    notes.map((note) => Note.create(note))
  );

  await note1.setUser(lucy);
  await note2.setUser(moe);
  await note3.setUser(larry);

  return {
    users: {
      lucy,
      moe,
      larry,
    },
  };
};

User.beforeCreate(async (user, options) => {
  const hashedPw = await bcrypt.hash(user.password, 3);
  user.password = hashedPw;
});

//Notes model
const Note = conn.define("note", {
  text: {
    type: DataTypes.TEXT,
  },
});

User.hasMany(Note);
Note.belongsTo(User);

module.exports = {
  syncAndSeed,
  models: {
    User,
    Note,
  },
};
