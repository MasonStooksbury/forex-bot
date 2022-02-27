# SETUP
### These instructions will help you setup everything that's necessary for your bot to function in the Discord Developer Portal as well as purchase/configure a webserver using cubehostingmc.com to host your bot for $0.50/month

# How to read this document
### This document is in a format called Markdown and if you try to read it in a normal editor, it's going to look hideous. 
1. If you have VSCode installed, you can open this document in there, then hit Ctrl + Shift + V to open it in a Markdown reader. 
2. Otherwise, you'll want to use an online Markdown reader like this: https://dillinger.io/



# Creating the bot using Discord's Developer Portal
### These instructions will help you create the necessary application and bot using Discord's Developer Portal. This makes it so that Discord can register your bot and assign it a token so that you can use it
1. Navigate to this site: https://discord.com/developers/docs/intro
2. Create an Application
   1. On the left-hand side near the top, click on `Applications`
   2. On the `Applications` screen, click the blue `New Application` button on the right-hand side at the top
   3. In the `Name` box, put the name of your Application (NOTE: This is not the name of your bot, so you can name this whatever you want. But it does need to be fairly unique. So don't put "test" as this will have problems later. Typically I make this match the name of the bot I'm creating just so I can keep things organized and have a better chance of it being unique)
   4. Click Create
   5. On this new page, you can configure all of the information you like, but we only care about creating a bot next, so let's do that
3. Create a Bot
   1. On the left-hand side, click the `Bot` tab
   2. On the right-hand side of the new screen, click the blue `Add Bot` button
   3. Click `Yes, do it!`
   4. If you get an error that says `Too many users have this username, please try another`, then you need to rename the application to something else and try again.
   5. If it worked, you should now be on the Bot screen where you can edit the username, configure privileges and settings, and get the token
4. Configure the Bot
   1. Next we need to make sure the bot has all of the appropriate settings before we can call it "Done"
   2. On the `Bot` tab, scroll down to `Privileged Gateway Intents`
   3. You will see 3 subsections here with sliders at the end, activate all 3 of these
   4. Click the green `Save Changes` button that will appear at the bottom of the screen
5. Set permissions and get Bot invite link
   1. This step will set all the permissions for the bot and provide you a customized invite link. This is how you can change the permissions of the bot for use in other servers. Permissions and roles can be customized afterward, but this is useful for setting a baseline if you intend to distribute this
   2. On the left-hand side click the `OAuth2` tab
   3. Under OAuth2, click the `URL Generator` sub-tab
   4. Under the `SCOPES` section, look in the middle column and check `bot`
   5. Under the new `BOT PERMISSIONS` section, click all of the permissions you think the bot will need
   6. Once finished, copy the link in the `GENERATED URL` section at the very bottom of the page and paste this link in your browser to invite your bot!



# Creating a webserver to host your new Discord Bot
### These instructions will guide you through creating an account on the CubeHosting site as well as configuring the webserver to host your new bot
1. Navigate to this site and begin filling out the form (https://cubehostingmc.com/blesta/order/config/index/nodejsdiscord/?group_id=9&pricing_id=33)
2. Purchase webserver and setup account
   1. For `Term and Price`, select which plan you would like (1 Month or 1 Year)
   2. For `Server Name`, put the name you would like the server to be called within CubeHosting. This doesn't affect the bot name at all so name it whatever seems appropriate
   3. For `Server Description`, put a helpful description of what the webserver is for. This is helpful if you have multiple bots hosted on CubeHosting.
   4. For `Install Repo`, put the GitHub link provided by me
   5. For `Install Branch`, put `main`
   6. Leave `User Uploaded Files` as it is
   7. For `Auto Update`, put `1`
   8.  Leave `Bot js file` as it is
   9.  For `Additional Node Packages`, use the list I sent you and be sure to put only spaces in between each package
   10. Click the green `Continue` button at the bottom
   11. On the next screen, click the green `Checkout` button at the bottom
   12. At the top, if you don't already have an account, make sure the `Create an account` radio button is selected
   13. Fill out the contact information
   14. Under the `Billing Information` section, you can leave the `Tax ID/VATIN` blank
   15. Once finished, click `Create account` at the bottom
   16. Finish the remaining steps and pay for the bot
3.  Once finished, head to the Billing Panel by clicking the link in the top right
4.  Under the `Services` section you should see that you have one item under `Pending`, once this moves to `Active`, your webserver will be setup
5.  To login to your webserver console, make sure you are on the `Active` tab under the `Services` section
6.  Hover over your webserver and click the `Control Panel` link
7.  Jot down the `Username` and `Password`, then click the `Login URL` to login
8.  The new page will allow you to login and see your webserver console. From here you can click on your webserver and configure more settings as well as make new edits if needed