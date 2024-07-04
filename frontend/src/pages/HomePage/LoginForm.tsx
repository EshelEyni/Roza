import { FC } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { LoginCredentials } from "../../../../shared/types/user";
import { useLogin } from "../../hooks/ReactQuery/update/useLogin";
import { Button } from "../../components/Button";

export const LoginForm: FC = () => {
  const { login, isPending } = useLogin();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginCredentials>();

  const onSubmit: SubmitHandler<LoginCredentials> = data => {
    login(data);
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="w-full max-w-sm rounded bg-white p-4 shadow-md"
    >
      <h2 className="mb-4 text-center text-2xl font-bold text-app-900">
        Log In
      </h2>
      <div className="mb-4">
        <label className="mb-2 block font-bold text-app-700" htmlFor="username">
          Username
        </label>
        <input
          id="username"
          {...register("username", { required: true })}
          className="w-full rounded border py-2"
          type="text"
          placeholder="Username"
        />
        {errors.username && (
          <span className="text-red-500">Username is required</span>
        )}
      </div>
      <div className="mb-4">
        <label className="mb-2 block font-bold text-app-700" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          {...register("password", { required: true })}
          className="w-full rounded border py-2"
          type="password"
          placeholder="Password"
        />
        {errors.password && (
          <span className="text-red-500">Password is required</span>
        )}
      </div>
      <div className="flex items-center justify-between">
        <Button
          type="submit"
          className="rounded bg-app-600 px-4 py-2 text-white"
          disabled={isPending}
        >
          {isPending ? "Logging in..." : "Log In"}
        </Button>
      </div>
    </form>
  );
};
