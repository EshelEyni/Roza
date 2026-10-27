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
    <main className="flex min-h-dvh w-full flex-col items-center justify-center bg-gray-100 p-4 md:justify-start">
      <div className="flex w-full min-w-0 max-w-[550px] flex-col items-center justify-center">
        <h1 className="text-center text-2xl font-semibold text-gray-800 md:hidden">
          Something went wrong. Please try again.
        </h1>
        <h1 className="mb-2 mt-20 hidden text-2xl font-semibold text-gray-800 md:block">
          Oops! Something went wrong.
        </h1>
        <p className="mb-4 hidden text-gray-600 md:block">
          We apologize for the inconvenience. You can either try reloading the
          page or go back to the home page.
        </p>

        {isDevEnv && (
          <div className="hidden w-full min-w-0 self-start break-words p-2 md:block">
            <p className="text-xl">{error.message}</p>
            <p>{error.stack}</p>
          </div>
        )}

        <div className="mt-6 flex flex-wrap justify-center gap-4">
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
