export default async function handler(req, res) {
  const { topic } = req.query;
  const apiKey = process.env.REACT_APP_NEWS_KEY;
  const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(topic)}&sortBy=publishedAt&pageSize=12&language=en&apiKey=${apiKey}`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json(data);
}