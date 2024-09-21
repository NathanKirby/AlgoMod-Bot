require("dotenv/config");
const axios = require('axios');
const { LOG_CHANNEL } = require('./index');


/**
 * Retrieves the content of a specific GitHub file based on the index.
 * 
 * @param {number} index - Index to choose which file to retrieve.
 * @returns {Promise<string>} File content for the respective index.
 */
async function getGithubFileHelper(index) {
    const repoDetails = {
        token: process.env.GITHUB_TOKEN,
        owner: "AlgoRL",
    };

    switch (index) {
        case 0:
            return await getGithubFile(repoDetails.token, repoDetails.owner, "IDS", "index.html", false);
        case 1:
            return await getGithubFile(repoDetails.token, repoDetails.owner, "AlgoModBotInfo", "index.html", false);
        case 2:
            return await getGithubFile(repoDetails.token, repoDetails.owner, "ModInfo", "index.html", false);
        default:
            return '';
    }
}


/**
 * Removes a line containing specific content from a GitHub file.
 * 
 * @param {string} authToken - GitHub authorization token.
 * @param {string} owner - GitHub repository owner.
 * @param {string} repo - GitHub repository name.
 * @param {string} filePath - Path of the file in the repository.
 * @param {string} contentToRemove - The content to find and remove.
 */
async function removeFromGithubFile(authToken, owner, repo, filePath, contentToRemove) {
    try {
        LOG_CHANNEL.send(`Attempting to remove content: '${contentToRemove}' from ${filePath}`);

        const currentContent = await getGithubFile(authToken, owner, repo, filePath, true);
        let contentArray = currentContent.split('\n');

        const sha = contentArray.pop();  // Extract SHA and remove from content
        contentArray = contentArray.filter(line => !line.includes(contentToRemove));  // Filter lines

        const newFileContent = contentArray.join('\n');
        await axios.put(
            `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
            {
                message: `Removed line containing '${contentToRemove}'`,
                content: Buffer.from(newFileContent).toString('base64'),
                sha: sha,
            },
            { headers: { Authorization: `token ${authToken}` } }
        );

        LOG_CHANNEL.send(`Successfully removed line containing '${contentToRemove}'`);
    } catch (error) {
        LOG_CHANNEL.send(`Error in removeFromGithubFile: ${error}`);
    }
}


/**
 * Removes a user’s information from both the IDS and AlgoModBotInfo repositories.
 * 
 * @param {string} discordID - Discord ID of the user to remove.
 */
async function removeUserFromGithub(discordID) {
    try {
        LOG_CHANNEL.send(`Attempting to remove user with Discord ID: ${discordID} from GitHub.`);

        const botInfo = await getGithubFile(process.env.GITHUB_TOKEN, "AlgoRL", "AlgoModBotInfo", "index.html", true);
        await removeFromGithubFile(process.env.GITHUB_TOKEN, "AlgoRL", "AlgoModBotInfo", "index.html", discordID);

        if (botInfo.trim().length > 0) {
            let botInfoArray = botInfo.split(',');
            const sha = botInfoArray.pop();  // Get SHA
            const userLine = botInfoArray.find(line => line.includes(discordID));

            if (userLine) {
                const idToRemove = userLine.split('|')[0].trim();
                if (idToRemove.length > 0) {
                    await removeFromGithubFile(process.env.GITHUB_TOKEN, "AlgoRL", "IDS", "index.html", idToRemove);
                }
            }
        }
    } catch (error) {
        LOG_CHANNEL.send(`Error in removeUserFromGithub: ${error}`);
    }
}


/**
 * Fetches the content of a file from a GitHub repository.
 * 
 * @param {string} authToken - GitHub authorization token.
 * @param {string} owner - GitHub repository owner.
 * @param {string} repo - GitHub repository name.
 * @param {string} filePath - Path of the file in the repository.
 * @param {boolean} returnSHA - Whether to return the SHA of the file.
 * @returns {Promise<string>} The file content and optionally the SHA.
 */
async function getGithubFile(authToken, owner, repo, filePath, returnSHA) {
    const headers = { Authorization: `Bearer ${authToken}` };
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=main`;

    try {
        const response = await axios.get(url, { headers });
        let fileContent = Buffer.from(response.data.content, 'base64').toString('utf-8');

        if (returnSHA) {
            fileContent += `\n${response.data.sha}`;
        }

        return fileContent;
    } catch (error) {
        LOG_CHANNEL.send(`Error in getGithubFile: ${error}`);
        return '';
    }
}


/**
 * Appends content to a file in a GitHub repository.
 * 
 * @param {string} authToken - GitHub authorization token.
 * @param {string} owner - GitHub repository owner.
 * @param {string} repo - GitHub repository name.
 * @param {string} filePath - Path of the file in the repository.
 * @param {string} contentToAdd - Content to append to the file.
 */
async function appendGithubFile(authToken, owner, repo, filePath, contentToAdd) {
    const headers = { Authorization: `Bearer ${authToken}` };
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

    try {
        const getResponse = await axios.get(url, { headers });
        let currentContent = Buffer.from(getResponse.data.content, 'base64').toString('utf-8');

        if (!currentContent.endsWith('\n')) {
            currentContent += '\n';
        }

        const combinedContent = currentContent + contentToAdd;
        const encodedContent = Buffer.from(combinedContent).toString('base64');
        const currentSha = getResponse.data.sha;

        const putResponse = await axios.put(
            url,
            {
                message: "Appended new content via API",
                content: encodedContent,
                sha: currentSha,
            },
            { headers }
        );

        LOG_CHANNEL.send(`Successfully appended content to ${filePath}: '${contentToAdd}'`);
    } catch (error) {
        LOG_CHANNEL.send(`Error in appendGithubFile: ${error}`);
    }
}


module.exports = {
    getGithubFileHelper,
    removeFromGithubFile,
    removeUserFromGithub,
    getGithubFile,
    appendGithubFile,
};