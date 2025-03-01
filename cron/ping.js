const https = require("https");
const URL = "https://hederaprovider-e5c7e6e44385.herokuapp.com/updateNFT";

function pingUrl() {
  console.log(`Pinging ${URL} at ${new Date().toISOString()}`);

  const request = https.get(URL, (response) => {
    const statusCode = response.statusCode;
    console.log(`Response status code: ${statusCode}`);

    // Consume response data to free up memory
    response.resume();
  });

  request.on("error", (error) => {
    console.error(`Error pinging URL: ${error.message}`);
  });

  // Set a timeout to prevent hanging requests
  request.setTimeout(30000, () => {
    request.destroy();
    console.error("Request timed out");
  });
}

// Initial ping
pingUrl();

// Schedule ping every minute
setInterval(pingUrl, 60000);

// Keep the process running
console.log("Worker started. Pinging URL every minute...");
