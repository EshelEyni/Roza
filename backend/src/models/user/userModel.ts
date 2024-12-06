import { Document, Query, Schema, model } from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { IUser } from "../../types/iTypes";
import { User } from "../../../../shared/types/user";

const userSchema: Schema<IUser> = new Schema(
  {
    username: {
      type: String,
      required: [true, "Please provide a username"],
      unique: true,
      trim: true,
      validate: {
        validator: function (v: string) {
          return v.length >= 3 && v.length <= 20;
        },
        message: "username must be between 3 and 20 characters",
      },
    },
    password: {
      type: String,
      required: [true, "Please provide a password"],
      validate: {
        validator: function (v: string): boolean {
          return v.length >= 8 && v.length <= 20;
        },
        message: "password must be between 8 and 20 characters",
      },
    },
    passwordConfirm: {
      type: String,
      required: [true, "Please confirm your password"],
      validate: {
        validator: function (this: IUser, v: string): boolean {
          return v === this.password;
        },
        message: "passwords must match",
      },
    },
    fullname: { type: String, required: [true, "Please provide your full name"] },
    email: {
      type: String,
      required: [true, "Please provide your email"],
      unique: true,
      validate: {
        validator: function (v: string): boolean {
          return /\S+@\S+\.\S+/.test(v);
        },
        message: "Please provide a valid email",
      },
    },
    roles: { type: [String], default: ["user"] },
    lastVisitedPage: { type: String, default: "" },
    language: { type: String, default: "" },
    entityFilterOrder: {
      books: { type: String, default: "createdAt" },
      bookReviews: { type: String, default: "sortOrder" },
    },
    active: { type: Boolean, default: true },
    loginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Number, default: 0 },
    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
  },
  {
    toObject: {
      virtuals: true,
      transform: (_: Document, ret: Record<string, unknown>) => {
        _removePrivateFields(ret);
        return ret;
      },
    },
    toJSON: {
      virtuals: true,
      transform: (_: Document, ret: Record<string, unknown>) => {
        _removePrivateFields(ret);
        return ret;
      },
    },
    timestamps: true,
  },
);

userSchema.index({ username: 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: true });

userSchema.pre(/^find/, function (this: Query<User[], User & Document>, next) {
  const options = this.getOptions();
  if (options.active === false) return next();
  this.find({ active: { $ne: false } });
  next();
});

userSchema.pre("save", async function (next) {
  // Password is only modified when creating a new user or updating the password after a reset
  const isPasswordModified = this.isModified("password");
  if (!isPasswordModified) return next();
  this.password = await bcrypt.hash(this.password, 12);
  this.passwordConfirm = "";
  next();
});

userSchema.methods.checkPassword = async function (
  candidatePassword: string,
  userPassword: string,
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.changedPasswordAfter = function (JWTTimestamp: number) {
  if (!this.passwordChangedAt) return false;
  const changedTimestamp = Math.floor(this.passwordChangedAt.getTime() / 1000);
  return JWTTimestamp < changedTimestamp;
};

userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");
  this.passwordResetToken = crypto.createHash("sha256").update(resetToken).digest("hex");
  const TEN_MINUTES = 10 * 60 * 1000;
  this.passwordResetExpires = Date.now() + TEN_MINUTES;
  return resetToken;
};

function _removePrivateFields(doc: Record<string, unknown>) {
  delete doc._id;
  delete doc.password;
  delete doc.passwordConfirm;
  delete doc.active;
  delete doc.loginAttempts;
  delete doc.lockedUntil;
}

const UserModel = model<IUser>("User", userSchema);

export { userSchema, UserModel };
