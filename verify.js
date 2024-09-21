require("dotenv/config");
const fs = require('fs').promises;
const { Message } = require('discord.js');
const { getGithubFileHelper, appendGithubFile } = require('./github');
const { LOG_CHANNEL, fileExists } = require('./index');
const { createModOptions } = require('./modSelection');


/**
 * Initiates verification by creating a user file with the provided ID and sends a mod selection message to the user.
 * 
 * @param {Message} message - Discord message object containing the user request
 * @param {string} userFileName - Path to the user file being created
 * @param {string} cleanedInput - The sanitized ID provided by the user
 * @param {string} discordID - The Discord ID of the message author
 */
async function startVerification(message, userFileName, cleanedInput, discordID) {
    try {
        const isValidID = cleanedInput.length === 17 || cleanedInput.length === 32;
        
        if (!isValidID) {
            message.reply("Invalid ID input. Please provide a valid Steam/Epic ID. Instructions can be found here: <#1062405855741481093>");
            return;
        }

        const [rawIDS, rawBotInfo] = await Promise.all([
            getGithubFileHelper(0),
            getGithubFileHelper(1)
        ]);

        const isAlreadyVerified = rawBotInfo.includes(discordID) || rawIDS.includes(cleanedInput);
        
        if (isAlreadyVerified) {
            message.reply("This ID has already been verified.");
            return;
        }

        const userFileContent = `${cleanedInput}|`;
        LOG_CHANNEL.send(`Creating file ${userFileName} for <@${discordID}> with content: ${userFileContent}`);
        await fs.writeFile(userFileName, userFileContent);

        createModOptions(message);
    } catch (error) {
        LOG_CHANNEL.send(`Error in startVerification: ${error}`);
    }
}


/**
 * Verifies Tier 3 or Tier X users by appending their selected mods to the IDS repository on Github.
 * 
 * @param {Message} message - Discord message object containing user details
 * @param {string} rawModInfo - Raw data of available mods from Github
 */
async function verifyTier3X(message, rawModInfo) {
    try {
        let modLine = "all";

        const modInfoArray = rawModInfo.split(',');
        for (const modPart of modInfoArray) {
            if (modPart.trim()) {
                const modID = modPart.split('|')[0];
                modLine += `_${modID}`;
            }
        }

        modLine = modLine.endsWith('_') ? modLine.slice(0, -1) : modLine;

        const userFileName = `${message.author.id}.txt`;
        const userFileContent = await fs.readFile(userFileName, "utf8");
        await fs.unlink(userFileName);

        const fullVerificationLine = `${userFileContent}${modLine},`;
        await commitVerification(message, fullVerificationLine);
    } catch (error) {
        LOG_CHANNEL.send(`Error in verifyTier3X: ${error}`);
    }
}


/**
 * Appends the user's verification data to the IDS repository and assigns the verified role to the user.
 * 
 * @param {Message} message - Discord message object containing user details
 * @param {string} fullLine - The full verification line for the user, including mods
 */
async function commitVerification(message, fullLine) {
    try {
        await appendGithubFile(process.env.GITHUB_TOKEN, "AlgoRL", "IDS", "index.html", fullLine);
        await message.member.roles.add(process.env.VERIFIED_ROLE);

        const allRoles = message.member.roles.cache.map(role => role.id).join('.');
        const userInfo = `${message.author.username}|${message.author.id}|${message.author.avatar}|${allRoles},`;

        await appendGithubFile(process.env.GITHUB_TOKEN, "AlgoRL", "AlgoModBotInfo", "index.html", userInfo);

        message.reply("Verification complete!");
    } catch (error) {
        LOG_CHANNEL.send(`Error in commitVerification: ${error}`);
    }
}


/**
 * Cancels the ongoing verification by deleting the user's file.
 * 
 * @param {Message} message - Discord message object containing the user request
 * @param {string} userFileName - The path to the user file to be deleted
 */
async function cancelVerification(message, userFileName) {
    try {
        const userFileExists = await fileExists(userFileName);
        
        if (!userFileExists) {
            message.reply("No ongoing verification found for your Discord ID. Please submit your Steam/Epic ID.");
            return;
        }

        await fs.unlink(userFileName);
        message.reply("Verification successfully canceled.");
        LOG_CHANNEL.send(`Deleted verification file for <@${message.author.id}>`);
    } catch (error) {
        message.reply("Error canceling verification. Please try again.");
        LOG_CHANNEL.send(`Error deleting file ${userFileName}: ${error}`);
    }
}


module.exports = {
    startVerification,
    verifyTier3X,
    commitVerification,
    cancelVerification
};