require('dotenv').config();
const { Client, Intents } = require('discord.js');
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });

// another test

const TOKEN = process.env.TOKEN;

// ID of the Forex server
const server_id = process.env.SERVER_ID;

const fs = require('fs');
// const Cron = require('cron').CronJob;
const Cron = require('croner');

// If you change the name of the text file, you'll need to change it here too
const announcements_txt = './announcements.json';

client.login(TOKEN);

// Read in all the announcements and parse them
let rawdata = fs.readFileSync(announcements_txt);
let announcements = JSON.parse(rawdata);

const temp_jobs = [];
const jobs = [];

// Let's create jobs for everything in the announcements file
announcements["announcements"].forEach(announcement => {
	// Generate a random number to act as the job variable name
	const job_id = Math.floor(Math.random() * 10000).toString();

	// Create a new Cron job inside a list so that we can use the RNG variable name
	temp_jobs[job_id] = new Cron(announcement["cron"], { 
			maxRuns: Infinity,
			timezone: "America/New_York"
		}, () =>{
		const guild = client.guilds.cache.get(server_id);
		// Find the channel we want to post in and store its channel object
		const channel = guild.channels.cache.find(channel => channel.id === announcement["channel"]);
		channel.send(announcement["message"] + '\n@everyone');
		// If we don't have any images, send our re-formatted string
		//if (announcement["images"] === '') {
		//	channel.send(announcement["message"] + '\n@everyone');
		//} 
		// Otherwise, send the string and the images
		//else {
		//	channel.send(announcement["message"] + '\n@everyone', {files: announcement["images"]});
		//}
	// }, timezone='America/New_York');
	// }, undefined, true, timezone='America/New_York');
	});
	// For some reason, the above method adds a bunch of null garbage to the list so we need to strip that out
	//		While we're at it, we will just add the real elements to a different list so we can start them all
	jobs.push(temp_jobs.filter(function (element) {
		return element != null;
	}));
	console.log(`job: ${announcement["cron"]}`);
})


// jobs.forEach(job => {
// 	job[0].start()
// })

// When the bot connects
client.on('ready', () => {
	console.info(`Logged in as ${client.user.tag}!`);
});
