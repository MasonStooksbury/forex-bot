require('dotenv').config();
const Discord = require('discord.js');
const client = new Discord.Client();
const TOKEN = process.env.TOKEN;

const prefix = '~';
const server_id = '690731272875802684';
// const server_id = '746527970310488175';

const emojis = require('./emojis');
const fs = require('fs');
const cheerio = require('cheerio');
const axios = require('axios');
const cron = require('cron');
const fetch = require('node-fetch');

// If you change the name of the text file, you'll need to change it here too
const unaccepted_words_txt = './unaccepted_words.txt';
const villains_txt = './villains.txt';
const ban_txt = './ban.txt';
const real_faces_txt = './real_faces.txt';
const no_real_faces_txt = './no_real_faces.txt';

let username = '';
let discriminator = '';

client.login(TOKEN);

// Takes the label and value of the string and returns a string with the label and the value represented as server emojis
function emojifyNumbers(label, value, format='pair') {
	let full_rating = parseInt(value)
	let rating_color = '';

	// Figure out what color we need based on the rating ranges
	if (full_rating >= 81) {
		rating_color = '_DG';
	} else if (full_rating >= 71 && full_rating <= 80) {
		rating_color = '_LG';
	} else if (full_rating >= 61 && full_rating <= 70) {
		rating_color = '_Y';
	} else if (full_rating >= 51 && full_rating <= 60) {
		rating_color = '_O';
	} else if (full_rating <= 50) {
		rating_color = '_R';
	}

	if (format !== 'single') {
		// This is completely unreadable. BUT. This creates the string to return with the label and emojified numbers. This is also designed to handle single digit values
		return `${label}: ${client.emojis.cache.find(emoji => emoji.name === `${value[0]}${rating_color}`)}${value.length > 1 ? ` ${client.emojis.cache.find(emoji => emoji.name === `${value[1]}${rating_color}`)}` : ''}\n`;
	} else {
		// This is completely unreadable. BUT. This creates the string to return the emojified numbers. This is also designed to handle single digit values
		return `${client.emojis.cache.find(emoji => emoji.name === `${value[0]}${rating_color}`)}${value.length > 1 ? ` ${client.emojis.cache.find(emoji => emoji.name === `${value[1]}${rating_color}`)}` : ''}`;
	}
}

// My own version of the pagination npm package found here: https://github.com/saanuregh/discord.js-pagination
// I needed to add some custom functionality to this and move a bunch of stuff around, this seemed easier than installing it and having another, not recently maintained npm package
async function tabbedEmbed(msg, pages, channel='channel') {
	// How long to let them flip thru pages
	timeout = 120000;
	// What should the left and right arrows look like?
	emoji_list = ['⏪', '⏩'];
	// Explode if they:
	//		[1] Don't pass in a message
	// 		[2] Give us an inaccessible message channel
	//		[3] Don't pass in some pages
	if (!msg && !msg.channel) throw new Error('Channel is inaccessible.');
	if (!pages) throw new Error('Pages are not given.');

	let page = 0;
	let current_page = '';
	let payload = pages[page].setFooter(`Page ${page + 1} / ${pages.length}`);
	if (channel == 'dm') {
		current_page = await msg.author.send(payload);
	} else {
		current_page = await msg.channel.send(payload);
	}
	for (const emoji of emoji_list) await current_page.react(emoji);

	const reaction_collector = current_page.createReactionCollector(
		(reaction, user) => emoji_list.includes(reaction.emoji.name) && !user.bot,
		{ time: timeout }
	);

	reaction_collector.on('collect', reaction => {
		if (msg.channel.type !== 'dm'){
			// Removes the reaction so the user only has to react once to change pages (only works in server)
			reaction.users.remove(msg.author);
		}
		switch (reaction.emoji.name) {
			case emoji_list[0]:
				page = page > 0 ? --page : pages.length - 1;
				break;
			case emoji_list[1]:
				page = page + 1 < pages.length ? ++page : 0;
				break;
			default:
				break;
		}
		current_page.edit(pages[page].setFooter(`Page ${page + 1} / ${pages.length}`));
	});
	reaction_collector.on('end', () => current_page.reactions.removeAll());
	return current_page;
};

// Message a specific user. Mainly used in the Major Events logs
async function messageFifer(message) {
	// Find the guild
	const guild = client.guilds.cache.get(server_id);

	// Iterate through the collection of GuildMembers from the Guild and DM each one with our message
	guild.members.cache.forEach(person => {
		// Make sure we don't try to DM bots (as it will explode) and make sure we only DM FIFER
		if (!person.user.bot && person.roles.cache.some(role => role.name === 'FIFER')) {
			// Send the message to a given user
			try {
				client.users.cache.get(person.user.id).send(message);
			} catch (error) {
				console.error(`Couldn't message ${person.user.id} (${person.user.username}), here's the error:\n` + error);
			}
		}
	});
}



// Setup the witchhunter cron job to run: 00 01 * * * *
// That is the first minute of every hour of every day of the month of every month for every day of the week
let witchhunter = new cron.CronJob('00 01 * * * *', () => {
	// Get the Guild and store it under the variable "guild"
	const guild = client.guilds.cache.get(server_id);

	var people = []

	// Iterate through the collection of GuildMembers from the Guild and DM each one with our message
	guild.members.cache.forEach(member => {
		// Make sure we don't try to DM bots (as it will explode) and make sure we only DM those that are opted in
		if (!member.user.bot) {
			fs.readFile(unaccepted_words_txt, 'utf8', function(err, data) {
				if (err) throw err;
	
				data = data.split(/\r?\n/);
	
				dict = {};
				data.forEach(word => {
					// If message contains an unaccepted word and you are not an Admin, delete the message
					if ((member.displayName.toLowerCase().includes(word) || member.user.username.toLowerCase().includes(word)) && !member.roles.cache.some(role => role.name === 'Admin')) {
						// console.log(`${member.displayName} is actually ${member.user.username}, and has an unaccepted word in their name`);
						people.push(member.displayName);
					}
				});
			});
		}
	});

	// Find FIFER and message him
	guild.members.cache.forEach(person => {
		// Make sure we don't try to DM bots (as it will explode) and make sure we only DM those that are opted in
		if (!person.user.bot && person.roles.cache.some(role => role.name === 'FIFER')) {
			if (people.length > 0) {
				client.users.cache.get(person.user.id).send('Here are the guilty:');
				client.users.cache.get(person.user.id).send(people.pop());
			} else {
				console.log('No guilty found during the witchhunt');
			}
		}
	});
});

// Setup the gatekeeper cron job to run: 00 01 12 * * *
// That is the 12:01 every day of the month of every month for every day of the week
let gatekeeper = new cron.CronJob('00 55 10 * * *', () => {
	// Check our ban list
	fs.readFile(ban_txt, 'utf8', function(err, data) {
		// If we find any problems, explode
		if (err) throw err;

		// Split up the data so that each line is an element in this array
		let things = data.split(/\r?\n/);
		// Create a dictionary so that we can store the user ID with the date to unban them
		let dict = {};

		// Loop thru the array, split up the line, and put it into the dictionary as a key/value pair
		things.forEach(thing => {
			const split = thing.split(' ');
			dict[split[0]] = split[1] == undefined ? '' : split[1];
		})

		// Create a list of people to unban if today is their unban day
		let the_forgiven = [];
		let the_broken = [];
		for (let key in dict) {
			if (dict[key] === new Date(Date.now()).toLocaleString().split(',')[0]) {
				the_forgiven.push(key);
				delete dict[key];
			} else if (key === '' && dict[key] === '') {
				console.log('Weird case in gatekeeper: Ignore.');
			} else if (dict[key] === '') {
				the_broken.push(key);
			}
		}
		

		if (the_forgiven.length >= 1) {
			the_forgiven.forEach(forgiven => {
				// Get the Guild and store it under the variable "guild"
				const guild = client.guilds.cache.get(server_id);
				// Find the channel we want to post in
				const channel = guild.channels.cache.find(channel => channel.id === '690731272875802687');
				
				// Unban the forgiven and post a message stating that they have been allowed to return to the fold
				guild.members.unban(forgiven)
					.then(channel.send(`<@${forgiven}> has been unbanned as of today. Yay! :)`))
					.catch(console.error);


				// Since we have forgiven some people, we need to rewrite our ban file but with these people now removed
		
				// Here is why we are doing streams rather than appendFile or appendFileSync:
				// https://stackoverflow.com/questions/3459476/how-to-append-to-a-file-in-node/43370201#43370201
		

				// Write every entry to the file
				var stream = fs.createWriteStream('ban.txt', { flags: 'w' });
				for (let key in dict) {
					stream.write(`${key} ${dict[key]}`);
				}
			});
		}
		
		// If we find people that do not have an unban date, message FIFER
		// In a perfect world, this should never happen. But if it magically does, this should help mitigate it
		if (the_broken.length >= 1) {
			// Get the Guild and store it under the variable "guild"
			const guild = client.guilds.cache.get(server_id);
			// Loop thru all members looking for FIFER
			guild.members.cache.forEach(person => {
				// Make sure we don't try to DM bots (as it will explode) and make sure we only DM those that are opted in
				if (!person.user.bot && person.roles.cache.some(role => role.name === 'FIFER')) {
					client.users.cache.get(person.user.id).send('During unbanning I noticed that these people do not have an unban date. Is this correct?:');
					client.users.cache.get(person.user.id).send(the_broken);
				}
			});
		}

	});
});


// Start up the witchhunter by default (you can stop it with the subsequent command at the bottom)
witchhunter.start();
// Start up the gatekeeper by default (you can stop it with the subsequent command at the bottom)
gatekeeper.start();

// When the bot connects
client.on('ready', () => {
	console.info(`Logged in as ${client.user.tag}!`);
});

// When the bot detects that someone has joined the server
client.on('guildMemberAdd', member => {
	// Make sure we don't try to DM bots (as it will explode) and make sure we only DM those that are opted in
	if (!member.user.bot) {
		// Get the Guild and store it under the variable "guild"
		const guild = client.guilds.cache.get(server_id);
		// Find the channel we want to post in
		const general_channel = guild.channels.cache.find(channel => channel.id === '690731272875802687');


		// If they are already in the list, then we don't need to add it twice
		fs.readFile(villains_txt, 'utf8', function(err, data) {
			if (err) throw err;

			data = data.split(/\r?\n/);

			dict = {}
			data.forEach(thing => {
				const split = thing.split(' ');
				dict[split[0]] = {
					'action': split[1] == undefined ? '' : split[1],
					'reason': thing.split(' --- ')[1]
				};
			})

			// Loop thru all the villains
			for (let key in dict) {
				// Make sure nothing weird happens at the EOF
				if (key !== '' && dict[key]['action'] !== '') {
					// If we need to ban them: ban them and send a warning
					if (key === member.user.id && dict[key]['action'] === 'ban') {
						const message_to_user = 'Fuck you, go away';
						const message_to_audit_log = 'Troublemaker from another server';
						const ban_object = { days: 7, reason: message_to_audit_log };
						console.log(ban_object);
		
						// Send the person a message informing them that they have been banned. Then ban them
						member.send(message_to_user).then(function(){
							member.ban(ban_object);
							general_channel.send(`<@${key}> has been autobanned\n Reason: ${dict[key]['reason']}`);
							return;
						}).catch(function(){
							member.ban(ban_object);
							general_channel.send(`<@${key}> has been autobanned\n Reason: ${dict[key]['reason']}`);
							return;
						});
					}
					// Otherwise, we just need to warn
					else if (key === member.user.id && dict[key]['action'] === 'warn') {
						general_channel.send(`<@${key}> has joined and is on the watch list\n Reason: ${dict[key]['reason']}`);
					}
				}
			}
		});
		
		// Report them if they have a bad word in their name
		fs.readFile(unaccepted_words_txt, 'utf8', function(err, data) {
			if (err) throw err;
	
			data = data.split(/\r?\n/);
	
			dict = {};
			data.forEach(word => {
				// If message contains an unaccepted word and you are not an Admin, delete the message
				if ((member.displayName.toLowerCase().includes(word) || member.user.username.toLowerCase().includes(word)) && !member.roles.cache.some(role => role.name === 'Admin')) {
					general_channel.send(`<@${member.user.id}> is actually ${member.user.username}. They just joined the server and have an unaccepted word in their name`);
				}
			});
		});

		try {
			client.users.cache.get(member.user.id).send('Hey, thanks for joining, here is a useful resource: ');
		} catch {
			// Get the Guild and store it under the variable "guild"
			const guild = client.guilds.cache.get(server_id);
			guild.members.cache.forEach(person => {
				// Make sure we don't try to DM bots (as it will explode) and make sure we only DM those that are opted in
				if (!person.user.bot && person.roles.cache.some(role => role.name === 'FIFER')) {
					client.users.cache.get(person.user.id).send(`Tried to message the new member: ${member.displayName} and could not. They may have DMs disabled.`);
				}
			});
		}
	}
});







