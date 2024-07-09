import { FC } from "react";

interface ErrorFallBackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

export const ErrorFallBack: FC<ErrorFallBackProps> = ({
  error,
  resetErrorBoundary,
}) => {
  const isDevEnv = process.env.NODE_ENV === "development";
  return (
    <main className="flex h-screen flex-col items-center bg-gray-100">
      <div className="flex max-w-[550px] flex-col items-center justify-center">
        <h1 className="mb-2 mt-20 text-2xl font-semibold text-gray-800">
          Oops! Something went wrong.
        </h1>
        <p className="mb-4 text-gray-600">
          We apologize for the inconvenience. You can either try reloading the
          page or go back to the home page.
        </p>

        {isDevEnv && (
          <div className="self-start p-2">
            <p className="text-xl">{error.message}</p>
            <p>{error.stack}</p>
          </div>
        )}

        <div className="mt-6 flex justify-center space-x-4">
          <button
            onClick={() => window.location.reload()}
            className="rounded bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-300"
          >
            Reload
          </button>
          <button
            onClick={resetErrorBoundary}
            className="rounded bg-gray-300 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
          >
            Home
          </button>
        </div>
      </div>
    </main>
  );
};
