const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: {
    type: String,
    minlength: 6,
    required: function () {
      return this.authProvider !== 'google';
    }
  },
  authProvider: { type: String, enum: ['password', 'google'], default: 'password' },
  googleId: { type: String, unique: true, sparse: true },
  avatar: { type: String, default: '' },
  isGuest: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  // 10 rounds: industry standard (~100ms). 12 rounds (~700ms) causes an
  // async timing race with Mongoose 8.x's internal toJSON transform pipeline.
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function () {
  // toObject() returns a plain JS copy — safe to mutate.
  // Never delete from `this` directly as that corrupts the live document.
  const obj = this.toObject({ versionKey: false });
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
