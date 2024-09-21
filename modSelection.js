const fs = require('fs').promises;
const { Message, EmbedBuilder } = require('discord.js');
const { cleanInput, tier2Check, LOG_CHANNEL } = require('./index');
const { commitVerification } = require('./verify');
const { getGithubFileHelper } = require('./github');


/**
 * Verifies a Tier 1 user based on the provided mod ID
 * @param {Message} message - The Discord message object containing user input
 * @param {string} userFileName - The path to the user's file
 * @param {string} cleanedInput - Cleaned mod ID from user input
 * @param {string[]} modInfoArray - Array of mod information from GitHub
 */
async function chooseModTier1(message, userFileName, cleanedInput, modInfoArray) {
    try {
        let inputFound = false;

        // Loop through mod info array to find the requested mod ID
        for (const modPart of modInfoArray) {
            const [modID, , , , modType] = modPart.split('|').map(cleanInput);

            if (cleanedInput === modID) {
                inputFound = true;

                if (modType === '0') {  // Basic mod
                    const userFileContent = await fs.readFile(userFileName, 'utf8');
                    await fs.unlink(userFileName);  // Delete user file after reading

                    const contentToAdd = `${userFileContent}|${modID},`;
                    await commitVerification(message, contentToAdd);  // Commit verification
                } else {
                    message.reply(`**${modID}** is a Premium mod! Please choose a Basic mod.`);
                }
                break;
            }
        }

        if (!inputFound) {
            message.reply("Invalid input or you added more than 1 mod. Use the bold text to request. Please try again.");
        }
    } catch (err) {
        LOG_CHANNEL.send(`Error in chooseModTier1: ${err.message}`);
    }
}


/**
 * Verifies a Tier 2 user based on the provided mod ID
 * @param {Message} message - The Discord message object containing user input
 * @param {string} userFileName - The path to the user's file
 * @param {string} cleanedInput - Cleaned mod ID from user input
 * @param {string[]} modInfoArray - Array of mod information from GitHub
 */
async function chooseModTier2(message, userFileName, cleanedInput, modInfoArray) {
    try {
        let inputFound = false;

        for (const modPart of modInfoArray) {
            const [modID, , , , modType] = modPart.split('|').map(cleanInput);

            if (cleanedInput === modID) {
                inputFound = true;
                const userFileContent = await fs.readFile(userFileName, 'utf8');

                if (!userFileContent.includes(modID)) {
                    let contentToAdd = modID;

                    // Handle mod type (basic or premium)
                    if (modType === '0') {  // Basic mod
                        contentToAdd += '_';
                    } else if (modType === '1') {  // Premium mod
                        if (!userFileContent.includes('PREMIUM')) {
                            contentToAdd += 'PREMIUM_';
                        } else {
                            message.reply('You already have a Premium mod selected. Please choose a Basic mod.');
                            return;
                        }
                    }

                    await fs.appendFile(userFileName, contentToAdd);  // Append mod to file
                    message.reply(modType === '0' ? `Basic mod added: **${modID}**.` : `Premium mod added: **${modID}**.`);
                    
                    await tier2Check(message, userFileName);  // Check if the user selected all required mods
                } else {
                    message.reply('You already have this mod!');
                }
                break;
            }
        }

        if (!inputFound) {
            message.reply("Invalid input or you added more than 1 mod. Use the bold text to request. Please try again.");
        }
    } catch (err) {
        LOG_CHANNEL.send(`Error in chooseModTier2: ${err.message}`);
    }
}


/**
 * Determines logic based on user tier after ID file is created
 * @param {Message} message - The Discord message object containing user input
 */
async function createModOptions(message) {
    try {
        const userRoles = message.member.roles.cache.map(role => role.id).join('.');
        const rawModInfo = await getGithubFileHelper(2);

        switch (true) {
            case userRoles.includes(process.env.TIER1_ROLE):
                showModOptions('1', rawModInfo);
                break;
            case userRoles.includes(process.env.TIER2_ROLE):
                showModOptions('2', rawModInfo);
                break;
            case userRoles.includes(process.env.TIER3_ROLE) || userRoles.includes(process.env.TIERX_ROLE):
                await verifyTier3X(message, rawModInfo);
                break;
            default:
                console.log('User has no tier roles.');
        }
    } catch (err) {
        LOG_CHANNEL.send(`Error in createModOptions: ${err.message}`);
    }
}


/**
 * Displays available mods to the user and provides instructions based on their tier
 * @param {string} tier - The user's tier (1, 2, 3, or X)
 * @param {string} rawModInfo - Raw mod information from GitHub
 */
function showModOptions(tier, rawModInfo) {
    try {
        const verifyChannel = client.channels.cache.get(process.env.VERIFY_CHANNEL);
        const modParts = rawModInfo.split(',');
        let modMessage = "__See full mod list here -> <#1049770353385275392>__\n";

        for (const modPart of modParts) {
            if (modPart.trim()) {
                const modInfoArray = modPart.split('|').map(cleanInput);
                const modID = modInfoArray[0];
                const modType = modInfoArray[4];

                if (modType === '0') {  // Basic mod
                    modMessage += ":star: **" + modID + "**\n";
                } else if (tier === '2') {  // Premium mod for Tier 2
                    modMessage += ":star2: **" + modID + "**\n";
                }
            }
        }

        verifyChannel.send(modMessage);

        const modEmbed = new EmbedBuilder()
            .setTitle("Now pick your mods")
            .setDescription(tier === '1'
                ? "Message the mod you want. You are **Tier 1**. You get __1 Basic mod__."
                : "Message the mods you want __one at a time__. You are **Tier 2**. You get __1 Premium mod__ and __2 Basic mods__. :star: = Basic, :star2: = Premium");

        verifyChannel.send({ embeds: [modEmbed] });
    } catch (err) {
        LOG_CHANNEL.send(`Error in showModOptions: ${err.message}`);
    }
}


module.exports = {
    createModOptions,
    chooseModTier1,
    chooseModTier2
};