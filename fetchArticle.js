const fs = require("fs");
const axios = require("axios");
const { execSync } = require("child_process");
const path = require("path");
const crypto = require("crypto");

async function run() {
  const date = new Date().toISOString().split("T")[0];
  console.log(`Running article fetcher at ${new Date().toString()}`);
  
  try {
    // Try multiple APIs to find a suitable article
    const article = await fetchArticle();
    
    if (!article) {
      console.log("Could not find a suitable article after trying multiple sources.");
      return;
    }
    
    // Create a sanitized version of the title for the filename (max 10 words)
    const titleWords = article.title.split(' ');
    const shortTitle = titleWords.slice(0, 10).join(' ');
    const sanitizedTitle = shortTitle.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').toLowerCase();
    
    const fileName = `${date}_${sanitizedTitle}.md`;
    
    // Format the content
    const content = formatArticle(article);
    
    // Create the articles directory if it doesn't exist
    if (!fs.existsSync("articles")) {
      fs.mkdirSync("articles");
    }
    
    fs.writeFileSync(`articles/${fileName}`, content);
    
    try {
      execSync("git add .");
      execSync(`git commit -m "Add article: ${shortTitle}"`);
      execSync("git push");
      console.log(`Successfully committed and pushed article: ${fileName}`);
    } catch (gitError) {
      console.log("No changes to commit or git error:", gitError.message);
    }
  } catch (error) {
    console.error("Failed to process article:", error.message);
  }
}

async function fetchArticle() {
  // Try different API sources until we find a suitable article
  const sources = [
    {
      name: "DEV.to",
      fetcher: async () => {
        const response = await axios.get("https://dev.to/api/articles?top=3&tag=javascript");
        return response.data.map(article => ({
          title: article.title,
          content: article.description,
          source: `DEV.to - ${article.user.name}`,
          url: article.url,
          id: `devto-${article.id}`,
          published: article.readable_publish_date
        }));
      }
    },
    {
      name: "Hacker News",
      fetcher: async () => {
        const topStories = await axios.get("https://hacker-news.firebaseio.com/v0/topstories.json?limitToFirst=5&orderBy=\"$key\"");
        const storyPromises = topStories.data.slice(0, 5).map(async id => {
          const story = await axios.get(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
          if (story.data.url && story.data.title) {
            // For HN, we need to fetch the actual content
            try {
              const response = await axios.get(`https://text-extract-api.herokuapp.com/api/extract?url=${encodeURIComponent(story.data.url)}`);
              const content = response.data.text.split('\n').filter(p => p.trim().length > 80).slice(0, 3).join('\n\n');
              return {
                title: story.data.title,
                content: content || "Visit the link to read the full article.",
                source: `Hacker News - ${story.data.by}`,
                url: story.data.url,
                id: `hn-${story.data.id}`,
                published: new Date(story.data.time * 1000).toDateString()
              };
            } catch (error) {
              return {
                title: story.data.title,
                content: "Visit the link to read the full article.",
                source: `Hacker News - ${story.data.by}`,
                url: story.data.url,
                id: `hn-${story.data.id}`,
                published: new Date(story.data.time * 1000).toDateString()
              };
            }
          }
          return null;
        });
        const stories = await Promise.all(storyPromises);
        return stories.filter(story => story !== null);
      }
    },
    {
      name: "News API",
      fetcher: async () => {
        // Replace with your API key if you have one, or try a different source
        const apiKey = "dummy-key"; // You'll need a real API key for this to work
        try {
          const response = await axios.get(`https://newsapi.org/v2/top-headlines?country=us&category=technology&apiKey=${apiKey}`);
          return response.data.articles.map(article => ({
            title: article.title,
            content: article.description || article.content,
            source: `${article.source.name} - ${article.author || "Unknown"}`,
            url: article.url,
            id: `newsapi-${crypto.createHash('md5').update(article.url).digest('hex')}`,
            published: new Date(article.publishedAt).toDateString()
          }));
        } catch (error) {
          console.log("News API error:", error.message);
          return [];
        }
      }
    }
  ];

  // Try each source until we find a suitable article
  for (const source of sources) {
    console.log(`Trying to fetch articles from ${source.name}...`);
    try {
      const articles = await source.fetcher();
      
      // Check each article for uniqueness
      for (const article of articles) {
        if (!articleExists(article)) {
          console.log(`Found unique article: "${article.title}" from ${source.name}`);
          return article;
        } else {
          console.log(`Article already exists: "${article.title}"`);
        }
      }
    } catch (error) {
      console.log(`Error fetching from ${source.name}:`, error.message);
    }
  }

  return null;
}

function formatArticle(article) {
  // Format the content to be 2-3 paragraphs
  let content = article.content;
  
  // If content is too short, add a note
  if (!content || content.length < 100) {
    content = "This article provides a brief overview of the topic. Visit the source link to read the full article.";
  }
  
  // If content is too long, truncate to 2-3 paragraphs
  const paragraphs = content.split('\n\n').filter(p => p.trim().length > 0);
  const formattedContent = paragraphs.slice(0, 3).join('\n\n');
  
  return `# ${article.title}

${formattedContent}

---

**Source:** [${article.source}](${article.url})  
**Published:** ${article.published}  
**Article ID:** ${article.id}
`;
}

function articleExists(newArticle) {
  try {
    // Create articles directory if it doesn't exist
    if (!fs.existsSync("articles")) {
      fs.mkdirSync("articles");
      return false;
    }
    
    const files = fs.readdirSync("articles");
    
    for (const file of files) {
      if (!file.endsWith(".md")) continue;
      
      const content = fs.readFileSync(path.join("articles", file), "utf8");
      
      // Check if article ID exists
      if (content.includes(`**Article ID:** ${newArticle.id}`)) {
        return true;
      }
      
      // Check if the title is very similar
      const titleMatch = content.match(/# (.*)/);
      if (titleMatch) {
        const existingTitle = titleMatch[1];
        // Check if titles are very similar (80% similarity)
        if (calculateSimilarity(existingTitle, newArticle.title) > 0.8) {
          return true;
        }
      }
      
      // Check if content is very similar
      const existingContent = content.split('---')[0]; // Get content before the source
      if (calculateSimilarity(existingContent, newArticle.content) > 0.7) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error("Error checking for existing article:", error.message);
    return false;
  }
}

function calculateSimilarity(str1, str2) {
  // Simple Jaccard similarity for strings
  if (!str1 || !str2) return 0;
  
  const set1 = new Set(str1.toLowerCase().split(/\W+/).filter(word => word.length > 3));
  const set2 = new Set(str2.toLowerCase().split(/\W+/).filter(word => word.length > 3));
  
  const intersection = new Set([...set1].filter(word => set2.has(word)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}

run();