// On Member banned
// guildBanAdd
/* Emitted whenever a member is banned from a guild.
PARAMETER    TYPE          DESCRIPTION
guild        Guild         The guild that the ban occurred in
user         User          The user that was banned    */
client.on("guildBanAdd", function(guild, user){
	messageFifer(`MAJOR EVENT: ${user.tag} was banned ${guild}`);
});

// On Member kicked
// guildMemberRemove
/* Emitted whenever a member leaves a guild, or is kicked.
PARAMETER     TYPE               DESCRIPTION
member        GuildMember        The member that has left/been kicked from the guild    */
client.on("guildMemberRemove", function(member){
	messageFifer(`MAJOR EVENT: ${member.tag} left or was kicked`);
});

// On Channel created
// channelCreate
/* Emitted whenever a channel is created.
PARAMETER    TYPE        DESCRIPTION
channel      Channel     The channel that was created    */
client.on("channelCreate", function(channel){
	if (channel.type !== 'dm') {
		console.log(channel);
		// May need this if we want person that did it
		// https://stackoverflow.com/questions/62964241/how-do-i-fetch-the-creator-of-a-channel-in-discord
		messageFifer(`MAJOR EVENT: The ${channel} (${channel.name}) channel was created`);
	}
});

// On Channel deleted
// channelDelete
/* Emitted whenever a channel is deleted.
PARAMETER   TYPE      DESCRIPTION
channel     Channel   The channel that was deleted    */
client.on("channelDelete", function(channel){
	if (channel.type !== 'dm') {
		messageFifer(`MAJOR EVENT: The ${channel.name} channel was deleted`);
	}
});

// On Channel updated
// channelUpdate
/* Emitted whenever a channel is updated - e.g. name change, topic change, channel type change.
PARAMETER	TYPE	  					DESCRIPTION
oldChannel	DMChannel | GuildChannel	The channel before the update
newChannel	DMChannel | GuildChannel	The channel after the update 		*/
client.on("channelUpdate", function(oldChannel, newChannel){
	messageFifer(`MAJOR EVENT: The ${oldChannel.name} channel was updated in someway. Possible new updates found in: ${newChannel.name}`);
});

// On Role Created
// roleCreate
/* Emitted whenever a role is created.
PARAMETER    TYPE        DESCRIPTION
role         Role        The role that was created    */
client.on("roleCreate", function(role){
	messageFifer(`MAJOR EVENT: The ${role} role was created`);
});

// On Role Deleted
// roleDelete
/* Emitted whenever a guild role is deleted.
PARAMETER    TYPE        DESCRIPTION
role         Role        The role that was deleted    */
client.on("roleDelete", function(role){
	messageFifer(`MAJOR EVENT: The ${role} role was deleted`);
});

// On Role Updated
// roleUpdate
/* Emitted whenever a guild role is updated.
PARAMETER	TYPE	DESCRIPTION
oldRole		Role	The role before the update
newRole		Role	The role after the update			*/
client.on("roleUpdate", function(oldRole, newRole){
	messageFifer(`MAJOR EVENT: The ${oldRole.name} role was updated somehow. Possible new updates found in: ${newRole.name}`);
});

// On Emoji created
// emojiCreate
/* Emitted whenever a custom emoji is created in a guild.
PARAMETER    TYPE          DESCRIPTION
emoji        Emoji         The emoji that was created    */
client.on("emojiCreate", function(emoji){
	messageFifer(`MAJOR EVENT: The ${emoji} emoji was created`);
});

// On Emoji deleted
// emojiDelete
/* Emitted whenever a custom guild emoji is deleted.
PARAMETER    TYPE         DESCRIPTION
emoji        Emoji        The emoji that was deleted    */
client.on("emojiDelete", function(emoji){
	messageFifer(`MAJOR EVENT: The ${emoji} emoji was deleted`);
});

// On Emoji updated
// emojiUpdate
/* Emitted whenever a custom guild emoji is updated.
PARAMETER    	TYPE         DESCRIPTION
oldEmoji        Emoji        The emoji before the update
newEmoji        Emoji        The emoji after the update		   */
client.on("emojiUpdate", function(oldEmoji, newEmoji){
	messageFifer(`MAJOR EVENT: The ${oldEmoji.name} emoji was updated somehow. Possible new updates found in: ${newEmoji.name}`);
});

// On messages purged?
// messageDeleteBulk
/* Emitted whenever messages are deleted in bulk.
PARAMETER    TYPE                              DESCRIPTION
messages     Collection<Snowflake, Message>    The deleted messages, mapped by their ID    */
client.on("messageDeleteBulk", function(messages){
	messageFifer(`MAJOR EVENT: These messages were deleted in bulk:\n\n ${messages}`);
});

// webhookUpdate
/* Emitted whenever a guild text channel has its webhooks changed.
PARAMETER    TYPE                              DESCRIPTION
channel		 TextChannel					   The channel that had a webhook update    */
client.on("webhookUpdate", function(channel){
	if (channel.type !== 'dm') {
		messageFifer(`MAJOR EVENT: A webhook was updated in ${channel}`);
	}
});

// guildUpdate
/* Emitted whenever a guild is updated - e.g. name change.
PARAMETER	TYPE							   DESCRIPTION
oldGuild	Guild							   The guild before the update
newGuild	Guild							   The guild after the update				*/
client.on("guildUpdate", function(oldGuild, newGuild){
	messageFifer(`MAJOR EVENT: The ${oldGuild} was updated somehow. Possible name change to ${newGuild}`);
});









