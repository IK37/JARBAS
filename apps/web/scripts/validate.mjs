import { access } from "node:fs/promises";

await Promise.all(["index.html", "app.js", "styles.css"].map((file) => access(new URL(`../public/${file}`, import.meta.url))));
