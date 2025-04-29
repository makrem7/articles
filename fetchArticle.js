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
  // Define the topics we're interested in
  const targetTopics = [
    "devops", "git", "flutter", "javascript", "nodejs", "node.js", "angular", 
    "tech", "ai", "prompts", "mongo", "mongodb", "database", "sql", "nosql", "mysql"
  ];
  
  // Try different API sources until we find a suitable article
  const sources = [
    {
      name: "DEV.to",
      fetcher: async () => {
        // Try multiple relevant tags
        const devArticles = [];
        
        // Try each target topic as a tag
        for (const topic of ["javascript", "webdev", "programming", "devops", "flutter", "ai", "database"]) {
          try {
            console.log(`Fetching from DEV.to with tag: ${topic}`);
            const response = await axios.get(`https://dev.to/api/articles?top=10&tag=${topic}`);
            
            // Filter articles by our target topics
            const relevantArticles = response.data.filter(article => {
              // Check if title or tags contain our target topics
              const titleLower = article.title.toLowerCase();
              const hasRelevantTitle = targetTopics.some(topic => titleLower.includes(topic));
              const hasRelevantTag = article.tag_list.some(tag => 
                targetTopics.some(topic => tag.toLowerCase().includes(topic))
              );
              
              return hasRelevantTitle || hasRelevantTag;
            });
            
            devArticles.push(...relevantArticles.map(article => ({
              title: article.title,
              content: article.description,
              source: `DEV.to - ${article.user.name}`,
              url: article.url,
              id: `devto-${article.id}`,
              published: article.readable_publish_date,
              topics: article.tag_list
            })));
          } catch (error) {
            console.log(`Error fetching DEV.to articles with tag ${topic}:`, error.message);
          }
        }
        
        return devArticles;
      }
    },
    {
      name: "Hacker News",
      fetcher: async () => {
        try {
          const topStories = await axios.get("https://hacker-news.firebaseio.com/v0/topstories.json?limitToFirst=15&orderBy=\"$key\"");
          const storyPromises = topStories.data.slice(0, 15).map(async id => {
            const story = await axios.get(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
            if (story.data.url && story.data.title) {
              // Check if the title contains any of our target topics
              const titleLower = story.data.title.toLowerCase();
              const isRelevant = targetTopics.some(topic => titleLower.includes(topic));
              
              if (isRelevant) {
                // For HN, we might need to fetch the actual content
                try {
                  const content = "Visit the link to read the full article.";
                  return {
                    title: story.data.title,
                    content: content,
                    source: `Hacker News - ${story.data.by}`,
                    url: story.data.url,
                    id: `hn-${story.data.id}`,
                    published: new Date(story.data.time * 1000).toDateString(),
                    topics: extractTopicsFromTitle(story.data.title)
                  };
                } catch (error) {
                  return {
                    title: story.data.title,
                    content: "Visit the link to read the full article.",
                    source: `Hacker News - ${story.data.by}`,
                    url: story.data.url,
                    id: `hn-${story.data.id}`,
                    published: new Date(story.data.time * 1000).toDateString(),
                    topics: extractTopicsFromTitle(story.data.title)
                  };
                }
              }
            }
            return null;
          });
          const stories = await Promise.all(storyPromises);
          return stories.filter(story => story !== null);
        } catch (error) {
          console.log("Error fetching from Hacker News:", error.message);
          return [];
        }
      }
    },
    {
      name: "Medium - Programming Topics",
      fetcher: async () => {
        try {
          // Using RSS-to-JSON service for Medium feeds
          const feedURLs = [
            "https://medium.com/feed/tag/javascript",
            "https://medium.com/feed/tag/nodejs",
            "https://medium.com/feed/tag/flutter",
            "https://medium.com/feed/tag/angular",
            "https://medium.com/feed/tag/devops",
            "https://medium.com/feed/tag/database"
          ];
          
          let allArticles = [];
          
          for (const feedURL of feedURLs) {
            try {
              const response = await axios.get(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedURL)}`);
              
              if (response.data.status === 'ok') {
                const articles = response.data.items.map(item => {
                  // Extract plain text content from HTML
                  const tempDiv = document.createElement('div');
                  tempDiv.innerHTML = item.description;
                  const textContent = tempDiv.textContent || tempDiv.innerText || "";
                  
                  // Get first two paragraphs
                  const paragraphs = textContent.split('\n').filter(p => p.trim().length > 0);
                  const shortContent = paragraphs.slice(0, 2).join('\n\n');
                  
                  return {
                    title: item.title,
                    content: shortContent,
                    source: `Medium - ${item.author}`,
                    url: item.link,
                    id: `medium-${crypto.createHash('md5').update(item.link).digest('hex')}`,
                    published: new Date(item.pubDate).toDateString(),
                    topics: extractTopicsFromTitle(item.title)
                  };
                });
                
                allArticles.push(...articles);
              }
            } catch (error) {
              console.log(`Error fetching Medium feed ${feedURL}:`, error.message);
            }
          }
          
          return allArticles;
        } catch (error) {
          console.log("Medium fetcher error:", error.message);
          return [];
        }
      }
    },
    {
      name: "API Ninjas - Tech News",
      fetcher: async () => {
        try {
          // API Ninjas requires an API key
          const apiKey = "YOUR_API_NINJAS_KEY"; // Replace with your actual API key
          
          const response = await axios.get('https://api.api-ninjas.com/v1/newsbycategory?category=technology', {
            headers: {
              'X-Api-Key': apiKey
            }
          });
          
          return response.data
            .filter(article => {
              const titleLower = article.title.toLowerCase();
              return targetTopics.some(topic => titleLower.includes(topic));
            })
            .map(article => ({
              title: article.title,
              content: article.snippet || article.description || "Visit the link to read the full article.",
              source: `${article.source || "Tech News"} - API Ninjas`,
              url: article.url,
              id: `apininjas-${crypto.createHash('md5').update(article.url).digest('hex')}`,
              published: article.published_date || new Date().toDateString(),
              topics: extractTopicsFromTitle(article.title)
            }));
        } catch (error) {
          console.log("API Ninjas error:", error.message);
          return [];
        }
      }
    },
    {
      name: "Custom Programming Topics Generator",
      fetcher: async () => {
        // In case all APIs fail, we'll generate a simple placeholder article
        // about one of our target topics
        
        // Choose a random topic
        const topics = [
          "DevOps CI/CD Pipeline Best Practices",
          "Advanced Git Workflow Techniques",
          "Flutter vs React Native: Which to Choose in 2025",
          "Modern JavaScript Features You Should Be Using",
          "Node.js Performance Optimization Tips",
          "Building Scalable Angular Applications",
          "AI-Driven Development Tools for Programmers",
          "MongoDB Schema Design Patterns",
          "SQL vs NoSQL: Choosing the Right Database in 2025",
          "MySQL Performance Tuning for High-Traffic Applications"
        ];
        
        const randomTopic = topics[Math.floor(Math.random() * topics.length)];
        
        // Generate content based on the topic
        let content = "";
        switch (randomTopic) {
          case "DevOps CI/CD Pipeline Best Practices":
            content = "Modern DevOps practices emphasize continuous integration and delivery pipelines. The key is automating testing, deployment, and monitoring to ensure reliability and speed. Recent trends show that organizations adopting these practices deploy code up to 200 times more frequently than those using traditional methods.\n\nTo implement an effective CI/CD pipeline, focus on these elements: automated testing at every stage, infrastructure as code, comprehensive monitoring, and gradual rollouts with feature flags. Using tools like GitHub Actions, Jenkins, or GitLab CI can significantly simplify this process.";
            break;
          case "Advanced Git Workflow Techniques":
            content = "Moving beyond basic Git commands can dramatically improve team collaboration and code quality. Techniques like interactive rebasing, cherry-picking, and utilizing Git hooks allow developers to maintain cleaner commit histories and automate quality checks.\n\nOne particularly powerful workflow is the feature branch strategy combined with pull requests. This approach isolates new work, facilitates code reviews, and ensures main branches remain stable. For larger teams, considering a trunk-based development approach with feature flags can help minimize merge conflicts while enabling continuous delivery.";
            break;
          case "Flutter vs React Native: Which to Choose in 2025":
            content = "The cross-platform development landscape continues to evolve with Flutter and React Native leading the way. Flutter's single codebase with native compilation offers excellent performance and consistent UI across platforms, while React Native's JavaScript bridge provides familiar territory for web developers and great ecosystem integration.\n\nPerformance benchmarks in 2025 show Flutter generally outperforming React Native in animation-heavy applications, while React Native continues to excel in applications requiring deep integration with native modules. Your choice should consider your team's existing expertise, application requirements, and long-term maintenance plans.";
            break;
          case "Modern JavaScript Features You Should Be Using":
            content = "JavaScript continues to evolve with new features that improve developer productivity and code quality. The optional chaining operator (?.) and nullish coalescing operator (??) have dramatically simplified handling potentially undefined values and providing defaults.\n\nAsync/await patterns have made asynchronous code much more readable compared to promise chains. For data manipulation, array methods like map, filter, and reduce combined with the spread operator create expressive, functional programming patterns that lead to more maintainable code with fewer bugs.";
            break;
          case "Node.js Performance Optimization Tips":
            content = "Optimizing Node.js applications requires understanding its event-driven, non-blocking I/O model. Profiling your application with tools like Clinic.js or Node's built-in profiler can identify bottlenecks before attempting optimizations.\n\nCommon performance improvements include proper caching strategies, utilizing worker threads for CPU-intensive tasks, optimizing database queries, and implementing connection pooling. For production environments, clustering your application across multiple CPU cores can significantly improve throughput while maintaining Node's single-threaded benefits at the process level.";
            break;
          default:
            content = "This technology continues to evolve rapidly with new features and best practices emerging regularly. Staying updated with the latest developments can help you build more efficient, scalable, and maintainable systems.\n\nConsider joining relevant communities and following key contributors to keep your knowledge current. Practical implementation through small projects often provides the best learning experience and helps solidify understanding of complex concepts.";
        }
        
        return [{
          title: randomTopic,
          content: content,
          source: "Tech Article Repository - Generated Content",
          url: "https://github.com/yourusername/tech-articles",
          id: `generated-${Date.now()}`,
          published: new Date().toDateString(),
          topics: extractTopicsFromTitle(randomTopic)
        }];
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

function extractTopicsFromTitle(title) {
  const targetTopics = [
    "devops", "git", "flutter", "javascript", "nodejs", "node.js", "angular", 
    "tech", "ai", "prompts", "mongo", "mongodb", "database", "sql", "nosql", "mysql"
  ];
  
  const titleLower = title.toLowerCase();
  return targetTopics.filter(topic => titleLower.includes(topic));
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
  
  // Add relevant topics/tags if available
  let topicsSection = "";
  if (article.topics && article.topics.length > 0) {
    topicsSection = `\n\n**Topics:** ${article.topics.join(", ")}`;
  }
  
  return `# ${article.title}

${formattedContent}

---

**Source:** [${article.source}](${article.url})  
**Published:** ${article.published}  
**Article ID:** ${article.id}${topicsSection}
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
