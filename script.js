// CampusVote - Online Voting System (Demo)
// data is saved in localStorage so it stays only in this browser

let DEFAULT_PASSWORD = "admin123";   // used until the admin changes it in Settings
let VVPAT_SECONDS = 5;
let MAX_WRONG_TRIES = 5;             // after this many wrong passwords, login is locked for 30 sec
let colors = ["#3b82f6", "#f97316", "#ef4444", "#14b8a6", "#22c55e", "#eab308", "#a855f7", "#ec4899"];

// default data (used first time or after reset)
function defaultData() {
    return {
        title: "Student Council Election 2026",
        post: "President",
        votingOpen: true,
        showLiveResults: true,
        candidates: [
            { id: 1, name: "Riya Kapoor", symbol: "🌻", slogan: "Clean and green campus", votes: 0 },
            { id: 2, name: "Arjun Negi", symbol: "🏀", slogan: "Inter-college sports meet", votes: 0 },
            { id: 3, name: "Meera Iyer", symbol: "🎭", slogan: "More clubs, more fests", votes: 0 },
            { id: 4, name: "Dev Malhotra", symbol: "🚌", slogan: "Extra college bus routes", votes: 0 },
            { id: 99, name: "NOTA", symbol: "✖️", slogan: "None of the above", votes: 0 }
        ],
        voters: [],   // only name, roll, dept, year, time. NOT the candidate (secret ballot)
        slips: [],    // VVPAT slips: only the candidate id, kept in random order
        log: []       // activity log for the admin
    };
}

// load saved data. Data saved by the old version of this project does not
// have the new fields (title, slips, log ...), so we add them here.
function loadData() {
    let saved = null;
    try {
        saved = JSON.parse(localStorage.getItem("electionData"));
    } catch (e) {
        saved = null;
    }
    if (saved == null) {
        return defaultData();
    }

    let d = defaultData();
    if (saved.title == undefined) saved.title = d.title;
    if (saved.post == undefined) saved.post = d.post;
    if (saved.showLiveResults == undefined) saved.showLiveResults = true;
    if (saved.log == undefined) saved.log = [];
    if (saved.slips == undefined) {
        // make the slips again from the old vote counts
        saved.slips = [];
        for (let i = 0; i < saved.candidates.length; i++) {
            for (let j = 0; j < saved.candidates[i].votes; j++) {
                dropSlip(saved.slips, saved.candidates[i].id);
            }
        }
    }
    return saved;
}

let data = loadData();
let currentVoter = null;   // voter who passed step 1
let busy = false;          // true while VVPAT slip is showing

let adminLoggedIn = false;
let wrongTries = 0;
let lockedUntil = 0;       // time (in ms) until which login is locked

function saveData() {
    localStorage.setItem("electionData", JSON.stringify(data));
}

function votedOnThisBrowser() {
    return localStorage.getItem("votedHere") != null;
}

// password is kept in localStorage so the admin can change it
// (demo only - a real system keeps passwords on a server, hashed)
function getPassword() {
    let saved = localStorage.getItem("adminPassword");
    if (saved == null) {
        return DEFAULT_PASSWORD;
    }
    return saved;
}

function nowText() {
    return new Date().toLocaleString("en-IN");
}

