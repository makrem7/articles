const fs = require("fs");
const axios = require("axios");
const { execSync } = require("child_process");

async function run() {
  const date = new Date().toISOString().split("T")[0];
  const time = new Date().toISOString().split("T")[1].substring(0, 8);
  const fileName = `${date}_${time.replace(/:/g, "-")}.md`;
  
  console.log(`Running article fetcher at ${new Date().toString()}`);
  
  try {
    const response = await axios.get(
      "https://dev.to/api/articles?top=1&tag=javascript"
    );
    
    const article = response.data[0];
    
    // Check if we already have this article
    const articleExists = checkIfArticleExists(article.id);
    if (articleExists) {
      console.log(`Article ID ${article.id} already exists. Skipping.`);
      return;
    }
    
    const content = `# ${article.title}\n\n**Author:** ${article.user.name}\n\n**Published:** ${article.readable_publish_date}\n\n**Tags:** ${article.tag_list.join(", ")}\n\n**Link:** [Read on DEV.to](${article.url})\n\n**Article ID:** ${article.id}\n\n---\n\n${article.description}`;
    
    fs.writeFileSync(`articles/${fileName}`, content);
    
    try {
      execSync("git add .");
      execSync(`git commit -m "Add article for ${date} ${time}"`);
      execSync("git push");
      console.log(`Successfully committed and pushed article: ${fileName}`);
    } catch (gitError) {
      console.log("No changes to commit or git error:", gitError.message);
    }
  } catch (error) {
    console.error("Failed to fetch article:", error.message);
  }
}

function checkIfArticleExists(articleId) {
  try {
    // Create articles directory if it doesn't exist
    if (!fs.existsSync("articles")) {
      fs.mkdirSync("articles");
      return false;
    }
    
    const files = fs.readdirSync("articles");
    
    for (const file of files) {
      if (!file.endsWith(".md")) continue;
      
      const content = fs.readFileSync(`articles/${file}`, "utf8");
      if (content.includes(`**Article ID:** ${articleId}`)) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error("Error checking for existing article:", error.message);
    return false;
  }
}

run();
