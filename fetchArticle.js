const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { execSync } = require("child_process");

// Change working directory to the git project
process.chdir("/home/ubuntu/github-projects/articles");

const topics = [
  "devops", "git", "flutter", "javascript", "nodejs", "angular",
  "technology", "ai", "prompts", "mongodb", "database", "sql", "nosql", "mysql",
  "typescript", "react", "docker", "kubernetes", "llm", "machinelearning"
];

function sanitizeFileName(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .substring(0, 60); // limit filename length
}

async function run() {
  const date = new Date().toISOString().split("T")[0];
  const tag = topics[Math.floor(Math.random() * topics.length)];
  const apiUrl = `https://dev.to/api/articles?top=1&tag=${tag}`;

  try {
    const response = await axios.get(apiUrl);
    const articles = response.data;

    if (!Array.isArray(articles) || articles.length === 0) {
      throw new Error(`No articles found for tag: ${tag}`);
    }

    const article = articles[0];
    const safeTitle = sanitizeFileName(article.title);
    const fileName = `${date}-${safeTitle}.md`;
    const filePath = path.join("articles", fileName);

    if (fs.existsSync(filePath)) {
      console.log(`ℹ️ File ${filePath} already exists. Skipping.`);
      return;
    }

    const content = `# ${article.title}\n\n**Author:** ${article.user.name}\n\n**Published:** ${article.readable_publish_date}\n\n**Tags:** ${article.tag_list.join(", ")}\n\n**Link:** [Read on DEV.to](${article.url})\n\n---\n\n${article.description || "No description provided."}`;

    fs.writeFileSync(filePath, content);
    console.log(`✅ Saved article: ${filePath}`);

    execSync("git add .");
    execSync(`git commit -m "Add article: ${article.title}"`);
    execSync("git push");
    console.log("🚀 Article committed and pushed.");
  } catch (error) {
    console.error("❌ Failed to fetch article:", error.message);
  }
}

run();
