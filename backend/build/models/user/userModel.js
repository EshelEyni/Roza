"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserModel = exports.userSchema = void 0;
const mongoose_1 = require("mongoose");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const userSchema = new mongoose_1.Schema({
    username: {
        type: String,
        required: [true, "Please provide a username"],
        unique: true,
        trim: true,
        validate: {
            validator: function (v) {
                return v.length >= 3 && v.length <= 20;
            },
            message: "username must be between 3 and 20 characters",
        },
    },
    password: {
        type: String,
        required: [true, "Please provide a password"],
        validate: {
            validator: function (v) {
                return v.length >= 8 && v.length <= 20;
            },
            message: "password must be between 8 and 20 characters",
        },
    },
    passwordConfirm: {
        type: String,
        required: [true, "Please confirm your password"],
        validate: {
            validator: function (v) {
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
            validator: function (v) {
                return /\S+@\S+\.\S+/.test(v);
            },
            message: "Please provide a valid email",
        },
    },
    roles: { type: [String], default: ["user"] },
    lastVisitedPage: { type: String, default: "" },
    language: { type: String, default: "" },
    active: { type: Boolean, default: true },
    loginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Number, default: 0 },
    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
}, {
    toObject: {
        virtuals: true,
        transform: (_, ret) => {
            _removePrivateFields(ret);
            return ret;
        },
    },
    toJSON: {
        virtuals: true,
        transform: (_, ret) => {
            _removePrivateFields(ret);
            return ret;
        },
    },
    timestamps: true,
});
exports.userSchema = userSchema;
userSchema.index({ username: 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: true });
userSchema.pre(/^find/, function (next) {
    const options = this.getOptions();
    if (options.active === false)
        return next();
    this.find({ active: { $ne: false } });
    next();
});
userSchema.pre("save", function (next) {
    return __awaiter(this, void 0, void 0, function* () {
        // Password is only modified when creating a new user or updating the password after a reset
        const isPasswordModified = this.isModified("password");
        if (!isPasswordModified)
            return next();
        this.password = yield bcryptjs_1.default.hash(this.password, 12);
        this.passwordConfirm = "";
        next();
    });
});
userSchema.methods.checkPassword = function (candidatePassword, userPassword) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield bcryptjs_1.default.compare(candidatePassword, userPassword);
    });
};
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
    if (!this.passwordChangedAt)
        return false;
    const changedTimestamp = Math.floor(this.passwordChangedAt.getTime() / 1000);
    return JWTTimestamp < changedTimestamp;
};
userSchema.methods.createPasswordResetToken = function () {
    const resetToken = crypto_1.default.randomBytes(32).toString("hex");
    this.passwordResetToken = crypto_1.default.createHash("sha256").update(resetToken).digest("hex");
    const TEN_MINUTES = 10 * 60 * 1000;
    this.passwordResetExpires = Date.now() + TEN_MINUTES;
    return resetToken;
};
function _removePrivateFields(doc) {
    delete doc._id;
    delete doc.password;
    delete doc.passwordConfirm;
    delete doc.active;
    delete doc.loginAttempts;
    delete doc.lockedUntil;
}
const UserModel = (0, mongoose_1.model)("User", userSchema);
exports.UserModel = UserModel;
//# sourceMappingURL=userModel.js.map