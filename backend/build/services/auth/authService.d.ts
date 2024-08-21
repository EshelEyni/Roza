import { User, UserCredenitials } from "../../../../shared/types/user";
type UserAuthResult = {
    user: User;
    token: string;
};
declare function login(username: string, password: string): Promise<UserAuthResult>;
declare function loginWithToken(loginToken: string): Promise<UserAuthResult>;
declare function signup(userCreds: UserCredenitials): Promise<UserAuthResult>;
declare function updatePassword(loggedInUserId: string, currentPassword: string, newPassword: string, newPasswordConfirm: string): Promise<UserAuthResult>;
declare function resetPassword(token: string, password: string, passwordConfirm: string): Promise<UserAuthResult>;
declare const _default: {
    login: typeof login;
    loginWithToken: typeof loginWithToken;
    signup: typeof signup;
    resetPassword: typeof resetPassword;
    updatePassword: typeof updatePassword;
};
export default _default;