// When the bot detects that the message has been sent
client.on('message', msg => {
	// Delete messages with certain words: Open our text file and look for our ID
	fs.readFile(unaccepted_words_txt, 'utf8', function(err, data) {
		if (err) throw err;

		// Put each line as its own element in an array. Account for different line endings
		data = data.split(/\r?\n/);

		dict = {};
		data.forEach(word => {
			// If message contains an unaccepted word and you are not an Admin, delete the message
			if (!msg.author.bot && msg.channel.type !== 'dm' && msg.content.toLowerCase().includes(word) && !msg.member.roles.cache.some(role => role.name === 'Admin')) {
				msg.delete().catch(console.error);
			} else if (!msg.author.bot && msg.channel.type !== 'dm' && msg.content.toLowerCase().includes(word)){
				msg.author.send("Ayyyy, let's not use no-no words, m'kay?");
			}
		});
	});

	// If they try to DM the bot without a prefix, message them telling them how to do so
	if (!msg.author.bot && msg.channel.type == 'dm' && !msg.content.startsWith(prefix)) {
		return msg.reply("Please use the prefix: ~ (That's the squiggly. Usually found under the Esc key)");
	}

	// If this isn't a command, or the user is a bot, leave
	if (!msg.content.startsWith(prefix) || msg.author.bot) return;

	// If they DM the bot, make sure we log EXACTLY who they are to prevent mess-ups
	if (msg.channel.type == 'dm') {
		// Get the username of the messenger
		username = msg.channel.recipient.username;
		// Get the discriminator of the messenger (the #0000 portion)
		discriminator = msg.channel.recipient.discriminator;
	}
	// 
	else if (msg.content.startsWith(prefix + 'xpost')) {
		username = msg.member.user.username;
		discriminator = msg.member.user.discriminator;
	}
	// If the commands are not executed in the correct channel and they are not an Admin
	else if (msg.channel.id !== '690731272875802687' && !msg.member.roles.cache.some(role => role.name === 'Admin')) {
		// Delete their message
		msg.delete().catch(console.error);
		// Tell them where to post it
		msg.author.send('Please post bot commands in the <#690731272875802687> channel');
		return;
	} else {
		username = msg.member.user.username;
		discriminator = msg.member.user.discriminator;
	}

	// Get the Guild and store it under the variable "guild"
	const guild = client.guilds.cache.get(server_id);

	// Loop thru all of the members in the server
	guild.members.cache.forEach(member => {
		// If the member is not a bot, and we have the exact username and discriminator of the person we want
		if (!member.user.bot && member.user.username === username && member.user.discriminator === discriminator) {
			// A command that will DM literally everyone (except bots) as long as you are FIFER
			if (msg.content.startsWith(prefix + 'dmeveryone') && (member.roles.cache.some(role => role.name === 'FIFER') || member.roles.cache.some(role => role.name === 'Admin'))) {
				// Get the Guild and store it under the variable "guild"
				const guild = client.guilds.cache.get(server_id);

				let pieces_string = msg.content.slice(prefix.length + 'dmeveryone '.length);
				let pieces = pieces_string.split(' --- ');
				if (pieces.length !== 2) {
					return msg.reply('Please use the following format (note the 3 dashes with spaces on either side):\n~dmeveryone <ROLE> --- <MESSAGE>');
				}
				const role_to_message = pieces[0];
				const message = pieces[1];

				if (!member.roles.cache.some(role => role.name === 'FIFER') && role_to_message === 'everyone') {
					return msg.reply('Sorry, but you have to be FIFER to message everyone');
				}

				// Iterate through the collection of GuildMembers from the Guild and DM each one with our message
				guild.members.cache.forEach(person => {
					// Make sure we don't try to DM bots (as it will explode) and make sure we only DM those that are opted in
					if (!person.user.bot && !person.roles.cache.some(role => role.name === 'OPTOUT_MASS_DM')) {
						// Only message the person if we are messaging everyone, or if they have the role we are trying to message. Otherwise, do nothing
						if (role_to_message === 'everyone' || person.roles.cache.some(role => role.name === role_to_message) ? true : false) {
							// Send the message to a given user
							try {
								client.users.cache.get(person.user.id).send(message);
							} catch (error) {
								console.error(`Couldn't message ${person.user.id} (${person.user.username}), here's the error:\n` + error);
							}
						}
					}
				});
			}

			// Opt out
			else if (msg.content.startsWith(prefix + 'optout')) {
				// If they have already opted out, let them know
				if (member.roles.cache.some(role => role.name === 'OPTOUT_MASS_DM')) {
					msg.author.send("You are already opted out! :)");
				}
				// Else, opt them out by adding the role and letting them know
				else {
					// Grab the actual role object
					var role = guild.roles.cache.find(role => role.name === "OPTOUT_MASS_DM");
					// Assign the role object to our messenger
					member.roles.add(role);
					msg.author.send("You have opted out from receiving mass-DM messages! If you notice any issues, please screenshot them and send them to an admin :)");
				}
			}

			// Opt in
			else if (msg.content.startsWith(prefix + 'optin')) {
				// If they have already opted in, let them know
				if (!member.roles.cache.some(role => role.name === 'OPTOUT_MASS_DM')) {
					msg.author.send("You are already opted in! :)");
				}
				// Else, opt them in by removing the role and letting them know
				else {
					// Grab the actual role object
					const role = guild.roles.cache.find(role => role.name === 'OPTOUT_MASS_DM');
					// Remove the role from our member
					member.roles.remove(role);
					msg.author.send("You have opted in to receive mass-DM messages! If you notice any issues, please screenshot them and send them to an admin :)");
				}
			}

			// faq
			else if (msg.content.startsWith(prefix + 'help')) {
				if (msg.channel.type !== 'dm') {
					const channel = msg.guild.channels.cache.find(channel => channel.id === '690731272875802687');
					channel.send(`<@${member.user.id}>, please DM me instead :)`);
					return;
				}
				// This will send the first question and react with however many emojis are programmed
				msg.author.send('**What does your issue relate to?**\n\n:one: Error from Frosty Mod Manager\n:two: Game crashing\n:three: Mod bugs/glitches\n:four: Other Issue with downloading/installing the mod\n:six: I just have a question\n:seven: My issue is not releated to any of these\n\nPlease React with the following emoji down below :)').then(reaction => {
					reaction.react(emojis[1])
						.then(() => reaction.react(emojis[2]))
						.then(() => reaction.react(emojis[3]))
						.then(() => reaction.react(emojis[4]))
						.then(() => reaction.react(emojis[5]))
						.then(() => reaction.react(emojis[6]))
						.then(() => reaction.react(emojis[7]));
				})
					// Once we have sent the message, we then create a filter so that the bot knows which emojis to look for
					.then(unused => {
						const filter = (reaction, user) => {
							return [emojis[1], emojis[2], emojis[3], emojis[4], emojis[5], emojis[6], emojis[7]].includes(reaction.emoji.name) && user.id === msg.author.id;
						};
						
						// From here, we grab the last message from the channel
						msg.channel.messages.fetch({ limit: 1 }).then(message => {
							// And THEN we officially wait for the reactions here. We will give them 60000 milliseconds (60 seconds) to respond
							message.last().awaitReactions(filter, { max: 1, time: 60000, errors: ['time'] })
								// Once they respond, trigger the option they selected to display the next part of the directory
								.then(collected => {
									const reaction = collected.first();
		
									// Option 1
									if (reaction.emoji.name === emojis[1]) {
										// Basically from here on, the steps are the same as above and only the number of options and what they say are different
										msg.author.send('\n\n**Which error are you running into?**\n\n:one: Access to the path ______ is denied. \n:two: One ore more symbolic links could not be created, please restart tool as Administrator.\n:three: The requested operation requires elevation \n:four: New Installation Detected\n:five: Mod was designed for a different patch version, it may or may not work\n:six: Array dimensions exceeded supported range.\n:seven: Insufficient memory to continue the execution of the program.\n:eight: Stream length must be non-negative\n:nine: The object reference is not set to any object instance.\n:keycap_ten: Value cannot be null Parameter name: value\n\nPlease react with the following emoji down below :)').then(reaction => {
											reaction.react(emojis[1])
												.then(() => reaction.react(emojis[2]))
												.then(() => reaction.react(emojis[3]))
												.then(() => reaction.react(emojis[4]))
												.then(() => reaction.react(emojis[5]))
												.then(() => reaction.react(emojis[6]))
												.then(() => reaction.react(emojis[7]))
												.then(() => reaction.react(emojis[8]))
												.then(() => reaction.react(emojis[9]))
												.then(() => reaction.react(emojis[10]));
										}).then(stuff => {
											const filter = (reaction, user) => {
												return [emojis[1], emojis[2], emojis[3], emojis[4], emojis[5], emojis[6], emojis[7], emojis[8], emojis[9], emojis[10]].includes(reaction.emoji.name) && user.id === msg.author.id;
											};
			
											msg.channel.messages.fetch({ limit: 1 }).then(message => {
												message.last().awaitReactions(filter, { max: 1, time: 60000, errors: ['time'] })
													.then(collected => {
														const reaction = collected.first();
				
														if (reaction.emoji.name === emojis[1]) {
															msg.author.send("\n\n**Please take the following steps to resolve your issue:**\n\n1. Go to where you installed FIFA 20, normally in Program Files (x86)\Origin Games on whatever drive, right click the FIFA 20 folder, click Properties and untick Read Only, then if something pops up click Apply to all files and subfolders (https://i.imgur.com/bpoyYC2.gif).\n 2. Restart your PC\n 3. Make sure you have no programs open that would be viewing FIFA's files, such as Frosty Editor or FIFA itself, if you have one of these open, close them.\n4. Run Frosty Mod Manager as admin\n\nIf none of these soluttions work, please **fill out the template** posted here: <https://rebrand.ly/helptemplate> and then ask here: <https://rebrand.ly/modhelp> or if you're a patron of FIFER's Realism Mod, here: <https://rebrand.ly/patronhelp>");
														} else if (reaction.emoji.name === emojis[2]) {
															msg.author.send("\n\n**Please take the following steps to resolve your issue:**\n\n1. Reinstall Frosty Mod Manager (so delete the files, then redownload it from <https://rebrand.ly/modmanagerdl>, re-extract all the files and folders into a sepereate folder just for Frosty Mod Manager.\n2. Restart your PC.\n3. Go to the folder where Frosty Mod Manager is installed, and right click on FrostyModManager.exe, then click Properties, then go to the Compatibility tab and tick Run this program as an administrator\n4. Open Frosty Mod Manager and when it asks if you want to run it as adminstrator click Yes (if it doesn't repeat step 3), then if you have any mods remove them, and then reimport all the mods you want. Then click launch again.\n\nIf none of these soluttions work, please **fill out the template** posted here: <https://rebrand.ly/helptemplate> and then ask here: <https://rebrand.ly/modhelp> or if you're a patron of FIFER's Realism Mod, here: <https://rebrand.ly/patronhelp>");
														} else if (reaction.emoji.name === emojis[3]) {
															msg.author.send("\n\n**Please take the following steps to resolve your issue:**\n\n1. Reinstall Frosty Mod Manager (so delete the files, then redownload it from <https://rebrand.ly/modmanagerdl>, re-extract all the files and folders into a sepereate folder just for Frosty Mod Manager.\n2. Restart your PC.\n3. Go to the folder where Frosty Mod Manager is installed, and right click on FrostyModManager.exe, then click Properties, then go to the Compatibility tab and tick Run this program as an administrator\n4. Open Frosty Mod Manager and when it asks if you want to run it as adminstrator click Yes (if it doesn't repeat step 3), then if you have any mods remove them, and then reimport all the mods you want. Then click launch again.\n\nIf none of these soluttions work, please **fill out the template** posted here: <https://rebrand.ly/helptemplate> and then ask here: <https://rebrand.ly/modhelp> or if you're a patron of FIFER's Realism Mod, here: <https://rebrand.ly/patronhelp>");
														} else if (reaction.emoji.name === emojis[4]) {
															msg.author.send("\n\nThis isn't an error, just click OK and your game will start up automatically.\n\nIf none of these soluttions work, please **fill out the template** posted here: <https://rebrand.ly/helptemplate> and then ask here: <https://rebrand.ly/modhelp> or if you're a patron of FIFER's Realism Mod, here: <https://rebrand.ly/patronhelp>");
														} else if (reaction.emoji.name === emojis[5]) {
															msg.author.send("\n\n**Use this guide to help you**\n\nWhat mods does this error come up for?\n**Main Mods (like graphics, faces, etc):** This means that you are using the wrong version of FIFA or the mod. Check <https://rebrand.ly/versioninfo> to see what version of FIFA and the mod you need.\n**The Turf and/or Cameras Mod:** This is fine, both mods will still work.\n**Scoreboards, Menu Color Themes or TV Logos:** These will not work.Check <https://rebrand.ly/versioninfo> to see if you are using the right version of the mod and FIFA.\n**Any other addon mods:** Most likley this is fine, but just check <https://rebrand.ly/versioninfo> to see if you are using the right version of the mod and FIFA.\n\n**General Info**\nIf you think you are using the right version of FIFA and mod try updating FIFA again, and make sure to check the version info channel carefully to see if there is a new FIFA update and a hotfix required.\n\nIf none of these soluttions work, please **fill out the template** posted here: <https://rebrand.ly/helptemplate> and then ask here: <https://rebrand.ly/modhelp> or if you're a patron of FIFER's Realism Mod, here: <https://rebrand.ly/patronhelp>");
														} else if (reaction.emoji.name === emojis[6]) {
															msg.author.send("\n\n**Please take the following steps to resolve your issue:**\n\n1. Reinstall Frosty Mod Manager (so delete the files, then redownload it from <https://rebrand.ly/modmanagerdl>, re-extract all the files and folders into a sepereate folder just for Frosty Mod Manager.\n2. Restart your PC.\n3. Go to the folder where Frosty Mod Manager is installed, and right click on FrostyModManager.exe, then click Properties, then go to the Compatibility tab and tick Run this program as an administrator\n4. Open Frosty Mod Manager and when it asks if you want to run it as adminstrator click Yes (if it doesn't repeat step 3), then if you have any mods remove them, and then reimport all the mods you want. Then click launch again.\n\nIf none of these soluttions work, please **fill out the template** posted here: <https://rebrand.ly/helptemplate> and then ask here: <https://rebrand.ly/modhelp> or if you're a patron of FIFER's Realism Mod, here: <https://rebrand.ly/patronhelp>");
														} else if (reaction.emoji.name === emojis[7]) {
															msg.author.send("\n\n**Please take the following steps to resolve your issue:**\n\n1. Restart your PC\n2. Open task manager and make sure memory usage isn't above 80%. If it is, close some of the programs that are open,\n\nIf none of these soluttions work, please **fill out the template** posted here: <https://rebrand.ly/helptemplate> and then ask here: <https://rebrand.ly/modhelp> or if you're a patron of FIFER's Realism Mod, here: <https://rebrand.ly/patronhelp>");
														} else if (reaction.emoji.name === emojis[8]) {
															msg.author.send("\n\n**Please take the following steps to resolve your issue:**\n\n1. Reinstall Frosty Mod Manager (so delete the files, then redownload it from <https://rebrand.ly/modmanagerdl>, re-extract all the files and folders into a sepereate folder just for Frosty Mod Manager.\n2. Restart your PC.\n3. Go to the folder where Frosty Mod Manager is installed, and right click on FrostyModManager.exe, then click Properties, then go to the Compatibility tab and tick Run this program as an administrator\n4. Open Frosty Mod Manager and when it asks if you want to run it as adminstrator click Yes (if it doesn't repeat step 3), then if you have any mods remove them, and then reimport all the mods you want. Then click launch again.\n\nIf none of these soluttions work, please **fill out the template** posted here: <https://rebrand.ly/helptemplate> and then ask here: <https://rebrand.ly/modhelp> or if you're a patron of FIFER's Realism Mod, here: <https://rebrand.ly/patronhelp>");
														} else if (reaction.emoji.name === emojis[9]) {
															msg.author.send("\n\n**Please take the following steps to resolve your issue:**\n\n1. Reinstall Frosty Mod Manager (so delete the files, then redownload it from <https://rebrand.ly/modmanagerdl>, re-extract all the files and folders into a sepereate folder just for Frosty Mod Manager.\n2. Restart your PC.\n3. Go to the folder where Frosty Mod Manager is installed, and right click on FrostyModManager.exe, then click Properties, then go to the Compatibility tab and tick Run this program as an administrator\n4. Open Frosty Mod Manager and when it asks if you want to run it as adminstrator click Yes (if it doesn't repeat step 3), then if you have any mods remove them, and then reimport all the mods you want. Then click launch again.\n\nIf none of these soluttions work, please **fill out the template** posted here: <https://rebrand.ly/helptemplate> and then ask here: <https://rebrand.ly/modhelp> or if you're a patron of FIFER's Realism Mod, here: <https://rebrand.ly/patronhelp>");
														} else if (reaction.emoji.name === emojis[10]) {
															msg.author.send("\n\n**Please take the following steps to resolve your issue:**\n\n1. Reinstall Frosty Mod Manager (so delete the files, then redownload it from <https://rebrand.ly/modmanagerdl>, re-extract all the files and folders into a sepereate folder just for Frosty Mod Manager.\n2. Restart your PC.\n3. Go to the folder where Frosty Mod Manager is installed, and right click on FrostyModManager.exe, then click Properties, then go to the Compatibility tab and tick Run this program as an administrator\n4. Open Frosty Mod Manager and when it asks if you want to run it as adminstrator click Yes (if it doesn't repeat step 3), then if you have any mods remove them, and then reimport all the mods you want. Then click launch again.\n\nIf none of these soluttions work, please **fill out the template** posted here: <https://rebrand.ly/helptemplate> and then ask here: <https://rebrand.ly/modhelp> or if you're a patron of FIFER's Realism Mod, here: <https://rebrand.ly/patronhelp>");
														}
													})
													// If they don't respond in time, send them this.
													.catch(collected => {
														msg.reply('You did not provide a reaction within 60 seconds, please try again.');
													});
											});
										});
									} 
									
									// Option 2
									else if (reaction.emoji.name === emojis[2]) {
										msg.author.send('When does your game crash?\n\n:one: When entering Edit Player\n:two: When creating a tournament\n:three: When I enter squad hub\n:four: Randomly in the menus\n:five: When I go to sim/play a game\n:six: Other').then(reaction => {
											reaction.react(emojis[1])
												.then(() => reaction.react(emojis[2]))
												.then(() => reaction.react(emojis[3]))
												.then(() => reaction.react(emojis[4]))
												.then(() => reaction.react(emojis[5]))
												.then(() => reaction.react(emojis[6]));
										}).then(stuff => {
											const filter = (reaction, user) => {
												return [emojis[1], emojis[2], emojis[3], emojis[4], emojis[5], emojis[6]].includes(reaction.emoji.name) && user.id === msg.author.id;
											};
			
											msg.channel.messages.fetch({ limit: 1 }).then(message => {
												message.last().awaitReactions(filter, { max: 1, time: 60000, errors: ['time'] })
													.then(collected => {
														const reaction = collected.first();
				
														if (reaction.emoji.name === emojis[1]) {
															msg.author.send("**Please take the following steps to resolve your issue:**\n\n1. Repair FIFA\n2. Do the steps outlined in this document: <https://www.patreon.com/posts/40717824>\n3. Reset Squads. To do that go to the customize tab on the main menu, then Edit Teams, then click Reset Squads and if it asks you are you sure click yes.\n\nIf none of these soluttions work, please **fill out the template** posted here: <https://rebrand.ly/helptemplate> and then ask here: <https://rebrand.ly/modhelp> or if you're a patron of FIFER's Realism Mod, here: <https://rebrand.ly/patronhelp>");
														} else if (reaction.emoji.name === emojis[2]) {
															msg.author.send("The mod is meant for career mode, so we have made career mode better in a way that sadly, doesn't work with tournament mode. Basically, the files we edited to add new tournaments like the Club World Cup, have a length limit, and since we added so much there is no room for the tournament to be added (it gets added to the files when you create it).\n\nSo sadly, the only way to fix it is really to disable the Realism Mod FBMod, but by doing so you will lose a lot of the mod's features.\n\nIf you want FIFER to make a mod which makes tournament mode possible by overwriting the mod's tournament changes, react with the :thumbsup: emoji here: <https://rebrand.ly/tournamentreact>.\n\nIf you have any questions ask them here: <https://rebrand.ly/rmgeneral> or here if you're a patron: <https://rebrand.ly/patrongeneral>");
														} else if (reaction.emoji.name === emojis[3]) {
															msg.author.send("Crashing when entering the squad hub is most likley caused by either transfering a player to/from your team via Edit Transfers in game, or using the Live Editor/RDBM Properly. If you did one of those things, the only real way is to load a backup save if you created it. If not, and you trasnferd a player to your team with Edit Transfers in game, try transfering him to free agnets in game again. If you didn't do any of those three things, try doing this: <https://www.patreon.com/posts/40717824>.\n\nIf none of these soluttions work, please **fill out the template** posted here: <https://rebrand.ly/helptemplate> and then ask here: <https://rebrand.ly/modhelp> or if you're a patron of FIFER's Realism Mod, here: <https://rebrand.ly/patronhelp>");
														} else if (reaction.emoji.name === emojis[4]) {
															msg.author.send("**Please take the following steps to resolve your issue:**\n\n1. Repair FIFA\n 2. Do the steps outlined in this document: <https://www.patreon.com/posts/40717824>\n\nIf none of these soluttions work, please **fill out the template** posted here: <https://rebrand.ly/helptemplate> and then ask here: <https://rebrand.ly/modhelp> or if you're a patron of FIFER's Realism Mod, here: <https://rebrand.ly/patronhelp>");
														} else if (reaction.emoji.name === emojis[5]) {
															msg.author.send("Crashing when trying to play/sim a game is most likley caused by either transfering a player to/from your team via Edit Transfers in game, or using the Live Editor/RDBM Properly. If you did one of those things, the only real way is to load a backup save if you created it. If not, and you trasnferd a player to your team with Edit Transfers in game, try transfering him to free agnets in game again. If you didn't do any of those three things, try doing this: <https://www.patreon.com/posts/40717824>.\n\nIf none of these soluttions work, please **fill out the template** posted here: <https://rebrand.ly/helptemplate> and then ask here: <https://rebrand.ly/modhelp> or if you're a patron of FIFER's Realism Mod, here: <https://rebrand.ly/patronhelp>");
														} else if (reaction.emoji.name === emojis[6]) {
															msg.author.send("First, follow the steps outlined in this document: <https://www.patreon.com/posts/40717824>\n\nIf that doesn't work, please **fill out the template** posted here: <https://rebrand.ly/helptemplate> and then ask here: <https://rebrand.ly/modhelp> or if you're a patron of FIFER's Realism Mod, here: <https://rebrand.ly/patronhelp>");
														}
													})
													.catch(collected => {
														msg.reply('You did not provide a reaction within 60 seconds, please try again.');
													});
											});
										});
									}
									
									// Option 3
									else if (reaction.emoji.name === emojis[3]) {
										msg.author.send('Which symptom do you have?\n[1]\n[2]\n[3]').then(reaction => {
											reaction.react(emojis[1]).then(() => reaction.react(emojis[2])).then(() => reaction.react(emojis[3]));
										}).then(stuff => {
											const filter = (reaction, user) => {
												return [emojis[1], emojis[2], emojis[3]].includes(reaction.emoji.name) && user.id === msg.author.id;
											};
			
											msg.channel.messages.fetch({ limit: 1 }).then(message => {
												message.last().awaitReactions(filter, { max: 1, time: 60000, errors: ['time'] })
													.then(collected => {
														const reaction = collected.first();
				
														if (reaction.emoji.name === emojis[1]) {
															msg.author.send("Solution 1");
														} else if (reaction.emoji.name === emojis[2]) {
															msg.author.send("Solution 2");
														} else if (reaction.emoji.name === emojis[3]) {
															msg.author.send("Solution 3");
														}
													})
													.catch(collected => {
														msg.reply('You did not provide a reaction within 60 seconds, please try again.');
													});
											});
										});
									}

									// Option 4
									else if (reaction.emoji.name === emojis[3]) {
										msg.author.send('Which symptom do you have?\n[1]\n[2]\n[3]').then(reaction => {
											reaction.react(emojis[1]).then(() => reaction.react(emojis[2])).then(() => reaction.react(emojis[3]));
										}).then(stuff => {
											const filter = (reaction, user) => {
												return [emojis[1], emojis[2], emojis[3]].includes(reaction.emoji.name) && user.id === msg.author.id;
											};
			
											msg.channel.messages.fetch({ limit: 1 }).then(message => {
												message.last().awaitReactions(filter, { max: 1, time: 60000, errors: ['time'] })
													.then(collected => {
														const reaction = collected.first();
				
														if (reaction.emoji.name === emojis[1]) {
															msg.author.send("Solution 1");
														} else if (reaction.emoji.name === emojis[2]) {
															msg.author.send("Solution 2");
														} else if (reaction.emoji.name === emojis[3]) {
															msg.author.send("Solution 3");
														}
													})
													.catch(collected => {
														msg.reply('You did not provide a reaction within 60 seconds, please try again.');
													});
											});
										});
									}

									// Option 5
									else if (reaction.emoji.name === emojis[3]) {
										msg.author.send('Which symptom do you have?\n[1]\n[2]\n[3]').then(reaction => {
											reaction.react(emojis[1]).then(() => reaction.react(emojis[2])).then(() => reaction.react(emojis[3]));
										}).then(stuff => {
											const filter = (reaction, user) => {
												return [emojis[1], emojis[2], emojis[3]].includes(reaction.emoji.name) && user.id === msg.author.id;
											};
			
											msg.channel.messages.fetch({ limit: 1 }).then(message => {
												message.last().awaitReactions(filter, { max: 1, time: 60000, errors: ['time'] })
													.then(collected => {
														const reaction = collected.first();
				
														if (reaction.emoji.name === emojis[1]) {
															msg.author.send("Solution 1");
														} else if (reaction.emoji.name === emojis[2]) {
															msg.author.send("Solution 2");
														} else if (reaction.emoji.name === emojis[3]) {
															msg.author.send("Solution 3");
														}
													})
													.catch(collected => {
														msg.reply('You did not provide a reaction within 60 seconds, please try again.');
													});
											});
										});
									}
									
									// Option 6
									else if (reaction.emoji.name === emojis[3]) {
										msg.author.send('Which symptom do you have?\n[1]\n[2]\n[3]').then(reaction => {
											reaction.react(emojis[1]).then(() => reaction.react(emojis[2])).then(() => reaction.react(emojis[3]));
										}).then(stuff => {
											const filter = (reaction, user) => {
												return [emojis[1], emojis[2], emojis[3]].includes(reaction.emoji.name) && user.id === msg.author.id;
											};
			
											msg.channel.messages.fetch({ limit: 1 }).then(message => {
												message.last().awaitReactions(filter, { max: 1, time: 60000, errors: ['time'] })
													.then(collected => {
														const reaction = collected.first();
				
														if (reaction.emoji.name === emojis[1]) {
															msg.author.send("Solution 1");
														} else if (reaction.emoji.name === emojis[2]) {
															msg.author.send("Solution 2");
														} else if (reaction.emoji.name === emojis[3]) {
															msg.author.send("Solution 3");
														}
													})
													.catch(collected => {
														msg.reply('You did not provide a reaction within 60 seconds, please try again.');
													});
											});
										});
									}

									// Option 7
									else if (reaction.emoji.name === emojis[3]) {
										msg.author.send('Which symptom do you have?\n[1]\n[2]\n[3]').then(reaction => {
											reaction.react(emojis[1]).then(() => reaction.react(emojis[2])).then(() => reaction.react(emojis[3]));
										}).then(stuff => {
											const filter = (reaction, user) => {
												return [emojis[1], emojis[2], emojis[3]].includes(reaction.emoji.name) && user.id === msg.author.id;
											};
			
											msg.channel.messages.fetch({ limit: 1 }).then(message => {
												message.last().awaitReactions(filter, { max: 1, time: 60000, errors: ['time'] })
													.then(collected => {
														const reaction = collected.first();
				
														if (reaction.emoji.name === emojis[1]) {
															msg.author.send("Solution 1");
														} else if (reaction.emoji.name === emojis[2]) {
															msg.author.send("Solution 2");
														} else if (reaction.emoji.name === emojis[3]) {
															msg.author.send("Solution 3");
														}
													})
													.catch(collected => {
														msg.reply('You did not provide a reaction within 60 seconds, please try again.');
													});
											});
										});
									}
								})
								.catch(collected => {
									msg.reply('You did not provide a reaction within 60 seconds, please try again.');
								});
						});
				});



			}

			// Command to get some help with xpost
			else if (msg.content.startsWith(prefix + 'xpost-help')) {
				const message = 'The secret formula is: \n ~xpost <team-name> --- <kits> --- <download links> --- <picture links>\n\nNote that those are 3 dashes in between each piece.\nFor picture links, just post your picture beforehand, right click on it, then click "Copy Link"\n\nYou can also leave off the last <picture links> section and just upload a picture using the "+" button to the left side of the message bar';
				if (msg.channel.type == 'dm') {
					msg.author.send(message);
				} else {
					msg.channel.send(message);
				}
			}

			// Command for cross-posting from one channel to the other
			else if (msg.content.startsWith(prefix + 'xpost') && msg.channel.name == 'template-channel') {
				// I probably don't have to do it this way, but just to be sure
				let potential_array_of_pics = []
				msg.attachments.forEach(pic => {
					potential_array_of_pics.push(pic.url);
				})

				// Rip off the front portion that contains the command string
				let content = msg.content.slice(prefix.length + 'xpost'.length).split('--- ');

				let big_string = '';
				// Basically, if they didn't provide enough arguments, then they are probably uploading a picture, otherwise they have all the picture links
				if (content.length === 3) {
					big_string += `**RMFK**${content[0]} \n**Created by** ${msg.author}\n**Kits Included**: ${content[1]}\n**Download Link**: <${content[2]}>\n**Preview**:`;
				} else if (content.length === 4) {
					big_string += `**RMFK**${content[0]} \n**Created by** ${msg.author}\n**Kits Included**: ${content[1]}\n**Download Link**: <${content[2]}>\n**Previews**: ${content[3]}`;
				} else {
					return msg.reply("I'm sorry, but your format was incorrect. Please type ~xpost-help for the correct format and some tips! :)");
				}
				
				// Find the channel we want to cross-post to and store its channel object
				const channel = msg.guild.channels.cache.find(channel => channel.id === '690731272875802687');
				// Then send our re-formatted string and our images (if any) to that channel
				channel.send(big_string, {files: potential_array_of_pics});
			}

			// Help command that shows you all the commands you have available
			else if (msg.content.startsWith(prefix + 'commands')) {
				// This will only get sent to admins
				if (member.roles.cache.some(role => role.name === 'Support')) {
					const embed = new Discord.MessageEmbed()
						.setColor('#0099ff')
						.setTitle('List of all Commands')
						.addFields(
							{ name: '\u200B', value: '\u200B' },
							{ name: prefix + 'dmeveryone <message>', value: 'Sends a DM to literally everyone that is not opted out. Only @FIFER#7782 can use', inline: false },
							{ name: '\u200B', value: '\u200B' },
							{ name: prefix + 'optout', value: '(*This only works in a DM with the ModButler* },\nWill opt out the sender from receiving mass-DM messages', inline: false },
							{ name: '\u200B', value: '\u200B' },
							{ name: prefix + 'optin', value: '(*This only works in a DM with the ModButler* },\nWill opt in the sender to receive mass-DM messages', inline: false },
							{ name: '\u200B', value: '\u200B' },
							{ name: prefix + 'faq', value: '(*This only works in a DM with the ModButler* },\nTriggers the bot to respond with the FAQ directory sequence', inline: false },
							{ name: '\u200B', value: '\u200B' },
							{ name: prefix + 'xpost-help', value: '(*This only works in the template channel* },\nTells the bot to respond with the xpost command format', inline: false },
							{ name: '\u200B', value: '\u200B' },
							{ name: prefix + 'xpost', value: '(*This only works in the template channel* },\nAllows you to message the bot with mod info that it will then cross-post to the general channel', inline: false },
							{ name: '\u200B', value: '\u200B' },
							{ name: prefix + 'invite', value: 'Tells the bot to respond with the permanent server invite link', inline: false },
							{ name: '\u200B', value: '\u200B' },
							{ name: prefix + 'wintersquads', value: 'Tells the bot to respond with the info for the squads hot fix', inline: false },
							{ name: '\u200B', value: '\u200B' },
							{ name: prefix + 'cmchallenge', value: '(*This only works in a DM with the ModButler* },\nTells the bot to post a random career mode challenge', inline: false },
							{ name: '\u200B', value: '\u200B' }
						)
						.setTimestamp()
						.setFooter('Use responsibly!');
			
					if (msg.channel.type == 'dm') {
						msg.author.send(embed);
					} else {
						msg.channel.send(embed);
					}
				} 
				// This will get sent to everyone else
				else {
					const embed = new Discord.MessageEmbed()
						.setColor('#0099ff')
						.setTitle('List of Public Commands')
						.addFields(
							{ name: prefix + 'optout', value: '(*This only works in a DM with the ModButler*)\nWill opt out the sender from receiving mass-DM messages', inline: false },
							{ name: '\u200B', value: '\u200B', inline: false },
							{ name: prefix + 'optin', value: '(*This only works in a DM with the ModButler*)\nWill opt in the sender to receive mass-DM messages', inline: false },
							{ name: '\u200B', value: '\u200B', inline: false },
							{ name: prefix + 'faq', value: '(*This only works in a DM with the ModButler*)\nTriggers the bot to respond with the FAQ directory sequence', inline: false },
							{ name: '\u200B', value: '\u200B', inline: false },
							{ name: prefix + 'xpost-help', value: '(*This only works in the template channel*)\nTells the bot to respond with the xpost command format', inline: false },
							{ name: '\u200B', value: '\u200B', inline: false },
							{ name: prefix + 'xpost', value: '(*This only works in the template channel*)\nAllows you to message the bot with mod info that it will then cross-post to the general channel', inline: false },
							{ name: '\u200B', value: '\u200B', inline: false },
							{ name: prefix + 'invite', value: 'Tells the bot to respond with the permanent server invite link', inline: false },
							{ name: '\u200B', value: '\u200B', inline: false }
						)
						.setTimestamp()
						.setFooter('Enjoy the mod!');

					if (msg.channel.type == 'dm') {
						msg.author.send(embed);
					} else {
						msg.channel.send(embed);
					}
				}

			}

			// ##############################
			//     Auto respond commands
			// ##############################
			// Invite
			else if (msg.content.startsWith(prefix + 'invite')) {
				const message = 'Permanent invite link: https://discord.gg/DJxMEyk';
				if (msg.channel.type === 'dm') {
					msg.author.send(message);
				} else {
					msg.channel.send(message);
				}
			}
			// wintersquads
			else if (msg.content.startsWith(prefix + 'wintersquads')) {
				const message = 'Here is the Realism Mod 3.0 hotfix squad file with 700+ transfers and various fixes - <https://drive.google.com/drive/u/2/folders/11mpkST2LjA4x0UpBv_qJ8nAPHg9I8klD> - at /Squad File - 1.5/ folder';
				if (msg.channel.type === 'dm') {
					msg.author.send(message);
				} else {
					msg.channel.send(message);
				}
			}
			// fixcrash
			else if (msg.content.startsWith(prefix + 'fixcrash')) {
				const message = '**Is your game crashing using FIFERs Realism Mod?**\n\nThis could be for many reasons.\n\n**When creating a tournament?** Read above, or here: <https://rebrand.ly/tournamentreact>\n\n**When entering edit real player?** Reset squads (To do that go to the customize tab on the main menu, then Edit Teams, then click Reset Squads and if it asks you are you sure click yes.).\n\n**Anywhere else?** Do this: \n\n 1. Go into your FIFA 20 folder (normally located in C:\Program Files (x86)\Origin Games\FIFA 20) and deleted the folder called "Moddata" (this will reappear when you next launch FIFA, which is fine)\n 2. Go into Documents/FIFA 20\n 3. There should be a file called fifasetup. Open it with a text Editor\n 4. On line 4 (or around there), look for DIRECTX_SELECT = 0. Change it to DIRECTX_SELECT = 1\n 5. Save the file\n 6. Launch FIFA again.\n\nAlso, make sure you did not use edit transfers to transfer players to/from your team. If you did, load a backup save (provided you made one).\n\nIf you still need help, ask in #help (or <#745610752555089981> for patrons)';
				if (msg.channel.type === 'dm') {
					msg.author.send(message);
				} else {
					msg.channel.send(message);
				}
			}
			// cmchallenge (only works in DM now)
			else if (msg.content.startsWith(prefix + 'cmchallenge')) {
				const possible_responses = ['1',
											'2',
											'3',
											'4',
											'5',
											'6',
											'7',
											'8',
											'9',
											'10'
										]
				const message = (possible_responses[Math.floor(Math.random() * possible_responses.length)]);
				if (msg.channel.type === 'dm') {
					msg.author.send(message);
				} else {
					msg.channel.send(message);
				}
			}
			// ban (only if you are FIFER)
			else if (msg.content.startsWith(prefix + 'ban') && member.roles.cache.some(role => role.name === 'FIFER')) {
				// Grab whoever is mentioned in the command
				let member = msg.mentions.members.first();

				// Make sure they are a valid member
				if (!member) {
					return msg.reply("Please mention a valid member of this server");
				}
				// Make sure they are bannable
				if (!member.bannable) {
					return msg.reply("I cannot ban this user! Do they have a higher role? Do I have ban permissions?");
				}

				// Message that will be sent to the user
				let message_to_user = 'Default message with link';

				// Grab the message after the command string that will be saved in the audit log as well as the ban time amount
				let pieces_string = msg.content.slice(prefix.length + 'ban'.length);
				let pieces = pieces_string.split(' --- ');

				// If they do not have all of the pieces, just tell them to do it correctly
				if (pieces.length !== 3) {
					return msg.reply('Please send the command following this format:\n~ban <USER> <REASON> <DAYS TO BAN> <DAYS OF MESSAGES TO DELETE>');
				}

				let message_delete_days = parseInt(pieces[pieces.length - 1]);
				let ban_time = parseInt(pieces[pieces.length - 2]);
				let message_to_audit_log = pieces[pieces.length - 3];

				// Ban object
				const ban_object = { days: message_delete_days, reason: message_to_audit_log }

				// This will send the first question and react with however many emojis are programmed
				msg.channel.send(`**Are you sure?**\nThis will ban <@${member.user.id}> for ${ban_time} days and delete all of their last ${message_delete_days} days worth of messages.\n\n:one: BAN HAMMER!\n:two: Cancel`).then(reaction => {
					reaction.react(emojis[1])
						.then(() => reaction.react(emojis[2]));
				})
					// Once we have sent the message, we then create a filter so that the bot knows which emojis to look for
					.then(unused => {
						const filter = (reaction, user) => {
							return [emojis[1], emojis[2]].includes(reaction.emoji.name) && user.id === msg.author.id;
						};
						
						// From here, we grab the last message from the channel
						msg.channel.messages.fetch({ limit: 1 }).then(message => {
							// And THEN we officially wait for the reactions here. We will give them 60000 milliseconds (60 seconds) to respond
							message.last().awaitReactions(filter, { max: 1, time: 60000, errors: ['time'] })
								// Once they respond, trigger the option they selected to display the next part of the directory
								.then(collected => {
									const reaction = collected.first();
		
									// If yes, ban em
									if (reaction.emoji.name === emojis[1]) {
										// Send the person a message informing them that they have been banned. Then ban them
										member.send(message_to_user).then(function(){
											member.ban(ban_object);
										}).catch(function(){
											member.ban(ban_object);
										});

										// Craft this person's ban string
										let date = new Date();
										date.setDate(date.getDate() + ban_time);
										const ban_string = `${member.user.id} ${date.toLocaleString().split(',')[0]}\n`;

										// Here is why we are doing streams rather than appendFile or appendFileSync:
										// https://stackoverflow.com/questions/3459476/how-to-append-to-a-file-in-node/43370201#43370201

										// Write it to the file
										var stream = fs.createWriteStream('ban.txt', { flags: 'a' });
										stream.write(ban_string);
									}
								});
							});
						});
			}
			// mute (only if you are FIFER) TODO
			else if (msg.content.startsWith(prefix + 'mute') && member.roles.cache.some(role => role.name === 'FIFER')) {
				// Grab whoever is mentioned in the command
				let person = msg.mentions.members.first();

				// If they are already muted, let the muter know
				if (person.roles.cache.some(role => role.name === 'Muted')) {
					msg.channel.send(`<@${person.user.id}> is already muted.`);
				}
				// Else, mute them
				else {
					// Grab the actual role object
					var role = guild.roles.cache.find(role => role.name === "Muted");
					// Assign the role object to our person
					person.roles.add(role);
					msg.channel.send(`<@${person.user.id}> has been successfully muted!`);
				}
			}
			// unmute (only if you are FIFER)
			else if (msg.content.startsWith(prefix + 'unmute') && member.roles.cache.some(role => role.name === 'FIFER')) {
				// Grab whoever is mentioned in the command
				let person = msg.mentions.members.first();

				// If they are already muted, let the muter know
				if (!person.roles.cache.some(role => role.name === 'Muted')) {
					msg.channel.send(`<@${person.user.id}> is already unmuted.`);
				}
				// Else, mute them
				else {
					// Grab the actual role object
					var role = guild.roles.cache.find(role => role.name === "Muted");
					// Assign the role object to our person
					person.roles.remove(role);
					msg.channel.send(`<@${person.user.id}> has been successfully unmuted!`);
				}
			}
			// kick (only if you are FIFER)
			else if (msg.content.startsWith(prefix + 'kick') && member.roles.cache.some(role => role.name === 'FIFER')) {
				// Grab whoever is mentioned in the command
				let member = msg.mentions.members.first();
				// Make sure they are a valid member
				if (!member) {
					return msg.reply("Please mention a valid member of this server");
				}
				// Make sure they are kickable
				if (!member.kickable) {
					return msg.reply("I cannot kick this user! Do they have a higher role? Do I have kick permissions?");
				}

				// Message that will be sent to the user
				let message_to_user = 'Default message with link';
				// Grab the message after the command string that will be saved in the audit log
				let pieces = msg.content.slice(prefix.length + 'kick'.length).split(' ')
				let message_to_audit_log = pieces[pieces.length - 1];

				if (!message_to_audit_log) message_to_audit_log = "No reason provided";
				// console.log(message_to_audit_log);

				member.send(message_to_user).then(function(){
					member.kick(message_to_audit_log);
				}).catch(function(){
					member.kick(message_to_audit_log);
				});
			} 
			// face check
			else if (msg.content.startsWith(prefix + 'face') && member.roles.cache.some(role => role.name === 'FIFER')) {
				// Rip off the first part of the message containing the command
				let id = msg.content.slice(prefix.length + 'face '.length);

				let big_ass_message_string = '';
				let player_face_info = '';
				let player_name = '';
				let fifa_face_info = '';
				let nationality = '';
				let image_link = '';

				if (id === '' || !(id.length > 1 && id.length < 7)) {
					const message = 'ID must be 2 to 6 characters. Please try again';
					if (msg.channel.type == 'dm') {
						msg.author.send(message)
					} else {
						msg.channel.send(message);
					}
					return;
				}

				// Get everything from SOFIFA
				axios.get(`https://sofifa.com/player/${id}`).then((response) => {
					let $ = cheerio.load(response.data);

					$('li.bp3-text-overflow-ellipsis').each(function(index, element) {
						const label = $(element).find('label')[0]
						const span = $(element).find('span')[0]

						const label_boolean = label && $(label).text().toLowerCase().includes('real');
						if (label_boolean && span && $(span).text().toLowerCase() === 'yes') {
							fifa_face_info += 'already has a real face in normal FIFA, ';
							// This will stop it from looping thru all the other li tags
							return false;
						} else if (label_boolean && span && $(span).text().toLowerCase() === 'no') {
							fifa_face_info += 'does not have a real face in normal FIFA, ';
							// This will stop it from looping thru all the other li tags
							return false;
						}
					});
				}).then(() => {
					// Check our no real face list
					fs.readFile(no_real_faces_txt, 'utf8', function(err1, data1) {
						// Check our real face list
						fs.readFile(real_faces_txt, 'utf8', function(err2, data2) {
							let things = data2.split(/\r?\n/);
							let dict = {};
							things.forEach(thing => {
								const split = thing.split(' ');
								dict[split[0]] = split[1] == undefined ? '' : split[1];
							})
							if (err1) throw err1;
							if (err2) throw err2;

							let in_list = false;
							for (let key in dict) {
								in_list = id === key;
								if (in_list) {
									image_link += `${dict[key]}\n`;
									break;
								}
							}

							// Does not have a real face in FIFA
							if (fifa_face_info.includes('not')) {
								// In no_real_faces
								if (data1.includes(id)) {
									player_face_info += ' but the mod gives him one by adding a real face for him. \n';
								} else {
									player_face_info += " and he doesn't have a face in the mod either. \n";
								}
							}
							// Has a real face in FIFA already
							else if (!fifa_face_info.includes('not')) {
								// In real_faces
								if (in_list) {
									player_face_info += " and the mod improves it by adding a face update. \n";
								} else {
									player_face_info += " and the mod doesn't improve it. \n";
								}
							} else {
								player_face_info += '[Something went wrong. Please screenshot this and send it to FIFER] \n';
							}
						});
					});
				}).then(() => {
					// Get everything from SOFIFA
					axios.get(`https://sofifa.com/player/${id}`).then((response) => {
						let $ = cheerio.load(response.data);
	
						$('div.info').each(function(index, element) {
							const name = $(element).find('h1')[0]
							if (name) {
								player_name += `Player Name: ${$(name).text().split(')')[0]}) `;
								// This will stop it from looping thru all the other li tags
								return false;
							} else {
								player_name += '[Sorry, could not grab name] ';
								// This will stop it from looping thru all the other li tags
								return false;
							}
						});
	
						$('div.meta.bp3-text-overflow-ellipsis').each(function(index, element) {
							let img_src = $($($(element).find('a')[0]).find('img')).attr('data-src');
							img_src = img_src.substring(img_src.length - 6, img_src.length - 4);
	
							if (img_src) {
								nationality += `:flag_${img_src}: `;
								// This will stop it from looping thru all the other li tags
								return false;
							} else {
								nationality += '[Could not get nationality flag for this player] ';
								// This will stop it from looping thru all the other li tags
								return false;
							}
						});
	
						
	
						big_ass_message_string = player_name + nationality + fifa_face_info + player_face_info + image_link;
						if (msg.channel.type == 'dm') {
							msg.author.send(big_ass_message_string);
						} else {
							// Find the channel we want to post in
							const channel = guild.channels.cache.find(channel => channel.name === 'general');
							// Then send our string to that channel
							channel.send(big_ass_message_string);
						}
					}).catch(error => {
						const message = 'Something went wrong, please try again';
						if (msg.channel.type == 'dm') {
							msg.author.send(message);
						} else {
							// Find the channel we want to post in
							const channel = guild.channels.cache.find(channel => channel.name === 'general');
							// Then send our string to that channel
							channel.send(message);
						}
						console.log(error)
					});
				});


			}
			// lmgtfy
			else if (msg.content.startsWith(prefix + 'google')) {
				// const pieces = ;
				const message = `https://www.google.com/search?q=${msg.content.slice(prefix.length + 'google '.length).split(' ').join('+')}`;
				if (msg.channel.type === 'dm') {
					msg.author.send(message)
				} else {
					msg.channel.send(message);
				}
				
			}
			// player check
			else if (msg.content.startsWith(prefix + 'player') && member.roles.cache.some(role => role.name === 'FIFER')) {
				// Rip off the first part of the message containing the command
				let id = msg.content.slice(prefix.length + 'player '.length);

				// If they don't have the right length of ID, or don't send one at all, tell them to try again
				if (id === '' || !(id.length > 1 && id.length < 7)) {
					const message = 'ID must be 2 to 6 characters. Please try again';
					if (msg.channel.type == 'dm') {
						msg.author.send(message)
					} else {
						msg.channel.send(message);
					}
					return;
				}

				// Variables we will need for our embed
				let big_ass_message_string = '';
				let big_ass_message_string2 = '';
				let big_ass_message_string_pieces = '';
				let big_ass_message_string_pieces2 = '';
				let miniface = '';
				let player_characteristics = [];
				let traits = [];
				let teams = [];
				let embed_page_1 = new Discord.MessageEmbed();
				let embed_page_2 = new Discord.MessageEmbed();
				let embed_page_3 = new Discord.MessageEmbed();

				// Now let's get everything from the site
				axios.get(`https://sofifa.com/player/${id}`)
				// Grab all of our info first
				.then((response) => {
					let $ = cheerio.load(response.data);

					// Mini-face image
					$('div.bp3-card.player').each(function(index, element) {
						miniface = $($(element).find('img')[0]).attr('data-src');
					});

					// Player name
					$('div.info').each(function(index, element) {
						const name = $(element).find('h1')[0]
						if (name) {
							big_ass_message_string += `Name: ${$(name).text().split(')')[0].replace('ID: ', '')})\n`;
							// big_ass_message_string += `Player Name: ${$(name).text().split(')')[0]})\n`;
							// This will stop it from looping thru all the other li tags
							return false;
						} else {
							big_ass_message_string += '[Sorry, could not grab name]\n';
							// This will stop it from looping thru all the other li tags
							return false;
						}
					});

					// Position, Age, DOB, Height, Weight
					$('div.meta.bp3-text-overflow-ellipsis').each(function(index, element) {
						const meta = $(element).text();
						const meta_pieces = meta.split(' ');
						const weight = meta_pieces[meta_pieces.length - 1];
						const height = meta_pieces[meta_pieces.length - 2];
						const birthday = meta.split('(')[1].split(')')[0];
						const other_pieces = meta.split('y.o.')[0].split(' ');
						let age = other_pieces.pop();
						let position_array = other_pieces.slice(1);
						// Turn "CD,CDM" into "CD, CDM" for example
						if (position_array.length > 1) {
							position_array = position_array.join(', ');
						}
						
						if (position_array.length >= 1 && age && birthday && height && weight) {
							// const position_string = 'Position' + (position_array.length > 1 ? 's' : '') + `: ${position_array}`;
							big_ass_message_string += `Position: ${position_array}\nAge: ${age}\nD.O.B.: ${birthday}\nHeight: ${height}\nWeight: ${weight}\n`;
							// big_ass_message_string += `${position_string}\nAge: ${age}\nD.O.B.: ${birthday}\nHeight: ${height}\nWeight: ${weight}\n`;
							// This will stop it from looping thru all the other li tags
							return false;
						} else {
							big_ass_message_string += '[Sorry, could not grab name]\n';
							// This will stop it from looping thru all the other li tags
							return false;
						}
					});

					// Nationality emoji
					$('div.meta.bp3-text-overflow-ellipsis').each(function(index, element) {
						let img_src = $($($(element).find('a')[0]).find('img')).attr('data-src');
						img_src = img_src.substring(img_src.length - 6, img_src.length - 4);

						if (img_src) {
							big_ass_message_string += `Nationality: :flag_${img_src}:\n`;
							// big_ass_message_string += `Nationality is: :flag_${img_src}:\n`;
							// This will stop it from looping thru all the other li tags
							return false;
						} else {
							big_ass_message_string += '[Could not get nationality flag for this player]\n';
							// This will stop it from looping thru all the other li tags
							return false;
						}
					});

					// Overall Rating
					$('div.column.col-3').each(function(index, element) {
						const rating = $(element).find('div');
						const target_index = 0;
						if (rating && index == target_index) {
							big_ass_message_string += emojifyNumbers('Overall Rating', rating.text().split('Overall Rating')[0].split()[0]);
							// This will stop it from looping thru all the other li tags
							return false;
						} else if (!rating && index == target_index){
							big_ass_message_string += "[Sorry, could not grab player's rating]\n";
							// This will stop it from looping thru all the other li tags
							return false;
						}
					});

					// Potential
					$('div.column.col-3').each(function(index, element) {
						const potential = $(element).find('div');
						const target_index = 1;
						if (potential && index == target_index) {
							big_ass_message_string += emojifyNumbers('Potential', potential.text().split('Potential')[0].split()[0]);
							// This will stop it from looping thru all the other li tags
							return false;
						} else if (!potential && index == target_index){
							big_ass_message_string += "[Sorry, could not grab player's potential]\n";
							// This will stop it from looping thru all the other li tags
							return false;
						}
					});
					
					// Value
					$('div.column.col-3').each(function(index, element) {
						const value = $(element).find('div');
						const target_index = 2;
						if (value && index == target_index) {
							big_ass_message_string += `Value: ${value.text().split('Value')[0]}\n`;
							// big_ass_message_string += `Value: ${value.text().split('Value')[0]}\n`;
							// This will stop it from looping thru all the other li tags
							return false;
						} else if (!value && index == target_index){
							big_ass_message_string += "[Sorry, could not grab player's value]\n";
							// This will stop it from looping thru all the other li tags
							return false;
						}
					});

					// Wage
					$('div.column.col-3').each(function(index, element) {
						const wage = $(element).find('div');
						const target_index = 3;
						if (wage && index == target_index) {
							big_ass_message_string += `Wage: ${wage.text().split('Wage')[0]}\n`;
							// big_ass_message_string += `Wage: ${wage.text().split('Wage')[0]}\n`;
							// const test = client.emojis.find(emoji => emoji.name === "test_8");
							// big_ass_message_string += `${test} ${test}\n`;
							// This will stop it from looping thru all the other li tags
							return false;
						} else if (!wage && index == target_index){
							big_ass_message_string += "[Sorry, could not grab player's wage]\n";
							// This will stop it from looping thru all the other li tags
							return false;
						}
					});

					// Preferred Foot, Weak Foot, Skill Moves, International Reputation, Work Rate, Body Type, Real Face,
					// 		Release Clause, Best Position, Best Overall Rating, and Player Specialities
					$('li.bp3-text-overflow-ellipsis').each(function(index, element) {
						const other = $(element).text();
						const label = $(element).find('label').text();
						const value = $(element).text().split(label)[1];
						if (other.includes('#')) {
							player_characteristics.push(other.substring(0, other.length));
						} else if (label.includes('Weak') || label.includes('Skill') || label.includes('International')) {
							big_ass_message_string += `${label}: ${other.split(' ')[0]}\n`
						} else {
							// I don't like this fix, but in order to get the space out of it, there's no better way to do this and still maintain
							//		the loop-and-scrape structure I have here
							if (label.includes('Work')) {
								big_ass_message_string += `${label}: ${value.split(' ').join('')}\n`
							} else if (label.includes('Best Overall')) {
								big_ass_message_string += emojifyNumbers('Best Overall Value', value);
								// big_ass_message_string += `Best Overall Rating: ${rating_piece_0} ${rating_piece_1}\n`;
							} else {
								big_ass_message_string += `${label}: ${value}\n`
							}
						}
					});

					// Ratings thru "Defending"
					$('li').each(function(index, element) {
						const rating = $(element).find('span.bp3-tag').text();
						const stat = $(element).find('span.tooltip.multiline').text();
						if (stat && rating && stat !== '' && rating !== '') {
							big_ass_message_string2 += emojifyNumbers(stat, rating);
						}
					});

					// Goalkeeping (this one is formatted slightly different and requires an altered selector)
					$('div.bp3-card.double-spacing').each(function(index, element) {
						// Grab the header so we can check what section we are in
						const header = $(element).find('h5').text();
						// If we are in the "Goalkeeping" section (a lot of things have the div.bp3-card.doub... selector)
						if (header.includes('Goalk')) {
							// Grab the ul so we can go thru it and "loop" thru the ul's lis and lets grab their data
							$(element).find('ul').each((index, li) => {
								// Scrape and format all the ratings
								const ratings = [];
								// It's really weird, I know, but somehow this loops thru each individual li and grabs the value from each one (the right way)
								$(li).find('span.bp3-tag.p').each((index, thing) => {
									ratings.push(thing.children[0].data);
								});
								// Grab the raw labels and roughly put them in a list
								let raw_labels = $(li).text().split(/\d/);
								let labels = [];
								// Loop thru the raw labels and clean them up
								raw_labels.forEach(label => {
									// Sometimes there is a random \n all by itself in the list, so let's split on a newline and only take the ones with actual data
									const trim = label.split('\n')[0];
									if (trim !== '') {
										// All of these are prepended with an empty space and followed by a newline, so let's strip all that off
										labels.push(trim.split('\n')[0].substr(1, trim.length - 1));
									}
								});
								// Loop thru the labels and zip the labels and ratings together into the big_ass_message_string_2
								labels.forEach((element, index) => {
									big_ass_message_string2 += emojifyNumbers(element, ratings[index]);
								});
							})
						}
					});

					// Traits. These don't show up for everyone and they have a slightly different format
					$('div.bp3-card.double-spacing').each(function(index, element) {
						// Grab the header so we can check what section we are in
						const header = $(element).find('h5').text();
						// If we are in the "Traits" section (a lot of things have the div.bp3-card.doub... selector. But also, these traits don't show up for everyone)
						if (header.includes('Trait')) {
							// Loop thru the ul's lis and put them all into the traits list
							$(element).find('ul.pl').children().toArray().map(function(li) {
								traits.push($(li).text());
							});
						}
					});

					// Teams
					$('div.player-card.double-spacing').each(function(index, element) {
						const team_name = `Team: ${$($(element).find('h5')).find('a').text()}\n`;
						let team_info = [];
						$(element).find('ul.bp3-text-overflow-ellipsis.pl.text-right').children().toArray().map(function(li) {
							const li_text = $(li).text();
							if (li_text) {
								team_info.push(li_text);
							}
						});

						let team_info_string = '';
						team_info.forEach((element, index) => {
							switch (true) {
								case element.includes('Position'):
									team_info_string += `Position: ${element.split('Position')[1]}\n`;
									break;
								case element.includes('Jersey'):
									team_info_string += `Jersey Number: ${element.split('Jersey Number')[1]}\n`;
									break;
								case element.includes('Join'):
									team_info_string += `Joined: ${element.split('Joined')[1]}\n`;
									break;
								case element.includes('Contract'):
									team_info_string += `Contract Valid Until: ${element.split('Contract Valid Until')[1]}\n`;
									break;
								default:
									let rating_pieces = element.split(' ');
									team_info_string += `Rating: ${emojifyNumbers('.', rating_pieces[0], 'single')} ${rating_pieces[1]}\n`;
									break;
							}
						})

						teams.push(`${team_name}\n${team_info_string}`);
					});
				})
				// Because the bot seems to somehow grab slightly different data than the website in regards to what srcs are in the img tag,
				//		the only sure-fire way to know if the player has a picture is to check the link and wait for a 404. If I get anything other
				//		than a good code, set the miniface url to the default "player doesn't have a face" image.
				// Also, since the fetch command happens asynchronously, I have to send the embed AFTER the fetch is done. 
				.then(() => {
					// Fetch our link and grab the response
					fetch(miniface)
					// Check the response code to see if it is okay
					.then(res => {
						// If it's not, set the miniface to the "player doesn't have a face" image
						if (!res.ok) {
							miniface = 'https://cdn.sofifa.com/players/notfound_0_120.png';
						}
					})
					// Create our embeds and send them now that we have the correct miniface
					.then(() => {
						// Create the embed for page 1
						big_ass_message_string_pieces = big_ass_message_string.split('\n');
						embed_page_1 = new Discord.MessageEmbed()
							.setColor('#0099ff')
							.setAuthor(`${big_ass_message_string_pieces[0].split(': ')[1]}`, miniface)
							.setThumbnail(miniface)
							.addFields(
								{ name: big_ass_message_string_pieces[1].split(': ')[0], value: big_ass_message_string_pieces[1].split(': ')[1], inline: true },
								{ name: big_ass_message_string_pieces[3].split(': ')[0], value: big_ass_message_string_pieces[3].split(': ')[1], inline: true },
								{ name: big_ass_message_string_pieces[2].split(': ')[0], value: big_ass_message_string_pieces[2].split(': ')[1], inline: true },
								{ name: big_ass_message_string_pieces[4].split(': ')[0], value: big_ass_message_string_pieces[4].split(': ')[1], inline: true },
								{ name: big_ass_message_string_pieces[5].split(': ')[0], value: big_ass_message_string_pieces[5].split(': ')[1], inline: true },
								{ name: big_ass_message_string_pieces[6].split(': ')[0], value: big_ass_message_string_pieces[6].split(': ')[1], inline: true },
								{ name: big_ass_message_string_pieces[7].split(': ')[0], value: big_ass_message_string_pieces[7].split(': ')[1], inline: true },
								{ name: big_ass_message_string_pieces[8].split(': ')[0], value: big_ass_message_string_pieces[8].split(': ')[1], inline: true },
								{ name: big_ass_message_string_pieces[9].split(': ')[0], value: big_ass_message_string_pieces[9].split(': ')[1], inline: true },
								{ name: big_ass_message_string_pieces[10].split(': ')[0], value: big_ass_message_string_pieces[10].split(': ')[1], inline: true },
								{ name: big_ass_message_string_pieces[11].split(': ')[0], value: big_ass_message_string_pieces[11].split(': ')[1], inline: true },
								{ name: big_ass_message_string_pieces[12].split(': ')[0], value: big_ass_message_string_pieces[12].split(': ')[1], inline: true },
								{ name: big_ass_message_string_pieces[13].split(': ')[0], value: big_ass_message_string_pieces[13].split(': ')[1], inline: true },
								{ name: big_ass_message_string_pieces[14].split(': ')[0], value: big_ass_message_string_pieces[14].split(': ')[1], inline: true },
								{ name: big_ass_message_string_pieces[15].split(': ')[0], value: big_ass_message_string_pieces[15].split(': ')[1], inline: true },
								{ name: big_ass_message_string_pieces[16].split(': ')[0], value: big_ass_message_string_pieces[16].split(': ')[1], inline: true },
								{ name: big_ass_message_string_pieces[17].split(': ')[0], value: big_ass_message_string_pieces[17].split(': ')[1], inline: true },
								{ name: big_ass_message_string_pieces[18].split(': ')[0], value: big_ass_message_string_pieces[18].split(': ')[1], inline: true },
								{ name: big_ass_message_string_pieces[19].split(': ')[0], value: big_ass_message_string_pieces[19].split(': ')[1], inline: true },
								{ name: big_ass_message_string_pieces[20].split(': ')[0], value: big_ass_message_string_pieces[20].split(': ')[1], inline: true },
								{ name: 'Player Characteristics', value: player_characteristics.length >= 1 ? player_characteristics.join('\n') : 'None', inline: true}
							)
							.setTimestamp()


						// Create the embed for page 2
						big_ass_message_string_pieces2 = big_ass_message_string2.split('\n');
						embed_page_2 = new Discord.MessageEmbed()
							.setColor('#0099ff')
							.setAuthor(`${big_ass_message_string_pieces[0].split(': ')[1]}`, miniface)
							.setThumbnail(miniface)
							.addFields(
								{ name: big_ass_message_string_pieces2[0].split(': ')[0], value: big_ass_message_string_pieces2[0].split(': ')[1], inline: true },
								{ name: big_ass_message_string_pieces2[1].split(': ')[0], value: big_ass_message_string_pieces2[1].split(': ')[1], inline: true },
								{ name: big_ass_message_string_pieces2[2].split(': ')[0], value: big_ass_message_string_pieces2[2].split(': ')[1], inline: true },
								{ name: big_ass_message_string_pieces2[3].split(': ')[0], value: big_ass_message_string_pieces2[3].split(': ')[1], inline: true },
								{ name: big_ass_message_string_pieces2[4].split(': ')[0], value: big_ass_message_string_pieces2[4].split(': ')[1], inline: true },
								{ name: big_ass_message_string_pieces2[5].split(': ')[0], value: big_ass_message_string_pieces2[5].split(': ')[1], inline: true },
								{ name: big_ass_message_string_pieces2[6].split(': ')[0], value: big_ass_message_string_pieces2[6].split(': ')[1], inline: true },
								{ name: big_ass_message_string_pieces2[7].split(': ')[0], value: big_ass_message_string_pieces2[7].split(': ')[1], inline: true },
								{ name: big_ass_message_string_pieces2[8].split(': ')[0], value: big_ass_message_string_pieces2[8].split(': ')[1], inline: true },
								{ name: big_ass_message_string_pieces2[9].split(': ')[0], value: big_ass_message_string_pieces2[9].split(': ')[1], inline: true },
								{ name: big_ass_message_string_pieces2[10].split(': ')[0], value: big_ass_message_string_pieces2[10].split(': ')[1], inline: true },
								{ name: big_ass_message_string_pieces2[11].split(': ')[0], value: big_ass_message_string_pieces2[11].split(': ')[1], inline: true },
								{ name: big_ass_message_string_pieces2[12].split(': ')[0], value: big_ass_message_string_pieces2[12].split(': ')[1], inline: true },
								{ name: big_ass_message_string_pieces2[13].split(': ')[0], value: big_ass_message_string_pieces2[13].split(': ')[1], inline: true },
								{ name: big_ass_message_string_pieces2[14].split(': ')[0], value: big_ass_message_string_pieces2[14].split(': ')[1], inline: true },
								{ name: big_ass_message_string_pieces2[15].split(': ')[0], value: big_ass_message_string_pieces2[15].split(': ')[1], inline: true },
								{ name: big_ass_message_string_pieces2[16].split(': ')[0], value: big_ass_message_string_pieces2[16].split(': ')[1], inline: true },
								{ name: big_ass_message_string_pieces2[17].split(': ')[0], value: big_ass_message_string_pieces2[17].split(': ')[1], inline: true },
								{ name: big_ass_message_string_pieces2[18].split(': ')[0], value: big_ass_message_string_pieces2[18].split(': ')[1], inline: true },
								{ name: big_ass_message_string_pieces2[19].split(': ')[0], value: big_ass_message_string_pieces2[19].split(': ')[1], inline: true }
							)

						// Create the embed for page 3
						embed_page_3 = new Discord.MessageEmbed()
							.setColor('#0099ff')
							.setAuthor(`${big_ass_message_string_pieces[0].split(': ')[1]}`, miniface)
							.setThumbnail(miniface)
							.addFields(
								{ name: big_ass_message_string_pieces2[20].split(': ')[0], value: big_ass_message_string_pieces2[20].split(': ')[1], inline: true },
								{ name: big_ass_message_string_pieces2[21].split(': ')[0], value: big_ass_message_string_pieces2[21].split(': ')[1], inline: true },
								{ name: big_ass_message_string_pieces2[22].split(': ')[0], value: big_ass_message_string_pieces2[22].split(': ')[1], inline: true },
								{ name: big_ass_message_string_pieces2[23].split(': ')[0], value: big_ass_message_string_pieces2[23].split(': ')[1], inline: true },
								{ name: big_ass_message_string_pieces2[24].split(': ')[0], value: big_ass_message_string_pieces2[24].split(': ')[1], inline: true },
								{ name: big_ass_message_string_pieces2[25].split(': ')[0], value: big_ass_message_string_pieces2[25].split(': ')[1], inline: true },
								{ name: big_ass_message_string_pieces2[26].split(': ')[0], value: big_ass_message_string_pieces2[26].split(': ')[1], inline: true },
								{ name: big_ass_message_string_pieces2[27].split(': ')[0], value: big_ass_message_string_pieces2[27].split(': ')[1], inline: true },
								{ name: big_ass_message_string_pieces2[28].split(': ')[0], value: big_ass_message_string_pieces2[28].split(': ')[1], inline: true },
								{ name: big_ass_message_string_pieces2[29].split(': ')[0], value: big_ass_message_string_pieces2[29].split(': ')[1], inline: true },
								{ name: big_ass_message_string_pieces2[30].split(': ')[0], value: big_ass_message_string_pieces2[30].split(': ')[1], inline: true },
								{ name: big_ass_message_string_pieces2[31].split(': ')[0], value: big_ass_message_string_pieces2[31].split(': ')[1], inline: true },
								{ name: big_ass_message_string_pieces2[32].split(': ')[0], value: big_ass_message_string_pieces2[32].split(': ')[1], inline: true },
								{ name: 'Traits', value: traits.length >= 1 ? traits.join('\n') : 'None', inline: true}
							)
							.setTimestamp()


						// Create the embed for page 4
						embed_page_4 = new Discord.MessageEmbed()
							.setColor('#0099ff')
							.setAuthor(`${big_ass_message_string_pieces[0].split(': ')[1]}`, miniface)
							.setThumbnail(miniface)
							.addFields(
								{ name: `Team${teams.length === 1 ? '' : 's'} Info`, value: teams, inline: true }
							)
							.setTimestamp()

						const embeds = [embed_page_1, embed_page_4, embed_page_2, embed_page_3];

						if (msg.channel.type == 'dm') {
							tabbedEmbed(msg, embeds, 'dm');
						} else {
							tabbedEmbed(msg, embeds);
						}
					})
				})
				.catch(error => {
					const message = 'Something went wrong, please try again';
					if (msg.channel.type == 'dm') {
						msg.author.send(message);
					} else {
						// Find the channel we want to post in
						const channel = guild.channels.cache.find(channel => channel.name === 'general');
						// Then send our string to that channel
						channel.send(message);
					}
					console.log('here?');
					console.log(error)
				});

			}
			// team check
			else if (msg.content.startsWith(prefix + 'team') && member.roles.cache.some(role => role.name === 'FIFER')) {
				// Rip off the first part of the message containing the command
				let id = msg.content.slice(prefix.length + 'team '.length);

				let big_ass_message_string = '';

				if (id === '' || !(id.length > 1 && id.length < 7)) {
					const message = 'ID must be 2 to 6 characters. Please try again';
					if (msg.channel.type == 'dm') {
						msg.author.send(message)
					} else {
						msg.channel.send(message);
					}
					return;
				}

				axios.get(`https://sofifa.com/team/${id}`).then((response) => {
					let $ = cheerio.load(response.data);

					$('div.info').each(function(index, element) {
						const name = $(element).find('h1')[0]
						if (name) {
							player_name += `Player Name: ${$(name).text().split(')')[0]})\n`;
							// This will stop it from looping thru all the other li tags
							return false;
						} else {
							player_name += '[Sorry, could not grab name]\n';
							// This will stop it from looping thru all the other li tags
							return false;
						}
					});

					$('li.bp3-text-overflow-ellipsis').each(function(index, element) {
						const label = $(element).find('label')[0]
						const span = $(element).find('span')[0]

						const label_boolean = label && $(label).text().toLowerCase().includes('real');
						if (label_boolean && span && $(span).text().toLowerCase() === 'yes') {
							fifa_face_info += 'That player already has a real face in FIFA. ';
							// This will stop it from looping thru all the other li tags
							return false;
						} else if (label_boolean && span && $(span).text().toLowerCase() === 'no') {
							fifa_face_info += 'That player does not have a real face in FIFA. ';
							// This will stop it from looping thru all the other li tags
							return false;
						}
					});

					$('div.meta.bp3-text-overflow-ellipsis').each(function(index, element) {
						let img_src = $($($(element).find('a')[0]).find('img')).attr('data-src');
						img_src = img_src.substring(img_src.length - 6, img_src.length - 4);

						if (img_src) {
							nationality += `Nationality is: :flag_${img_src}: `;
							// This will stop it from looping thru all the other li tags
							return false;
						} else {
							nationality += '[Could not get nationality flag for this player]\n';
							// This will stop it from looping thru all the other li tags
							return false;
						}
					});

					big_ass_message_string = player_name + nationality + fifa_face_info + player_face_info + image_link;
					if (msg.channel.type == 'dm') {
						msg.author.send(big_ass_message_string);
					} else {
						// Find the channel we want to post in
						const channel = guild.channels.cache.find(channel => channel.name === 'general');
						// Then send our string to that channel
						channel.send(big_ass_message_string);
					}
				}).catch(error => {
					const message = 'Something went wrong, please try again';
					if (msg.channel.type == 'dm') {
						msg.author.send(message);
					} else {
						// Find the channel we want to post in
						const channel = guild.channels.cache.find(channel => channel.name === 'general');
						// Then send our string to that channel
						channel.send(message);
					}
					console.log(error)
				});

			}
			// witchhunter commands
			else if (msg.content.startsWith(prefix + 'witchhunter') && member.roles.cache.some(role => role.name === 'FIFER')) {
				if (msg.content.slice(prefix.length + 'witchhunter '.length) === 'start') {
					witchhunter.start();
				} else {
					witchhunter.stop();
				}
			}
			// gatekeeper commands
			else if (msg.content.startsWith(prefix + 'gatekeeper') && member.roles.cache.some(role => role.name === 'FIFER')) {
				if (msg.content.slice(prefix.length + 'gatekeeper '.length) === 'start') {
					gatekeeper.start();
				} else {
					gatekeeper.stop();
				}
			}
			// witchhunt
			else if (msg.content.startsWith(prefix + 'witchhunt')) {
				// Get the Guild and store it under the variable "guild"
				const guild = client.guilds.cache.get(server_id);

				var people = []

				fs.readFile(unaccepted_words_txt, 'utf8', function(err, data) {
					// Iterate through the collection of GuildMembers from the Guild and DM each one with our message
					guild.members.cache.forEach(member => {
					// Make sure we don't try to DM bots (as it will explode) and make sure we only DM those that are opted in
						if (!member.user.bot) {
							if (err) throw err;
				
							data = data.split(/\r?\n/);
				
							dict = {};
							data.forEach(word => {
								// If message contains an unaccepted word and you are not an Admin, delete the message
								if ((member.displayName.toLowerCase().includes(word) || member.user.username.toLowerCase().includes(word)) && !member.roles.cache.some(role => role.name === 'Admin')) {
									// console.log(`${member.displayName} is actually ${member.user.username}, and has an unaccepted word in their name`);
									people.push(member.displayName);
								}
							});

							if (people.length > 0) {
								msg.author.send('Here are the guilty:');
								msg.author.send(people.pop());
							} else {
								msg.author.send('There are no guilty');
							}
						}
					});
				});
			}
			// watch
			else if (msg.content.startsWith(prefix + 'watch') && member.roles.cache.some(role => role.name === 'FIFER')) {
				// Grab whoever is mentioned in the command
				let member = msg.mentions.members.first();

				// Grab the content without the command string
				let pieces_string = msg.content.slice(prefix.length + 'watch '.length);
				let reason = pieces_string.split(' --- ')[1];


				let villain = '';
				// Check to see if they mentioned someone. If they didn't, then they used an ID
				if (!member) {
					villain = pieces_string.split(' --- ')[0].split(' ')[0];
				} else {
					villain = member.user.id;
				}

				// If they are already in the list, then we don't need to add it twice
				fs.readFile(villains_txt, 'utf8', function(err, data) {
					if (err) throw err;
					if (data.includes(villain)) {
						explode = true;
						return msg.reply('That person is already in the villains list');
					}

					// Figure out whether we need to warn or ban
					let action = pieces_string.split(' --- ')[0].split(' ')[1];
					// If they put nothing, default to warn
					if (!action) {
						action = 'warn';
					}
	
					const ban_string = `${villain} ${action} --- ${reason}\n`;
	
					// Write it to the file
					var stream = fs.createWriteStream('villains.txt', { flags: 'a' });
					stream.write(ban_string);
				});

			}
		}
	});
});

