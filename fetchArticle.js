const fs = require("fs");
const axios = require("axios");
const { execSync } = require("child_process");

async function run() {
  const date = new Date().toISOString().split("T")[0];
  const fileName = `${date}.md`;

  try {
    const response = await axios.get(
      "https://dev.to/api/articles?top=1&tag=javascript"
    );

    const article = response.data[0];
    const content = `# ${article.title}\n\n**Author:** ${article.user.name}\n\n**Published:** ${article.readable_publish_date}\n\n**Tags:** ${article.tag_list.join(", ")}\n\n**Link:** [Read on DEV.to](${article.url})\n\n---\n\n${article.description}`;

    fs.writeFileSync(`articles/${fileName}`, content);

    execSync("git add .");
    execSync(`git commit -m "Add article for ${date}"`);
    execSync("git push");

    console.log(`Committed article: ${fileName}`);
  } catch (error) {
    console.error("Failed to fetch article:", error.message);
  }
}

run();

