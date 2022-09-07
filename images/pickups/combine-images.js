const fs = require('fs');
const { exec } = require("child_process");

const onlyList = []
const greenList = ['trap'];
const redList = ['Magic'];
fs.readdirSync('.').forEach(file => {
    if (onlyList.every(ol => file.includes(ol)) && greenList.some(gl => file.includes(gl)) && !redList.some(rl => file.includes(rl))) {
        // Modify
        const magickCommand = `magick composite -gravity center ${file} ./t-shadow.png ${file}`;

        exec(magickCommand, (error, stdout, stderr) => {
            console.log(file);
            if (error) {
                console.log(`error: ${error.message}`);
                return;
            }
            if (stderr) {
                console.log(`stderr: ${stderr}`);
                return;
            }
            if (stdout) {
                console.log(`stdout: ${stdout}`);
            }
        });
    }
});
