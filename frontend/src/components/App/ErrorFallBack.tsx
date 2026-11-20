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
    <main className="flex min-h-dvh w-full flex-col items-center justify-center bg-[var(--roza-bg)] p-4 text-[color:var(--roza-ink)] md:justify-start">
      <div className="flex w-full min-w-0 max-w-[550px] flex-col items-center justify-center">
        <h1 className="text-center font-[Georgia,serif] text-2xl md:hidden">
          Something went wrong. Please try again.
        </h1>
        <h1 className="mb-2 mt-20 hidden font-[Georgia,serif] text-3xl md:block">
          Oops! Something went wrong.
        </h1>
        <p className="mb-4 hidden text-[color:var(--roza-ink-2)] md:block">
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
            className="ui-btn ui-btn-primary"
          >
            Reload
          </button>
          <button
            onClick={resetErrorBoundary}
            className="ui-btn"
          >
            Home
          </button>
        </div>
      </div>
    </main>
  );
};
