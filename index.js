require("dotenv/config");
const fs = require('fs').promises;
const { loadEvents } = require('./Functions/loadEvents');

// Src files
const { getGithubFileHelper, removeUserFromGithub } = require('./github');
const { startVerification, commitVerification, cancelVerification } = require(`./verify`);
const { chooseModTier1, chooseModTier2 } = require('./modSelection');

// Discord dependancies
const { Client, Collection, GatewayIntentBits, Partials, GuildMember } = require('discord.js');
const { Guilds, GuildMembers, GuildMessages, MessageContent, DirectMessages } = GatewayIntentBits;
const { User, Message, GuildMember, Channel } = Partials;

// Initialize client
const client = new Client({
    intents: [Guilds, GuildMembers, GuildMessages, MessageContent, DirectMessages],
    partials: [User, Message, GuildMember, Channel]
});

// Load events and initialize collections
loadEvents(client);
client.events = new Collection();
client.commands = new Collection();

// Login and log success
client.login(process.env.TOKEN)
    .then(() => console.log("Logged in!"))
    .catch(console.error);


let LOG_CHANNEL;

/**
 * Fetch log channel
 */
client.channels.fetch(process.env.LOG_CHANNEL)
    .then(channel => LOG_CHANNEL = channel)
    .catch(err => console.error(`Failed to fetch log channel: ${err}`));


/**
 * Handles messages sent in the verification channel
 */
client.on('messageCreate', async (message) => {
    try {
      const { channel, author, content, member } = message;
  
      if (channel.id === process.env.VERIFY_CHANNEL && !author.bot) {
        const cleanedInput = cleanInput(content);
        const discordID = author.id;
        const userFileName = `${discordID}.txt`;
  
        // Handle verification cancellation
        if (cleanedInput === "cancel") {
          await cancelVerification(message, userFileName);
          return;
        }
  
        // Check if user file exists
        let userFileExists = await fileExists(userFileName);
  
        if (userFileExists) {
          // Process existing user verification
          const modInfoArray = (await getGithubFileHelper(2)).split(',');
          const allRoles = member.roles.cache.map(role => role.id).join('.');
  
          if (allRoles.includes(process.env.TIER1_ROLE)) {
            await chooseModTier1(message, userFileName, cleanedInput, modInfoArray);
          } else if (allRoles.includes(process.env.TIER2_ROLE)) {
            await chooseModTier2(message, userFileName, cleanedInput, modInfoArray);
          }
        } else {
          await startVerification(message, userFileName, cleanedInput, discordID);
        }
      }
    } catch (err) {
      if (LOG_CHANNEL) LOG_CHANNEL.send(`Error with messageCreate: ${err}`);
    }
  });


/**
 * Removes patrons from the Github if they unsub from the Patreon (patreon role removed by Patreon bot)
 */
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    if (oldMember.roles.cache.has(process.env.PATREON_ROLE)) {
        if (!newMember.roles.cache.has(process.env.PATREON_ROLE)) {
            await handleRemove(newMember);
        }
    }
});


/**
 * Removes patrons from the Github if they leave the server
 */
client.on('guildMemberRemove', async (member) => {
    if (member.roles.cache.has(process.env.PATREON_ROLE)) {
        await handleRemove(member);
    }
});


/**
 * Handles the removing of a user from AlgoMod
 * 
 * @param {GuildMember} member - Discord to remove
 */
async function handleRemove(member) {
    try {
        const verifiedRole = member.guild.roles.cache.get(process.env.VERIFIED_ROLE);
        await member.roles.remove(verifiedRole);
        await removeUserFromGithub(member.id);
    } catch (err) {
        if (LOG_CHANNEL) LOG_CHANNEL.send(`Error with handleRemove: ${err}`);
    }
}


/**
 * Verifies tier 2 users when they've selected all 3 of their available mods
 * 
 * @param {Message} message - Message object used to gather information
 * @param {string} userFile - File path for user file
 */
async function tier2Check(message, userFile) {
    try {
        const userFileData = await fs.readFile(userFile, "utf8");
        const numMods = userFileData.slice(0, -1).split('|')[1].split('_').length;

        if (numMods === 3) {
            const verifyContent = userFileData.slice(0, -1).replace("PREMIUM", '') + ',';
            await fs.unlink(userFile);
            await commitVerification(message, verifyContent);
        }
    }
    catch (err) {
        if (LOG_CHANNEL) LOG_CHANNEL.send(`Error with tier2Check: ${err}`);
    }
}


/**
 * Checks if a file exists
 * 
 * @param {string} filePath - Path to the file
 * @returns {Promise<boolean>} - Whether the file exists
 */
async function fileExists(filePath) {
    try {
        await fs.access(filePath, fs.constants.F_OK);
        return true;
    } catch {
        return false;
    }
}


/**
 * Cleans input by converting it to lowercase and removing unnecessary characters
 * 
 * @param {string} input - String input to clean
 * @returns {string} - Cleaned input
 */
function cleanInput(input) {
    return input.toLowerCase()
        .trim()
        .replace(/steam id:|id:/gi, '')
        .replace(/[^a-z0-9]/g, '');
}


module.exports = {
    fileExists,
    cleanInput,
    tier2Check,
    LOG_CHANNEL,
    client
};