// changes < > & " ' into safe codes so text typed by a user
// cannot add HTML tags or scripts to the page
function safe(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// writes one line in the activity log (newest first)
function addLog(text) {
    data.log.unshift({ time: nowText(), text: text });
    if (data.log.length > 300) {
        data.log.pop();
    }
}

// shows a message in red (error) or green (success)
function showMsg(id, text, isError) {
    let p = document.getElementById(id);
    p.innerHTML = text;
    p.className = isError ? "error" : "success";
}

function findCandidate(id) {
    for (let i = 0; i < data.candidates.length; i++) {
        if (data.candidates[i].id == id) {
            return data.candidates[i];
        }
    }
    return null;
}

function totalVotes() {
    let total = 0;
    for (let i = 0; i < data.candidates.length; i++) {
        total += data.candidates[i].votes;
    }
    return total;
}

// number of candidates without NOTA
function candidateCount() {
    let count = 0;
    for (let i = 0; i < data.candidates.length; i++) {
        if (data.candidates[i].id != 99) count++;
    }
    return count;
}

// copy of the candidate list, highest votes first
function sortedCandidates() {
    let sorted = data.candidates.slice();
    sorted.sort(function (a, b) {
        return b.votes - a.votes;
    });
    return sorted;
}

// puts a slip at a random place in the box, so the order of the slips
// does not match the order of the voter list (keeps the ballot secret)
function dropSlip(slips, candidateId) {
    let position = Math.floor(Math.random() * (slips.length + 1));
    slips.splice(position, 0, candidateId);
}

function twoDigits(n) {
    return n < 10 ? "0" + n : "" + n;
}


/* ================= tabs ================= */

function openTab(id) {
    let tabs = document.querySelectorAll(".tab");
    for (let i = 0; i < tabs.length; i++) {
        tabs[i].classList.add("hidden");
    }
    document.getElementById(id).classList.remove("hidden");

    let btns = document.querySelectorAll(".nav-btn");
    for (let i = 0; i < btns.length; i++) {
        btns[i].classList.remove("active");
    }
    document.getElementById("nav-" + id).classList.add("active");

    if (id == "homeTab") showHome();
    if (id == "voteTab") showVoteScreen();
    if (id == "resultTab") showResults();
    if (id == "adminTab") showAdmin();
    window.scrollTo(0, 0);
}

// election name, post and open/closed badge at the top
function updateBanner() {
    document.getElementById("bannerTitle").innerHTML = safe(data.title);
    document.getElementById("bannerPost").innerHTML = safe(data.post);
    document.title = data.title + " - CampusVote";

    let badge = document.getElementById("statusBadge");
    if (data.votingOpen) {
        badge.innerHTML = "Voting Open";
        badge.classList.remove("closed");
    } else {
        badge.innerHTML = "Voting Closed";
        badge.classList.add("closed");
    }
}


/* ================= home ================= */

function showHome() {
    document.getElementById("homePost").innerHTML = safe(data.post);
    document.getElementById("homeVotes").innerHTML = totalVotes();
    document.getElementById("homeCand").innerHTML = candidateCount();
    document.getElementById("homeStatus").innerHTML = data.votingOpen ? "Open" : "Closed";

    let html = "";
    for (let i = 0; i < data.candidates.length; i++) {
        let c = data.candidates[i];
        if (c.id == 99) continue;   // NOTA is not a person, so no card
        html += "<div class='cand-card'>" +
            "<div class='cand-symbol'>" + c.symbol + "</div>" +
            "<b>" + safe(c.name) + "</b>" +
            "<p>" + safe(c.slogan) + "</p>" +
            "</div>";
    }
    if (html == "") html = "<p class='small'>No candidates added yet.</p>";
    document.getElementById("homeCands").innerHTML = html;
}


/* ================= voting ================= */

function setStep(n) {
    for (let i = 1; i <= 3; i++) {
        let s = document.getElementById("step" + i);
        s.classList.remove("active");
        s.classList.remove("done");
        if (i < n) s.classList.add("done");
        if (i == n) s.classList.add("active");
    }
}

function hideVoteBoxes() {
    document.getElementById("verifyBox").classList.add("hidden");
    document.getElementById("evmBox").classList.add("hidden");
    document.getElementById("doneBox").classList.add("hidden");
    document.getElementById("closedBox").classList.add("hidden");
}

// decides which box to show in vote tab
function showVoteScreen() {
    hideVoteBoxes();

    if (votedOnThisBrowser()) {
        document.getElementById("doneTime").innerHTML = "Voted on " + localStorage.getItem("votedHere");
        document.getElementById("doneBox").classList.remove("hidden");
        setStep(3);
    } else if (!data.votingOpen) {
        document.getElementById("closedBox").classList.remove("hidden");
        setStep(0);
    } else if (currentVoter != null) {
        document.getElementById("evmBox").classList.remove("hidden");
        setStep(2);
    } else {
        document.getElementById("verifyBox").classList.remove("hidden");
        setStep(1);
    }
}

function verifyVoter() {
    let msg = document.getElementById("verifyMsg");
    let name = document.getElementById("vName").value.trim();
    let roll = document.getElementById("vRoll").value.trim().toUpperCase();
    let dept = document.getElementById("vDept").value;
    let year = document.getElementById("vYear").value;
    let agree = document.getElementById("vAgree").checked;

    if (!data.votingOpen) {
        showVoteScreen();
        return;
    }
    if (name.length < 3 || !/^[A-Za-z ]+$/.test(name)) {
        msg.innerHTML = "Please enter your full name (letters only).";
        return;
    }
    if (roll.length < 4 || !/^[A-Z0-9]+$/.test(roll)) {
        msg.innerHTML = "Roll number should have only letters and numbers.";
        return;
    }
    if (dept == "" || year == "") {
        msg.innerHTML = "Please select your department and year.";
        return;
    }
    if (!agree) {
        msg.innerHTML = "Please tick the checkbox.";
        return;
    }

    // same roll number cannot vote again
    for (let i = 0; i < data.voters.length; i++) {
        if (data.voters[i].roll == roll) {
            msg.innerHTML = "Roll number " + roll + " has already voted!";
            return;
        }
    }

    msg.innerHTML = "";
    currentVoter = { name: name, roll: roll, dept: dept, year: year };
    document.getElementById("voterInfo").innerHTML =
        "Voter: <b>" + safe(name) + "</b> &nbsp;|&nbsp; " + roll + " &nbsp;|&nbsp; " + dept + ", " + year;
    showBallot();
    showVoteScreen();
}

function showBallot() {
    let html = "";
    for (let i = 0; i < data.candidates.length; i++) {
        let c = data.candidates[i];
        html += "<div class='evm-row'>" +
            "<span class='sno'>" + (i + 1) + "</span>" +
            "<span class='cname'>" + safe(c.name) + "<br><span class='slogan'>" + safe(c.slogan) + "</span></span>" +
            "<span class='sym'>" + c.symbol + "</span>" +
            "<i class='lamp' id='lamp" + c.id + "'></i>" +
            "<button class='evm-btn' onclick='castVote(" + c.id + ")' title='Vote'></button>" +
            "</div>";
    }
    document.getElementById("ballot").innerHTML = html;
}

// beep sound like the real machine (made with Web Audio, no mp3 needed)
function beep() {
    try {
        let ctx = new (window.AudioContext || window.webkitAudioContext)();
        let osc = ctx.createOscillator();
        osc.frequency.value = 900;
        osc.connect(ctx.destination);
        osc.start();
        setTimeout(function () {
            osc.stop();
            ctx.close();
        }, 700);
    } catch (e) {
        // sound not supported, no problem
    }
}

function castVote(id) {
    if (busy || currentVoter == null || votedOnThisBrowser() || !data.votingOpen) {
        return;
    }
    busy = true;

    // lock all buttons and switch on the red lamp
    let btns = document.querySelectorAll(".evm-btn");
    for (let i = 0; i < btns.length; i++) {
        btns[i].disabled = true;
    }
    document.getElementById("lamp" + id).classList.add("on");
    beep();

    // save the vote
    let c = findCandidate(id);
    c.votes++;
    dropSlip(data.slips, id);   // paper slip goes in the box (random place)

    let time = nowText();
    data.voters.push({
        name: currentVoter.name,
        roll: currentVoter.roll,
        dept: currentVoter.dept,
        year: currentVoter.year,
        time: time,
        ts: Date.now()          // time in numbers, used for the "votes by hour" chart
    });
    addLog("Vote cast by roll no. " + currentVoter.roll + " (" + currentVoter.dept + ")");
    saveData();
    localStorage.setItem("votedHere", time);

    showSlip(c);
}

// VVPAT slip shows for few seconds then goes
function showSlip(c) {
    let index = data.candidates.indexOf(c) + 1;
    document.getElementById("slipNo").innerHTML = "Sr. No. " + index;
    document.getElementById("slipSymbol").innerHTML = c.symbol;
    document.getElementById("slipName").innerHTML = safe(c.name);
    document.getElementById("vvpat").classList.remove("hidden");

    let sec = VVPAT_SECONDS;
    document.getElementById("slipTimer").innerHTML = "Slip visible for " + sec + " seconds";

    let timer = setInterval(function () {
        sec--;
        if (sec <= 0) {
            clearInterval(timer);
            document.getElementById("vvpat").classList.add("hidden");
            currentVoter = null;
            busy = false;
            clearForm();
            showVoteScreen();
        } else {
            document.getElementById("slipTimer").innerHTML = "Slip visible for " + sec + " seconds";
        }
    }, 1000);
}

function clearForm() {
    document.getElementById("vName").value = "";
    document.getElementById("vRoll").value = "";
    document.getElementById("vDept").value = "";
    document.getElementById("vYear").value = "";
    document.getElementById("vAgree").checked = false;
}


/* ================= results ================= */

// public can see results when voting is closed,
// or while open if the admin turned on live results
function resultsVisible() {
    return !data.votingOpen || data.showLiveResults;
}

// one bar with a label, count and percent (used in many places)
function barHtml(label, count, total, color) {
    let percent = total > 0 ? (count / total) * 100 : 0;
    return "<div class='bar-row'>" +
        "<div class='bar-top'><span>" + label + "</span><span>" + count + " (" + percent.toFixed(1) + "%)</span></div>" +
        "<div class='bar'><div class='fill' style='width:" + percent + "%; background-color:" + color + "'></div></div>" +
        "</div>";
}

function showResults() {
    let total = totalVotes();

    if (!resultsVisible()) {
        document.getElementById("resultLocked").classList.remove("hidden");
        document.getElementById("resultContent").classList.add("hidden");
        document.getElementById("lockedVotes").innerHTML = total;
        return;
    }
    document.getElementById("resultLocked").classList.add("hidden");
    document.getElementById("resultContent").classList.remove("hidden");

    document.getElementById("statVotes").innerHTML = total;
    document.getElementById("statCand").innerHTML = candidateCount();
    document.getElementById("statStatus").innerHTML = data.votingOpen ? "Open" : "Closed";

    let sorted = sortedCandidates();

    // ----- ranking bars -----
    let bars = "";
    for (let i = 0; i < sorted.length; i++) {
        let c = sorted[i];
        let percent = total > 0 ? (c.votes / total) * 100 : 0;
        bars += "<div class='bar-row'>" +
            "<div class='bar-top'><span>" + (i + 1) + ". " + c.symbol + " " + safe(c.name) + "</span>" +
            "<span>" + c.votes + (c.votes == 1 ? " vote" : " votes") + " (" + percent.toFixed(1) + "%)</span></div>" +
            "<div class='bar'><div class='fill' style='width:" + percent + "%; background-color:" + getColor(c) + "'></div></div>" +
            "</div>";
    }
    document.getElementById("bars").innerHTML = bars;

    // ----- pie chart using conic-gradient -----
    let pie = document.getElementById("pie");
    let legend = "";
    if (total == 0) {
        pie.style.background = "#e5e7eb";
        legend = "<p class='small'>No votes yet</p>";
    } else {
        let parts = [];
        let start = 0;
        for (let i = 0; i < data.candidates.length; i++) {
            let c = data.candidates[i];
            if (c.votes == 0) continue;
            let end = start + (c.votes / total) * 100;
            parts.push(getColor(c) + " " + start + "% " + end + "%");
            legend += "<p><i style='background-color:" + getColor(c) + "'></i>" + safe(c.name) + " - " + ((c.votes / total) * 100).toFixed(1) + "%</p>";
            start = end;
        }
        pie.style.background = "conic-gradient(" + parts.join(", ") + ")";
    }
    document.getElementById("legend").innerHTML = legend;

    // ----- winner / leading -----
    let winnerBox = document.getElementById("winnerBox");
    if (total == 0) {
        winnerBox.innerHTML = "No votes yet. Be the first one to vote!";
    } else {
        let top = sorted[0].votes;
        let leaders = [];
        for (let i = 0; i < sorted.length; i++) {
            if (sorted[i].votes == top) {
                leaders.push(sorted[i].symbol + " " + safe(sorted[i].name));
            }
        }

        let word = data.votingOpen ? "Leading" : "Winner";
        if (leaders.length > 1) {
            winnerBox.innerHTML = (data.votingOpen ? "Tie right now: " : "Result is a tie: ") + leaders.join(" & ");
        } else if (sorted[0].id == 99) {
            winnerBox.innerHTML = "NOTA has the most votes!";
        } else {
            winnerBox.innerHTML = "&#127942; " + word + ": " + leaders[0] + " with " + top + (top == 1 ? " vote" : " votes");
        }
    }

    // ----- voters by department (does not show who they voted for) -----
    let deptCount = {};
    for (let i = 0; i < data.voters.length; i++) {
        let d = data.voters[i].dept;
        if (deptCount[d] == undefined) deptCount[d] = 0;
        deptCount[d]++;
    }
    let deptHtml = "";
    for (let d in deptCount) {
        deptHtml += "<div class='dept-row'><span>" + d + "</span><b>" + deptCount[d] + "</b></div>";
    }
    if (deptHtml == "") deptHtml = "<p class='small'>No voters yet.</p>";
    document.getElementById("deptList").innerHTML = deptHtml;
}

// NOTA always grey, others get colors in order
function getColor(c) {
    if (c.id == 99) return "#9ca3af";
    let index = data.candidates.indexOf(c);
    return colors[index % colors.length];
}


/* ================= admin login ================= */

function showAdmin() {
    if (adminLoggedIn) {
        document.getElementById("loginBox").classList.add("hidden");
        document.getElementById("adminPanel").classList.remove("hidden");
        renderAdmin();
        renderSettings();
    } else {
        document.getElementById("loginBox").classList.remove("hidden");
        document.getElementById("adminPanel").classList.add("hidden");

        // show the demo password only while it is still the default one
        let hint = document.getElementById("passHint");
        if (getPassword() == DEFAULT_PASSWORD) {
            hint.innerHTML = "&#128273; Demo password: <b>" + DEFAULT_PASSWORD + "</b><br>" +
                "Please change it from Admin &rarr; Settings after you log in.";
        } else {
            hint.innerHTML = "";
        }
    }
}

function togglePassView() {
    let input = document.getElementById("adminPass");
    if (document.getElementById("showPass").checked) {
        input.type = "text";
    } else {
        input.type = "password";
    }
}

function adminLogin() {
    let msg = document.getElementById("loginMsg");
    let input = document.getElementById("adminPass");

    // still locked because of too many wrong tries?
    let waitSec = Math.ceil((lockedUntil - Date.now()) / 1000);
    if (waitSec > 0) {
        msg.innerHTML = "Too many wrong tries. Try again in " + waitSec + " seconds.";
        return;
    }

    if (input.value == getPassword()) {
        adminLoggedIn = true;
        wrongTries = 0;
        input.value = "";
        msg.innerHTML = "";
        addLog("Admin logged in");
        saveData();
        openAdminPage("ovPage");
        showAdmin();
    } else {
        wrongTries++;
        input.value = "";
        if (wrongTries >= MAX_WRONG_TRIES) {
            lockedUntil = Date.now() + 30000;
            wrongTries = 0;
            msg.innerHTML = "Too many wrong tries. Login is locked for 30 seconds.";
            addLog("Admin login locked after " + MAX_WRONG_TRIES + " wrong passwords");
            saveData();
        } else {
            msg.innerHTML = "Wrong password! " + (MAX_WRONG_TRIES - wrongTries) + " tries left.";
        }
    }
}

function adminLogout() {
    adminLoggedIn = false;
    document.getElementById("showPass").checked = false;
    togglePassView();
    addLog("Admin logged out");
    saveData();
    showAdmin();
}


/* ================= admin dashboard ================= */

// switch between Overview, Candidates, Voters ... inside the admin panel
function openAdminPage(id) {
    let pages = document.querySelectorAll(".admin-page");
    for (let i = 0; i < pages.length; i++) {
        pages[i].classList.add("hidden");
    }
    document.getElementById(id).classList.remove("hidden");

    let btns = document.querySelectorAll(".sub-btn");
    for (let i = 0; i < btns.length; i++) {
        btns[i].classList.remove("active");
    }
    document.getElementById("sub-" + id).classList.add("active");

    renderAdmin();
    if (id == "setPage") renderSettings();
}

function renderAdmin() {
    renderOverview();
    renderCandidates();
    renderVoters();
    renderBallotBox();
    renderLog();
}

function adminMessage(text) {
    document.getElementById("adminMsg").innerHTML = text;
}

// ----- overview -----
function renderOverview() {
    let total = totalVotes();

    document.getElementById("ovVotes").innerHTML = total;
    document.getElementById("ovCand").innerHTML = candidateCount();
    document.getElementById("ovStatus").innerHTML = data.votingOpen ? "Open" : "Closed";
    let last = "-";
    if (data.voters.length > 0) {
        last = data.voters[data.voters.length - 1].time;
    }
    document.getElementById("ovLast").innerHTML = last;
    document.getElementById("toggleBtn").innerHTML = data.votingOpen ? "Close Voting" : "Open Voting";

    // integrity check: EVM total, voter list and VVPAT slips must be equal
    let voterTotal = data.voters.length;
    let slipTotal = data.slips.length;
    let counts = "EVM votes: <b>" + total + "</b> &nbsp;|&nbsp; Voters in list: <b>" + voterTotal +
        "</b> &nbsp;|&nbsp; VVPAT slips: <b>" + slipTotal + "</b>";
    let checkBox = document.getElementById("checkBox");
    if (total == voterTotal && voterTotal == slipTotal) {
        checkBox.className = "check-box ok";
        checkBox.innerHTML = "&#10004; <b>All counts match.</b> The election data is consistent.<p>" + counts + "</p>";
    } else {
        checkBox.className = "check-box bad";
        checkBox.innerHTML = "&#10008; <b>Counts do not match!</b> Check the Ballot Box page.<p>" + counts + "</p>";
    }

    // full result table
    let sorted = sortedCandidates();
    let rows = "";
    for (let i = 0; i < sorted.length; i++) {
        let c = sorted[i];
        let percent = total > 0 ? (c.votes / total) * 100 : 0;
        rows += "<tr><td>" + (i + 1) + "</td><td>" + safe(c.name) + "</td><td>" + c.symbol + "</td><td><b>" + c.votes +
            "</b></td><td>" + percent.toFixed(1) + "%</td>" +
            "<td><div class='bar'><div class='fill' style='width:" + percent + "%; background-color:" + getColor(c) + "'></div></div></td></tr>";
    }
    document.getElementById("ovResultTable").innerHTML = rows;

    document.getElementById("ovDept").innerHTML = countBars("dept");
    document.getElementById("ovYear").innerHTML = countBars("year");
    renderHours();
}

// bars for how many voters came from each department or year
function countBars(field) {
    let counts = {};
    let names = [];
    for (let i = 0; i < data.voters.length; i++) {
        let key = data.voters[i][field];
        if (counts[key] == undefined) {
            counts[key] = 0;
            names.push(key);
        }
        counts[key]++;
    }
    if (names.length == 0) {
        return "<p class='small'>No voters yet.</p>";
    }

    // biggest first
    names.sort(function (a, b) {
        return counts[b] - counts[a];
    });

    let html = "";
    for (let i = 0; i < names.length; i++) {
        html += barHtml(safe(names[i]), counts[names[i]], data.voters.length, "#0284c7");
    }
    return html;
}

// bars for how many votes came in each hour
function renderHours() {
    let counts = {};
    let labels = [];
    let counted = 0;
    for (let i = 0; i < data.voters.length; i++) {
        let v = data.voters[i];
        if (v.ts == undefined) continue;   // votes from the old version have no ts
        let d = new Date(v.ts);
        let h = d.getHours();
        let label = d.toLocaleDateString("en-IN") + " &nbsp; " + twoDigits(h) + ":00 - " + twoDigits(h + 1) + ":00";
        if (counts[label] == undefined) {
            counts[label] = 0;
            labels.push(label);
        }
        counts[label]++;
        counted++;
    }

    let html = "";
    for (let i = 0; i < labels.length; i++) {
        html += barHtml(labels[i], counts[labels[i]], counted, "#14b8a6");
    }
    if (html == "") html = "<p class='small'>No votes yet.</p>";
    document.getElementById("ovHours").innerHTML = html;
}

// ----- candidates -----
function renderCandidates() {
    let started = data.voters.length > 0;
    let html = "";
    for (let i = 0; i < data.candidates.length; i++) {
        let c = data.candidates[i];
        let disable = (started || c.id == 99) ? "disabled" : "";
        html += "<div class='cand-row'>" +
            "<span>" + c.symbol + " <b>" + safe(c.name) + "</b> <span class='small'>" + safe(c.slogan) + "</span></span>" +
            "<button class='del-btn' " + disable + " onclick='deleteCandidate(" + c.id + ")'>Remove</button>" +
            "</div>";
    }
    document.getElementById("candList").innerHTML = html;
}

// ----- voters -----
// returns the positions of voters that match the search and filters
function filteredVoters() {
    let search = document.getElementById("searchVoter").value.trim().toUpperCase();
    let dept = document.getElementById("filterDept").value;
    let year = document.getElementById("filterYear").value;

    let list = [];
    for (let i = 0; i < data.voters.length; i++) {
        let v = data.voters[i];
        if (dept != "" && v.dept != dept) continue;
        if (year != "" && v.year != year) continue;
        if (search != "" && v.name.toUpperCase().indexOf(search) == -1 && v.roll.indexOf(search) == -1) continue;
        list.push(i);
    }
    return list;
}

function renderVoters() {
    let list = filteredVoters();
    let rows = "";
    for (let k = 0; k < list.length; k++) {
        let v = data.voters[list[k]];
        rows += "<tr><td>" + (list[k] + 1) + "</td><td>" + safe(v.name) + "</td><td>" + safe(v.roll) + "</td><td>" + v.dept +
            "</td><td>" + v.year + "</td><td>" + v.time + "</td></tr>";
    }
    if (data.voters.length == 0) {
        rows = "<tr><td colspan='6'>No one has voted yet.</td></tr>";
    } else if (rows == "") {
        rows = "<tr><td colspan='6'>No voter matches your search.</td></tr>";
    }
    document.getElementById("voterTable").innerHTML = rows;
    document.getElementById("voterCount").innerHTML = "Showing " + list.length + " of " + data.voters.length + " voters";
}

// ----- ballot box (VVPAT slips) -----
function renderBallotBox() {
    // count the slips again, one by one
    let slipCount = {};
    for (let i = 0; i < data.slips.length; i++) {
        let id = data.slips[i];
        if (slipCount[id] == undefined) slipCount[id] = 0;
        slipCount[id]++;
    }

    // match each candidate's slips with the EVM count
    let rows = "";
    for (let i = 0; i < data.candidates.length; i++) {
        let c = data.candidates[i];
        let counted = slipCount[c.id] == undefined ? 0 : slipCount[c.id];
        let match = counted == c.votes;
        rows += "<tr><td>" + c.symbol + " " + safe(c.name) + "</td><td>" + c.votes + "</td><td>" + counted + "</td><td>" +
            (match ? "<span class='ok-text'>&#10004; Yes</span>" : "<span class='bad-text'>&#10008; No</span>") + "</td></tr>";
    }
    rows += "<tr><th>Total</th><th>" + totalVotes() + "</th><th>" + data.slips.length + "</th><th></th></tr>";
    document.getElementById("verifyTable").innerHTML = rows;

    // show every slip in the box
    let html = "";
    for (let i = 0; i < data.slips.length; i++) {
        let c = findCandidate(data.slips[i]);
        if (c == null) continue;
        html += "<div class='mini-slip'><p class='slip-num'>Slip " + (i + 1) + "</p><span>" + c.symbol + "</span>" + safe(c.name) + "</div>";
    }
    if (html == "") html = "<p class='small'>The box is empty. No votes yet.</p>";
    document.getElementById("slipGrid").innerHTML = html;
    document.getElementById("slipTotal").innerHTML = data.slips.length;
}

// ----- activity log -----
function renderLog() {
    let html = "";
    for (let i = 0; i < data.log.length; i++) {
        html += "<div class='log-row'><span class='log-time'>" + data.log[i].time + "</span><span>" + safe(data.log[i].text) + "</span></div>";
    }
    if (html == "") html = "<p class='small'>Nothing has happened yet.</p>";
    document.getElementById("logList").innerHTML = html;
}


/* ================= election control ================= */

function toggleVoting() {
    data.votingOpen = !data.votingOpen;
    addLog(data.votingOpen ? "Voting opened" : "Voting closed");
    saveData();
    updateBanner();
    renderAdmin();
    adminMessage(data.votingOpen ? "Voting is open now." : "Voting closed. Final result is in Results tab.");
}

// lets another person vote on the same computer
function nextVoter() {
    if (!votedOnThisBrowser()) {
        adminMessage("Nobody has voted on this browser yet.");
        return;
    }
    localStorage.removeItem("votedHere");
    currentVoter = null;
    addLog("Booth cleared for the next voter");
    saveData();
    renderLog();
    adminMessage("Ready for next voter. Go to the Vote tab.");
}

function resetElection() {
    if (!confirm("This will delete all votes, voters and added candidates. Continue?")) {
        return;
    }
    // keep the election name and post, clear everything else
    let oldTitle = data.title;
    let oldPost = data.post;
    data = defaultData();
    data.title = oldTitle;
    data.post = oldPost;
    addLog("Election was reset (all votes and voters deleted)");
    saveData();
    localStorage.removeItem("votedHere");
    currentVoter = null;
    updateBanner();
    renderAdmin();
    renderSettings();
    adminMessage("Election reset done.");
}

function addCandidate() {
    let name = document.getElementById("cName").value.trim();
    let symbol = document.getElementById("cSymbol").value;
    let slogan = document.getElementById("cSlogan").value.trim();

    if (data.voters.length > 0) {
        showMsg("candMsg", "Voting has already started, cannot add now.", true);
        return;
    }
    if (name.length < 3 || !/^[A-Za-z ]+$/.test(name)) {
        showMsg("candMsg", "Enter a proper name (letters only).", true);
        return;
    }
    if (data.candidates.length >= 8) {
        showMsg("candMsg", "Maximum 8 entries allowed.", true);
        return;
    }
    // two candidates cannot have the same symbol
    for (let i = 0; i < data.candidates.length; i++) {
        if (data.candidates[i].symbol == symbol) {
            showMsg("candMsg", "This symbol is already taken by " + safe(data.candidates[i].name) + ".", true);
            return;
        }
    }
    if (slogan == "") slogan = "-";

    // new id = biggest id (except NOTA) + 1
    let newId = 1;
    for (let i = 0; i < data.candidates.length; i++) {
        if (data.candidates[i].id != 99 && data.candidates[i].id >= newId) {
            newId = data.candidates[i].id + 1;
        }
    }

    // NOTA should always stay last, so insert before it
    data.candidates.splice(data.candidates.length - 1, 0, {
        id: newId, name: name, symbol: symbol, slogan: slogan, votes: 0
    });
    addLog("Candidate added: " + name);
    saveData();
    renderAdmin();

    document.getElementById("cName").value = "";
    document.getElementById("cSlogan").value = "";
    showMsg("candMsg", safe(name) + " added.", false);
}

function deleteCandidate(id) {
    if (data.voters.length > 0 || id == 99) return;
    let c = findCandidate(id);
    if (!confirm("Remove " + c.name + "?")) return;

    let newList = [];
    for (let i = 0; i < data.candidates.length; i++) {
        if (data.candidates[i].id != id) {
            newList.push(data.candidates[i]);
        }
    }
    data.candidates = newList;
    addLog("Candidate removed: " + c.name);
    saveData();
    renderAdmin();
    showMsg("candMsg", safe(c.name) + " removed.", false);
}


/* ================= downloads ================= */

// makes a .csv file (opens in Excel) and downloads it
function downloadCSV(fileName, rows) {
    let text = "﻿";   // tells Excel the file is UTF-8
    for (let i = 0; i < rows.length; i++) {
        let line = [];
        for (let j = 0; j < rows[i].length; j++) {
            line.push('"' + String(rows[i][j]).replace(/"/g, '""') + '"');
        }
        text += line.join(",") + "\n";
    }
    let file = new Blob([text], { type: "text/csv" });
    let link = document.createElement("a");
    link.href = URL.createObjectURL(file);
    link.download = fileName;
    link.click();
}

function downloadResults() {
    let total = totalVotes();
    let sorted = sortedCandidates();
    let rows = [["Rank", "Candidate", "Slogan", "Votes", "Percent"]];
    for (let i = 0; i < sorted.length; i++) {
        let c = sorted[i];
        let percent = total > 0 ? (c.votes / total) * 100 : 0;
        rows.push([i + 1, c.name, c.slogan, c.votes, percent.toFixed(1) + "%"]);
    }
    rows.push([]);
    rows.push(["Election", data.title]);
    rows.push(["Post", data.post]);
    rows.push(["Total votes", total]);
    rows.push(["Voting", data.votingOpen ? "Open" : "Closed"]);
    rows.push(["Downloaded on", nowText()]);
    downloadCSV("election-result.csv", rows);

    addLog("Result CSV downloaded");
    saveData();
    renderLog();
}

function downloadVoters() {
    let list = filteredVoters();
    let rows = [["#", "Name", "Roll No", "Department", "Year", "Time"]];
    for (let k = 0; k < list.length; k++) {
        let v = data.voters[list[k]];
        rows.push([list[k] + 1, v.name, v.roll, v.dept, v.year, v.time]);
    }
    downloadCSV("voter-list.csv", rows);

    addLog("Voter list CSV downloaded (" + list.length + " voters)");
    saveData();
    renderLog();
}


/* ================= settings ================= */

function renderSettings() {
    document.getElementById("setTitle").value = data.title;
    document.getElementById("setPost").value = data.post;
    document.getElementById("setLive").checked = data.showLiveResults;
}

function saveDetails() {
    let title = document.getElementById("setTitle").value.trim();
    let post = document.getElementById("setPost").value.trim();

    if (title.length < 3 || post.length < 2) {
        showMsg("detailsMsg", "Please fill both the election name and the post.", true);
        return;
    }
    data.title = title;
    data.post = post;
    addLog("Election details changed to: " + title + " (" + post + ")");
    saveData();
    updateBanner();
    renderLog();
    showMsg("detailsMsg", "Saved.", false);
}

function toggleLiveResults() {
    data.showLiveResults = document.getElementById("setLive").checked;
    addLog(data.showLiveResults ? "Live results shown to everyone" : "Live results hidden until voting closes");
    saveData();
    renderLog();
}

function changePassword() {
    let oldPass = document.getElementById("oldPass").value;
    let newPass = document.getElementById("newPass").value;
    let newPass2 = document.getElementById("newPass2").value;

    if (oldPass != getPassword()) {
        showMsg("passMsg", "Current password is wrong.", true);
        return;
    }
    if (newPass.length < 6) {
        showMsg("passMsg", "New password must have at least 6 characters.", true);
        return;
    }
    if (newPass == oldPass) {
        showMsg("passMsg", "New password must be different from the current one.", true);
        return;
    }
    if (newPass != newPass2) {
        showMsg("passMsg", "The two new passwords do not match.", true);
        return;
    }

    localStorage.setItem("adminPassword", newPass);
    addLog("Admin password changed");
    saveData();
    renderLog();

    document.getElementById("oldPass").value = "";
    document.getElementById("newPass").value = "";
    document.getElementById("newPass2").value = "";
    showMsg("passMsg", "Password changed. Use the new password next time you log in.", false);
}


// start
updateBanner();
openTab("homeTab");
