const fs = require("fs");
const axios = require("axios");
const { execSync } = require("child_process");
const path = require("path");

// Expanded & corrected topics list
const tags = [
  "devops", "git", "flutter", "javascript", "typescript", "node", "express",
  "angular", "react", "vue", "svelte", "webdev", "technology", "ai", "prompts",
  "chatgpt", "openai", "machinelearning", "mongodb", "database", "sql", "nosql",
  "mysql", "postgres", "docker", "kubernetes", "cloud", "aws", "azure", "cicd"
];

function sanitizeFileName(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 80);
}

function getUniqueFileName(baseDir, baseName, ext) {
  let filePath = path.join(baseDir, `${baseName}${ext}`);
  let counter = 1;

  while (fs.existsSync(filePath)) {
    filePath = path.join(baseDir, `${baseName}-${counter}${ext}`);
    counter++;
  }

  return filePath;
}

async function run() {
  const date = new Date().toISOString().split("T")[0];
  const tag = tags[Math.floor(Math.random() * tags.length)];
  const baseDir = "articles";

  try {
    const response = await axios.get(`https://dev.to/api/articles?top=1&tag=${tag}`);
    const article = response.data[0];
    const sanitizedTitle = sanitizeFileName(article.title);
    const baseFileName = `${date}-${sanitizedTitle}`;
    const filePath = getUniqueFileName(baseDir, baseFileName, ".md");

    const content = `# ${article.title}

**Author:** ${article.user.name}  
**Published:** ${article.readable_publish_date}  
**Topic:** ${tag}  
**Tags:** ${article.tag_list.join(", ")}  
**Link:** [Read on DEV.to](${article.url})

---

## Description
${article.description}

---

## Article Content
${article.body_markdown || "*Full article available at the link above.*"}

`;

    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir);
    }

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
