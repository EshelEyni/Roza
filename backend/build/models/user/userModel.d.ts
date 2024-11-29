import { Document, Schema } from "mongoose";
import { IUser } from "../../types/iTypes";
declare const userSchema: Schema<IUser>;
declare const UserModel: import("mongoose").Model<IUser, {}, {}, {}, Document<unknown, {}, IUser> & IUser & Required<{
    _id: unknown;
}>, any>;
export { userSchema, UserModel };
