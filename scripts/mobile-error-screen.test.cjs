// Run with node scripts/mobile-error-screen.test.cjs (requires Playwright Chromium).
const assert = require("node:assert/strict");
const path = require("node:path");
const { createRequire } = require("node:module");
const frontend = path.resolve(__dirname, "../frontend");
const localRequire = createRequire(path.join(frontend, "package.json"));
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  const sass = localRequire("sass").compile(
    path.join(frontend, "src/styles/main.scss"),
  ).css;
  const css = await localRequire("postcss")([
    localRequire("tailwindcss")({
      ...localRequire("./tailwind.config.cjs"),
      content: [path.join(frontend, "src/**/*.{ts,tsx}").replaceAll("\\", "/")],
    }),
  ]).process(
    "@tailwind base; @tailwind components; @tailwind utilities;\n" + sass,
    { from: path.join(frontend, "src/index.css") },
  );
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    for (const mode of ["development", "production"]) {
      const bundle = await localRequire("esbuild").build({
        stdin: {
          contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {ErrorBoundary} from 'react-error-boundary'; import {ErrorFallBack} from './src/components/App/ErrorFallBack'; function Crash(){throw new Error('TECHNICAL_SECRET_' + 'x'.repeat(2000));} createRoot(document.getElementById('root')).render(<ErrorBoundary FallbackComponent={ErrorFallBack} onReset={()=>{window.homeClicked=true;}}><Crash/></ErrorBoundary>);`,
          resolveDir: frontend,
          loader: "tsx",
        },
        bundle: true,
        write: false,
        jsx: "automatic",
        define: { "process.env.NODE_ENV": JSON.stringify(mode) },
      });
      const page = await browser.newPage();
      const logs = [];
      page.on("console", (msg) => logs.push(msg.text()));
      page.on("pageerror", (err) => logs.push(err.stack));
      for (const [width, height] of [
        [320, 568],
        [390, 844],
        [767, 600],
        [768, 900],
        [1440, 900],
      ]) {
        await page.setViewportSize({ width, height });
        await page.setContent(`<style>${css.css}</style><div id="root"></div>`);
        await page.addScriptTag({ content: bundle.outputFiles[0].text });
        await page
          .getByRole("button", { name: "Reload", exact: true })
          .waitFor();
        const text = await page.locator("main").innerText();
        if (width < 768) {
          assert.equal(
            text.replace(/\s+/g, " ").trim(),
            "Something went wrong. Please try again. Reload Home",
          );
          const box = await page.locator("main > div").boundingBox();
          assert.ok(Math.abs(box.y + box.height / 2 - height / 2) < 2);
        } else {
          assert.ok(text.includes("Oops! Something went wrong."));
          assert.equal(
            text.includes("TECHNICAL_SECRET_"),
            mode === "development",
          );
        }
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        );
        await page.getByRole("button", { name: "Home", exact: true }).click();
        assert.equal(await page.evaluate(() => window.homeClicked), true);
        console.log(`${mode} ${width}x${height}: passed`);
      }
      if (mode === "development")
        assert.ok(
          logs.some((text) => text.includes("TECHNICAL_SECRET_")),
          "Full error remains in development logs",
        );
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
