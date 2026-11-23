const { Schema, model } = require('mongoose');
const { ROLE_LIST, ROLES } = require('../constants/roles');

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLE_LIST, default: ROLES.MEMBER },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

module.exports = model('User', userSchema);