// Notes:
// If you want to DM the user who sent the message, you can use <message>.author.send().
// Reactions: https://discordjs.guide/popular-topics/reactions.html#removing-reactions-by-user
// Awaiting reactions: https://discordjs.guide/popular-topics/collectors.html
// msg.reply('pong');  // Directly replies to person that sent the message by @-ing them
// msg.channel.send('pong'); // Just sends reply into channel
// More input: https://discordjs.guide/popular-topics/common-questions.html#how-do-i-prompt-the-user-for-additional-input
// Command organizer: https://www.sitepoint.com/discord-bot-node-js/
// Unban: https://stackoverflow.com/questions/62538065/how-do-i-unban-user-with-commands
// Ban/kick message: https://stackoverflow.com/questions/51002706/ban-dm-message-on-discord-js

// Setup:
// Determine if dmeveryone role is "Admin" or not
// Add role on server called OPTOUT_MASS_DM
// Give that role to the bot
// Make sure the bot is close to the top on the role hierarchy along with OPTOUT_MASS_DM
// Get server id and add it to the top
// npm i node-fetch --save TODO: need for checking url with miniface in player command
// npm install cheerio
// npm install axios
// npm install cron


// TODO:
// research if we can see events for when channel permissions are changed (channel update)
// research anti raid/spam
// reorganize embed to have more columns
// short url expander to block short url links to sites in unaccepted text
// go back and document everything we missed
// So user says "~team 241", it goes to https://sofifa.com/team/241 and outputs name, logo, League, 
//		Country (as flag emoji), stats, etc.
// Maybe a search for these things, so an ID wouldn't have to be provided? It would "reverse engineer" 
//		the sofifa search commands, so you could go "~search-player Messi" and then the bot would output the basic
//		info of the players here: https://sofifa.com/players?keyword=messi with emojis to choose the right one.


// Send Messages
// Manage Messages
// Embed Links
// Attach Files
// Read Message History
// Manage Server
// Manage Roles
// Kick Members
// Ban Members
// Create Instant Invite