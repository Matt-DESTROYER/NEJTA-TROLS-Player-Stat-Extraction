// IIFE to extract player stats from NEJTA TROLS
(function NEJTA_TROLS_Player_Stat_Extractor() {
	// be prepared to abort any time due to an unexpected error
	try {
		// double check this is the right website
		if (window.location.host !== "trols.org.au" &&
			(window.location.pathname === "/nejta/results.php" || window.location.pathname === "/nejta/p_results.php")) {
			console.warn("Attempted to run NEJTA TROLS Player Stat Extractor on a different page.");
			return;
		}
		
		// user input
		const GET_TEAM_STATS = (window.prompt("Enter the club/team to get stats for:") || "").trim().toLowerCase();
		
		if (!GET_TEAM_STATS) return;
		
		const GET_X_STATS = (window.prompt("Enter the name of the player to get stats for:") || "").trim().toLowerCase();
		
		if (!GET_X_STATS) return;
		
		// object to store player data stats
		const PLAYER_DATA = {
			"name": GET_X_STATS,
			"team": GET_TEAM_STATS,
			"singles": {
				"wins": 0,
				"losses": 0
			},
			"doubles": {
				"wins": 0,
				"losses": 0
			}
		};
		// properly format display names
		PLAYER_DATA.name = PLAYER_DATA.name
			.split(" ")
			.map((part) => part[0].toUpperCase() + part.substr(1))
			.join(" ");
		PLAYER_DATA.team = PLAYER_DATA.team
			.split(" ")
			.map((part) => part[0].toUpperCase() + part.substr(1))
			.join(" ");
		
		// navigate the tables within tables
		const table = document.querySelector("body > table > tbody > tr > td > table");
		const tableBody = table.children[0];
		const tableRows = Array.from(tableBody.children);
		const tableRowChildren = tableRows.map((tableRow) => tableRow.children);
		
		// store each match lookup
		const promises = [];
		
		// for each table row
		for (let i = 0; i < tableRowChildren.length; i++) {
			// temp easy access to current table row
			const trChildren = tableRowChildren[i];
			// if the first or last child in the table row is the team we are getting the stats for (these are the first and last elements in the table)
			if (trChildren[0].textContent.trim().toLowerCase() === GET_TEAM_STATS || trChildren[trChildren.length - 1].textContent.trim().toLowerCase() === GET_TEAM_STATS) {
				// get the clickable anchor element from the first child in the table row
				const anchorElem = trChildren[0].children[0];
				// check if it is clickable
				if (anchorElem && "onclick" in anchorElem  && anchorElem.onclick) {
					// get the plain text of the click event
					const clickEvent = anchorElem.onclick.toString();
					
					// get the season ID
					const seasonIDstart = clickEvent.indexOf("'");
					const seasonIDlength = clickEvent.indexOf("'", seasonIDstart + 1) - seasonIDstart - 1;
					const seasonID = clickEvent.substr(seasonIDstart + 1, seasonIDlength);
					
					// get the match ID
					const matchIDstart = clickEvent.indexOf("'", seasonIDstart + seasonIDlength + 2) + 1;
					const matchIDlength = clickEvent.indexOf("'", matchIDstart + 1) - matchIDstart;
					const matchID = clickEvent.substr(matchIDstart, matchIDlength);
					
					// add to the queue of promises (so that everything runs asynchronously)
					promises.push(new Promise(function(res, rej) {
						// create an iframe which will access the data we want (it's just easier to use the virtual DOM than to use the plain HTML text)
						const iframe = document.createElement("iframe");
						iframe.setAttribute("src", `match_popup.php?seasonid=${seasonID}&matchid=${matchID}`);
						iframe.hidden = true;
						// make sure we are ready to grab the stats when the iframe loads
						iframe.addEventListener("load", function() {
							// grab the base document within the iframe
							const idoc = iframe.contentWindow.document;
							
							// get the table of data from within the iframe
							const dataTable = idoc.getElementsByClassName("xs")[1];
							const dataBody = dataTable.children[0];
							
							// get the three columns of the table (home players, data, away players)
							const main = dataBody.children[1];
							// grab the home team players and format them in an array of plain, lowercase, names
							const homePlayers = Array.from(main.children[0].querySelectorAll("tr"))
								.map((row) => row.children[1].textContent.replace(/^\s*(\d*\.\s*)?|\s*$/g, "").toLowerCase());
							// grab the away team players and format them in an array of plain, lowercase, names
							const awayPlayers = Array.from(main.children[2].querySelectorAll("tr"))
								.map((row) => row.children[1].textContent.replace(/^\s*(\d*\.\s*)?|\s*$/g, "").toLowerCase());
							// identify whether the player we're grabbing stats for is playing at home or away
							const playingAt = homePlayers.includes(GET_X_STATS) ? "home" : "away";
							// identify the order of the player we're grabbing stats for
							const playerNumber = (playingAt === "home" ? homePlayers.indexOf(GET_X_STATS) : awayPlayers.indexOf(GET_X_STATS)) + 1;
							// grab the rows of raw data on which players played which and the scores (and format in a nested array with the first level indicating the row, and the second, each element from that row)
							const data = Array.from(main.children[1].querySelectorAll("tr"))
								.map((dataRow) => Array.prototype.map.call(dataRow.children, (dataColumn) => dataColumn.textContent));
							
							// iterate through the data
							for (let i = 0; i < data.length; i++) {
								// check if this row is a singles or doubles match
								const singles = data[i][0].length === 1;
								// if the player we're grabbing stats for is on the home team
								if (playingAt === "home") {
									// if they are playing, based on looking in the first column
									if (data[i][0].includes(playerNumber)) {
										// check whether the player won or lost
										const won = data[i][1].split("-")[0] === "6";
										// increment their wins/losses
										if (won) {
											PLAYER_DATA[singles ? "singles" : "doubles"].wins++;
										} else {
											PLAYER_DATA[singles ? "singles" : "doubles"].losses++;
										}
									}
								} else {
									// if they are playing, based on looking in the third column
									if (data[i][2].includes(playerNumber)) {
										// check whether the player won or lost
										const won = data[i][1].split("-")[1] === "6";
										// increment their wins/losses
										if (won) {
											PLAYER_DATA[singles ? "singles" : "doubles"].wins++;
										} else {
											PLAYER_DATA[singles ? "singles" : "doubles"].losses++;
										}
									}
								}
							}
							// remove the iframe from the page once we've grabbed all the stats
							document.body.removeChild(iframe);
							// resolve the promise
							res();
						});
						// add the iframe to the page (so it will actually load the stats, because of hidden=true, it will not display)
						document.body.append(iframe);
					}));
				}
			}
		}
		
		// wait until all stats are gathered
		Promise.all(promises)
			// then
			.then(function() {
				// remove everything from the current page
				while (document.body.firstChild) {
					document.body.removeChild(document.body.lastChild);
				}
				
				// create a title
				const title = document.createElement("h1");
				title.textContent = "Player: " + PLAYER_DATA.name;
				
				// create singles stats
				const singles = document.createElement("div");
				const singles_subtitle = document.createElement("h3");
				singles_subtitle.textContent = "Singles";
				const singles_wins = document.createElement("p");
				singles_wins.textContent = "Wins: " + PLAYER_DATA.singles.wins;
				const singles_losses = document.createElement("p");
				singles_losses.textContent = "Losses: " + PLAYER_DATA.singles.losses;
				singles.append(singles_subtitle);
				singles.append(singles_wins);
				singles.append(singles_losses);
				
				// create doubles stats
				const doubles = document.createElement("div");
				const doubles_subtitle = document.createElement("h3");
				doubles_subtitle.textContent = "Doubles";
				const doubles_wins = document.createElement("p");
				doubles_wins.textContent = "Wins: " + PLAYER_DATA.doubles.wins;
				const doubles_losses = document.createElement("p");
				doubles_losses.textContent = "Losses: " + PLAYER_DATA.doubles.losses;
				doubles.append(doubles_subtitle);
				doubles.append(doubles_wins);
				doubles.append(doubles_losses);
				
				// display the created elements
				document.body.append(title);
				document.body.append(singles);
				document.body.append(doubles);
			});
	} /* if an unexpected error occurs */ catch (err) {
		// log the unexpected error in the console
		console.error("An unexpected error occurred running TROLS NEJTA Slayer Stats Script:", err);
	}
})();
