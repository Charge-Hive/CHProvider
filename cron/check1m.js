const { createClient } = require("@supabase/supabase-js");
const cron = require("node-cron");
const axios = require("axios");

// Supabase configuration
const supabaseUrl = "https://fnxanxbxyoevmxxphksj.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZueGFueGJ4eW9ldm14eHBoa3NqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAxMDg5NTksImV4cCI6MjA1NTY4NDk1OX0.kKa-r21KhljxxGT3ted87LgH5eBKw9WOLqZpRHZRlz4";
const supabase = createClient(supabaseUrl, supabaseKey);

// Reward Parking API endpoint
const REWARD_PARKING_API =
  "https://hederaprovider-e5c7e6e44385.herokuapp.com/rewardParking";

// Function to convert time to Unix timestamp
function timeToUnixTimestamp(timeString) {
  // Get today's date
  const today = new Date();

  // Parse the time string (HH:MM format)
  const [hours, minutes] = timeString.split(":").map(Number);

  // Set the time on today's date
  today.setHours(hours, minutes, 0, 0);

  // Return Unix timestamp (seconds since epoch)
  return Math.floor(today.getTime() / 1000);
}

// Function to call reward parking API
async function callRewardParkingAPI(
  userAccountAddr,
  fromTimeUnix,
  endTimeUnix
) {
  try {
    const response = await axios.post(REWARD_PARKING_API, {
      userAccountId: userAccountAddr,
      nftId: "nftDummy",
      fromTimeUnix: fromTimeUnix,
      endTimeUnix: endTimeUnix,
    });

    console.log("Reward Parking API Response:", response.data);
    return response.data;
  } catch (error) {
    console.error(
      "Error calling Reward Parking API:",
      error.response ? error.response.data : error.message
    );
    return null;
  }
}

// Function to fetch and print matching parking transactions
async function checkParkingTransactions() {
  try {
    // Use a fixed time for testing, replace with getCurrentTime() in production
    const currentTime = "22:00";
    console.log(`Checking transactions starting at ${currentTime}`);

    // Convert current time to Unix timestamp
    const fromTimeUnix = timeToUnixTimestamp(currentTime);

    // Calculate end time (assuming 1-hour session)
    const endTimeDate = new Date();
    endTimeDate.setHours(endTimeDate.getHours() + 1);
    const endTimeUnix = Math.floor(endTimeDate.getTime() / 1000);

    // Query Supabase for transactions starting at the current time
    const { data, error } = await supabase
      .from("Parking_Transactions")
      .select("*")
      .eq("from_time", currentTime);

    if (error) {
      console.error("Error fetching transactions:", error);
      return;
    }

    if (data && data.length > 0) {
      console.log("Matching Transactions:");

      // Process each transaction
      for (const transaction of data) {
        console.log(`Transaction Details:
  ID: ${transaction.id}
  User Account: ${transaction.user_account_addr}
  From Time: ${transaction.from_time}
  From Time (Unix): ${fromTimeUnix}
  End Time (Unix): ${endTimeUnix}`);

        // Call Reward Parking API for each transaction
        await callRewardParkingAPI(
          transaction.user_account_addr,
          "nftDummy",
          fromTimeUnix,
          endTimeUnix
        );
      }
    } else {
      console.log("No matching transactions found.");
    }
  } catch (err) {
    console.error("Unexpected error:", err);
  }
}

// Schedule the job to run every minute
cron.schedule("* * * * *", () => {
  checkParkingTransactions();
});

console.log("Parking Transactions Monitoring Server Started");
