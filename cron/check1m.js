const { createClient } = require("@supabase/supabase-js");
const cron = require("node-cron");
const { exec } = require("child_process");

// Supabase configuration
const supabaseUrl = "https://fnxanxbxyoevmxxphksj.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZueGFueGJ4eW9ldm14eHBoa3NqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAxMDg5NTksImV4cCI6MjA1NTY4NDk1OX0.kKa-r21KhljxxGT3ted87LgH5eBKw9WOLqZpRHZRlz4";
const supabase = createClient(supabaseUrl, supabaseKey);

// Reward Parking API endpoint
const REWARD_PARKING_API =
  "https://hederaprovider-e5c7e6e44385.herokuapp.com/rewardParking";

// Function to execute curl command
function executeCurlCommand(userAccountId, nftId, startTime, endTime) {
  return new Promise((resolve, reject) => {
    const curlCommand = `curl -X POST https://hederaprovider-e5c7e6e44385.herokuapp.com/rewardParking \
     -H "Content-Type: application/json" \
     -d '{
         "userAccountId": "${userAccountId}",
         "nftId": "${nftId}",
         "startTime": ${startTime},
         "endTime": ${endTime}
     }'`;

    console.log("📤 Executing Curl Command:", curlCommand);

    exec(curlCommand, (error, stdout, stderr) => {
      if (error) {
        console.error(`Execution error: ${error}`);
        reject(error);
        return;
      }

      if (stderr) {
        console.error(`stderr: ${stderr}`);
      }

      console.log(`API Response: ${stdout}`);

      try {
        const parsedResponse = JSON.parse(stdout);
        resolve(parsedResponse);
      } catch (parseError) {
        console.error("Failed to parse response:", parseError);
        reject(parseError);
      }
    });
  });
}

// Function to convert MST time to Unix timestamp (UTC) and add 2 minutes
function timeToUnixTimestamp(timeString, dateString) {
  // Parse the date from the transaction
  const [year, month, day] = dateString.split("-").map(Number);

  // Parse the time string (HH:MM format)
  const [hours, minutes] = timeString.split(":").map(Number);

  // Create date object in MST
  // Note: Month is 0-indexed in JavaScript Date
  const mstDate = new Date(year, month - 1, day, hours, minutes, 0, 0);

  // Convert MST to UTC by adding 7 hours (MST is UTC-7)
  // This adjusts the time from MST to UTC
  const utcDate = new Date(mstDate.getTime() + 7 * 60 * 60 * 1000);

  // Add 2 minutes as requested
  utcDate.setMinutes(utcDate.getMinutes() + 2);

  // Return Unix timestamp (seconds since epoch) in UTC
  return Math.floor(utcDate.getTime() / 1000);
}

// Function to update transaction status in database
async function updateTransactionStatus(transactionId, status) {
  try {
    const { data, error } = await supabase
      .from("Parking_Transactions")
      .update({ status: status })
      .eq("id", transactionId);

    if (error) {
      console.error(
        `Error updating transaction ${transactionId} to ${status}:`,
        error
      );
      return false;
    }

    console.log(`✅ Transaction ${transactionId} status updated to: ${status}`);
    return true;
  } catch (error) {
    console.error(
      `Unexpected error updating transaction ${transactionId}:`,
      error
    );
    return false;
  }
}

// Function to call reward parking API
async function callRewardParkingAPI(
  transactionId,
  userAccountId,
  nftId,
  fromTimeUnix,
  endTimeUnix
) {
  try {
    // Update status to "inprogress" before API call
    await updateTransactionStatus(transactionId, "inprogress");

    const result = await executeCurlCommand(
      userAccountId || "0.0.5640724",
      nftId || "nftDummy",
      fromTimeUnix,
      endTimeUnix
    );

    // Check API response and update status to "completed" if successful
    if (result && result.success === true) {
      await updateTransactionStatus(transactionId, "completed");
    } else {
      // Optionally handle failed API calls
      console.error("API call was not successful:", result);
      await updateTransactionStatus(transactionId, "failed");
    }

    return result;
  } catch (error) {
    console.error("Error calling Reward Parking API:", error);
    // Update status to failed in case of error
    await updateTransactionStatus(transactionId, "failed");
    return null;
  }
}

// Function to fetch and print matching parking transactions
async function checkParkingTransactions() {
  try {
    console.log("Checking for pending parking transactions");

    // Query Supabase for pending transactions
    const { data, error } = await supabase
      .from("Parking_Transactions")
      .select("*")
      .eq("status", "reserved"); // Only process pending transactions

    if (error) {
      console.error("Error fetching transactions:", error);
      return;
    }

    if (data && data.length > 0) {
      console.log(`Found ${data.length} pending transactions to process.`);

      // Process each transaction
      for (const transaction of data) {
        // Get start and end times from transaction
        const fromTime = transaction.from_time;
        const toTime = transaction.to_time;
        const date = transaction.date;

        // Convert MST times to Unix timestamps (UTC) with 2 minutes added
        const fromTimeUnix = timeToUnixTimestamp(fromTime, date);
        const toTimeUnix = timeToUnixTimestamp(toTime, date);
        // Calculate UTC times for logging
        const fromMst = new Date(`${date}T${fromTime}:00`);
        const toMst = new Date(`${date}T${toTime}:00`);

        // Add 7 hours to convert MST to UTC
        const fromUtc = new Date(fromMst.getTime() + 7 * 60 * 60 * 1000);
        const toUtc = new Date(toMst.getTime() + 7 * 60 * 60 * 1000);

        console.log(fromUtc.toISOString());
        console.log(toUtc.toISOString());

        console.log(`Processing Transaction:
  ID: ${transaction.id || "N/A"}
  Provider Account: ${transaction.provider_account_addr}
  Date: ${date}
  From Time (MST): ${fromTime} → (UTC): ${fromUtc.toISOString()}
  To Time (MST): ${toTime} → (UTC): ${toUtc.toISOString()}
  Unix Timestamps (with +2min): From=${fromTimeUnix}, To=${toTimeUnix}
  Status: ${transaction.status}`);

        // Call Reward Parking API for each transaction
        await callRewardParkingAPI(
          transaction.id,
          transaction.provider_account_addr,
          "nftDummy",
          fromTimeUnix,
          toTimeUnix
        );
      }
    } else {
      const currentDateTime = new Date().toISOString();
      console.log(
        `No pending transactions found. Current date and time: ${currentDateTime}`
      );
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
