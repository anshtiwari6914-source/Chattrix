const express = require("express");
const path = require("path");

const app = express();
const PORT = 4000;
// Serve static files from /public
app.use(express.static(path.join(__dirname, "auth")));
// Default route → index.html
app.get("/", (req, res) => {
   res.sendFile(path.join(__dirname, "auth", "auth.html"));
});



app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});


const { exec } = require("child_process");

exec("node server.js", (err, stdout, stderr) => {
    if (err) {
        console.error("Error:", err);
        return;
    }
    console.log(stdout);
});



