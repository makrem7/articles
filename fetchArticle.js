const fs = require("fs");
const axios = require("axios");
const { execSync } = require("child_process");

const TAGS = [
  "devops", "git", "flutter", "javascript", "node", "angular",
  "ai", "prompt-engineering", "mongodb", "database", "sql", "nosql", "mysql",
  "react", "docker", "cicd", "kubernetes", "postgresql", "webdev", "cloud"
];

function getRandomTag() {
  return TAGS[Math.floor(Math.random() * TAGS.length)];
}

async function fetchArticle(tag) {
  const res = await axios.get(`https://dev.to/api/articles?tag=${tag}&per_page=1`);
  return res.data[0]; // top article
}

function updateReadme(article, date, fileName) {
  const preview = `# ${article.title}\n\n` +
    `**Author:** ${article.user.name}\n\n` +
    `**Published:** ${article.readable_publish_date}\n\n` +
    `**Tags:** ${article.tag_list.join(", ")}\n\n` +
    `**Link:** [Read on DEV.to](${article.url})\n\n---\n\n` +
    `${article.description}\n\n`;

  // Save full article to Markdown file
  fs.writeFileSync(`articles/${fileName}`, preview);

  // Update README preview section
  const readmeContent = fs.existsSync("README.md") ? fs.readFileSync("README.md", "utf8") : "";
  const newEntry = `### 📅 ${date}\n[${article.title}](articles/${fileName}) — _${article.tag_list.join(", ")}_\n\n`;
  const newReadme =
    `# 📰 Daily Dev Articles Bot\n\n` +
    `This repository automatically fetches a daily article about trending software development topics.\n\n` +
    `## 📌 Recent Articles\n\n` +
    newEntry +
    (readmeContent.split("## 📌 Recent Articles\n\n")[1] || "")
      .split("\n").slice(0, 20).join("\n") +  // Keep only the latest 20 articles
    `\n\n---\n\n` +
    `## 🤖 Topics Covered\n${TAGS.map(t => `- ${t}`).join("\n")}\n\n` +
    `## 🔄 Auto Updated Daily via VPS & Node.js\n`;

  fs.writeFileSync("README.md", newReadme);
}

async function run() {
  const tag = getRandomTag();
  const date = new Date().toISOString().split("T")[0];
  const fileName = `${date}.md`;

  try {
    const article = await fetchArticle(tag);
    updateReadme(article, date, fileName);

    execSync("git add .");
    execSync(`git commit -m "📝 Add article for ${date}: ${article.title}"`);
    execSync("git push");
    console.log(`✅ Article fetched and committed: ${fileName}`);
  } catch (err) {
    console.error("❌ Failed to fetch or commit article:", err.message);
  }
}

run();
