import { FC } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { UserCredenitials } from "../../../../shared/types/user";
import { useSignup } from "../../hooks/ReactQuery/update/useSignup";
import { Button } from "../../components/Buttons/Button";

export const SignupForm: FC = () => {
  const { signup, isPending } = useSignup();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UserCredenitials>();

  const onSubmit: SubmitHandler<UserCredenitials> = data => {
    signup(data);
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="w-full max-w-sm rounded bg-white p-4 shadow-md"
    >
      <h2 className="mb-4 text-center text-2xl font-bold text-app-800">
        Sign Up
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
        <label className="mb-2 block font-bold text-app-700" htmlFor="fullname">
          Full Name
        </label>
        <input
          id="fullname"
          {...register("fullname", { required: true })}
          className="w-full rounded border py-2"
          type="text"
          placeholder="Full Name"
        />
        {errors.fullname && (
          <span className="text-red-500">Full Name is required</span>
        )}
      </div>
      <div className="mb-4">
        <label className="mb-2 block font-bold text-app-700" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          {...register("email", { required: true })}
          className="w-full rounded border py-2"
          type="email"
          placeholder="Email"
        />
        {errors.email && (
          <span className="text-red-500">Email is required</span>
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
      <div className="mb-4">
        <label
          className="mb-2 block font-bold text-app-700"
          htmlFor="passwordConfirm"
        >
          Confirm Password
        </label>
        <input
          id="passwordConfirm"
          {...register("passwordConfirm", { required: true })}
          className="w-full rounded border py-2"
          type="password"
          placeholder="Confirm Password"
        />
        {errors.passwordConfirm && (
          <span className="text-red-500">
            Password confirmation is required
          </span>
        )}
      </div>
      <div className="flex items-center justify-between">
        <Button
          type="submit"
          className="rounded bg-app-600 px-4 py-2 text-white"
          disabled={isPending}
        >
          {isPending ? "Signing up..." : "Sign Up"}
        </Button>
      </div>
    </form>
  );
};
