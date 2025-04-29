const fs = require("fs");
const axios = require("axios");
const { execSync } = require("child_process");

const tags = [
  "devops", "git", "flutter", "javascript", "typescript", "node", "express",
  "angular", "react", "vue", "svelte", "webdev", "technology", "ai", "prompts",
  "chatgpt", "openai", "machinelearning", "mongodb", "database", "sql", "nosql",
  "mysql", "postgres", "docker", "kubernetes", "cloud", "aws", "azure", "cicd"
];

async function run() {
  const date = new Date().toISOString().split("T")[0];

  for (const tag of tags) {
    const fileName = `articles/${date}-${tag}.md`;

    try {
      const response = await axios.get(
        `https://dev.to/api/articles?top=1&tag=${tag}`
      );

      const article = response.data[0];
      const content = `# ${article.title}

**Author:** ${article.user.name}  
**Published:** ${article.readable_publish_date}  
**Tags:** ${article.tag_list.join(", ")}  
**Link:** [Read on DEV.to](${article.url})

---

## Description
${article.description}

---

## Excerpt from DEV.to
${article.body_markdown?.slice(0, 1000) || "*Full article available at the link above.*"}

`;

      fs.writeFileSync(fileName, content);
      console.log(`✅ Saved: ${fileName}`);
    } catch (error) {
      console.warn(`⚠️ Skipped tag "${tag}" – ${error.message}`);
    }
  }

  try {
    execSync("git add .");
    execSync(`git commit -m "Add articles for ${date}"`);
    execSync("git push");
    console.log(`🚀 Articles committed and pushed for ${date}`);
  } catch (gitError) {
    console.error("Git operation failed:", gitError.message);
  }
}

run();
