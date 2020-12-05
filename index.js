require('dotenv').config();
const Discord = require('discord.js');
const client = new Discord.Client({disableEveryone: false});
const TOKEN = process.env.TOKEN;

// ID of the Forex server
const server_id = '576915096924848129';

const fs = require('fs');
const cron = require('cron');

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
	temp_jobs[job_id] = new cron.CronJob(announcement["cron"], () =>{
		const guild = client.guilds.cache.get(server_id);
		// Find the channel we want to cross-post to and store its channel object
		const channel = guild.channels.cache.find(channel => channel.id === announcement["channel"]);
		// Then send our re-formatted string and our images (if any) to that channel
		channel.send(announcement["message"]);
		console.info('Did this work?');
	}, timezone='America/New_York');
	// For some reason, the above method adds a bunch of null garbage to the list so we need to strip that out
	//		While we're at it, we will just add the real elements to a different list so we can start them all
	jobs.push(temp_jobs.filter(function (element) {
		return element != null;
	}));
})

// Run thru and start all the jobs
jobs.forEach(job => {
	job[0].start()
})



// When the bot connects
client.on('ready', () => {
	console.info(`Logged in as ${client.user.tag}!`);
});
