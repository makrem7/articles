const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { execSync } = require("child_process");

// Change working directory to the git project
process.chdir("/home/ubuntu/github-projects/articles");

const topics = [
  "devops", "git", "flutter", "javascript", "node", "angular",
  "ai", "promptengineering", "mongodb", "mongoose", "datastructures", "database",
  "typescript", "dart", "docker", "kubernetes", "llm", "machinelearning",
  "news", "security", "linux", "mobile", "android", "ios", "cybersecurity"
];

function sanitizeFileName(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .substring(0, 60); // limit filename length
}

async function fetchArticle(attempt = 0) {
  if (attempt >= 5) {
    console.log(`🕒 [${new Date().toLocaleTimeString()}] Max attempts reached. Exiting.`);
    return null;
  }

  const tag = topics[Math.floor(Math.random() * topics.length)];
  const apiUrl = `https://dev.to/api/articles?top=1&tag=${tag}`;

  try {
    const response = await axios.get(apiUrl);
    const articles = response.data;

    if (!Array.isArray(articles) || articles.length === 0) {
      console.log(`🕒 [${new Date().toLocaleTimeString()}] No articles for ${tag}. Retrying...`);
      return fetchArticle(attempt + 1);
    }

    return articles[0];
  } catch (error) {
    console.log(`🕒 [${new Date().toLocaleTimeString()}] Fetch failed for ${tag}. Retrying...`);
    return fetchArticle(attempt + 1);
  }
}

function updateReadme(article) {
  const emojis = ["📚", "📖", "📝", "📓", "📕", "📗", "📘", "📙", "📔", "📒"];
  const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
  
  const readmeContent = `# Articles Collection ${randomEmoji}

A daily collection of interesting tech articles automatically fetched and committed.

## Latest Article Added

**${article.title}**  
👤 By ${article.user.name}  
📅 Published on ${article.readable_publish_date}  
🏷 Tags: ${article.tag_list.join(", ")}  

[Read on Dev.to](${article.url})

## How It Works

This repository is automatically updated daily with a new tech article from Dev.to. The selection is random across various tech topics.

_Last updated: ${new Date().toISOString()}_
`;

  fs.writeFileSync("README.md", readmeContent);
}

async function run() {
  const date = new Date().toISOString().split("T")[0];
  const article = await fetchArticle();

  if (!article) {
    console.log(`🕒 [${new Date().toLocaleTimeString()}] No suitable article found after retries.`);
    return;
  }

  const safeTitle = sanitizeFileName(article.title);
  const fileName = `${date}-${safeTitle}.md`;
  const filePath = path.join("articles", fileName);

  if (fs.existsSync(filePath)) {
    console.log(`🕒 [${new Date().toLocaleTimeString()}] Article exists. Skipping.`);
    return;
  }

  const content = `# ${article.title}\n\n**Author:** ${article.user.name}\n\n**Published:** ${article.readable_publish_date}\n\n**Tags:** ${article.tag_list.join(", ")}\n\n**URL:** ${article.url}\n\n${article.description}`;
  fs.writeFileSync(filePath, content);
  console.log(`🕒 [${new Date().toLocaleTimeString()}] Saved: ${filePath}`);

  updateReadme(article);

  execSync("git add .");
  execSync(`git commit -m "Add article: ${article.title}"`);
  execSync("git push");
  console.log(`🕒 [${new Date().toLocaleTimeString()}] Pushed to repo.\n`);
}

run();
