
const SlackBot = require('slackbots');
const axios = require('axios');

const bot = new SlackBot({
    token: 'xoxb-533995794803-534307959621-gjcmt1davhvuPt4XPA2O5dE5',
    name: 'payBot'

});


 


// global users list
var members;
//a list of all the usernames in group
var membersList = [];

//this keeps track of who in the group owes money
var map= {};

// sum of all receipt values
var totalprice;
// number of people in group
var n;
// dollar amount after total price split by n;
var eachOwed; 
// JSON
var api; 





//helper function to sleep (milliseconds)
function sleep(milliseconds) {
    var start = new Date().getTime();
    for (var i = 0; i < 1e7; i++) {
      if ((new Date().getTime() - start) > milliseconds){
        break;
      }
    }
  }

//takes 
function getUsers(){
    axios.get('https://slack.com/api/users.list?token=xoxp-533995794803-535165824231-533944060020-74295626b5d686b6cf78d7680c726b70&pretty=1')
    .then(res =>{
    
        members = res.data.members;
        for (var i =0; i < members.length; i++){
            var j = members[i];
            membersList.push(
                j.real_name
            );
        }
   
        //number of people in chat
        n = membersList.length;

        for(var i in membersList){
            var name = membersList[i];
            map[name] = 0;
            console.log(name);
        }
    })
    sleep(2000);
}

function loadAPI(){
    axios.get('https://electroid.lib.id/nwhacks@dev/?url=https://ashcon.nyc3.cdn.digitaloceanspaces.com/nwhacks/0.jpg')
    .then(res =>{
        api = res.data; 
        totalprice = res.data.total;
        console.log(totalprice);


    })
}



// Start Handler
bot.on('start', () => {
    const params ={
        icon_emoji: ':smiley:'
    }
    bot.postMessageToChannel('grouppay', 'welcome to PayTogether!', params );
    

//});

    // instantiate map
    loadAPI();
    getUsers();
    //sets up map of names, amount owed
    sleep(1000);
 

});

// Error Handler
bot.on('error', (err) => console.log(err));

// Message Handler
bot.on('message', (data) => {
    if (data.type !=='message'){
        return;
    }
    console.log(data);
    handleMessage(data.text);
});


function handleFile(file){
    
}


// Response to data
function handleMessage(message){
    if (message.includes('/splitAll')){
        split();
        splitAll();
        var eachOwe= split();
        
        bot.postMessageToChannel(
            'grouppay',
            `total cost is is: $${totalprice}`
            
        );

        bot.postMessageToChannel(
            'grouppay',
            `cost for each person is: $${eachOwe}`
        );

    }else if(message.includes('//owing')){
        amountOwing();
    }else if (message.includes('//pay')){
        pay();
    }else if (message.includes('//upload'
    )){
        handleFile();
    }
}
// return total cost / number of ppl
function split(){
        
        eachOwed = Math.round(totalprice/(n-1),2);

        return eachOwed;
}

function splitAll(){

    for (var k in map){
        if (map.hasOwnProperty(k)) {
            map[k] = split();
        }
    }

    
}


function amountOwing(){
//output every userID, value pair onto screen
console.log("qwerty");
console.log(map);
for (var k in map) {
    if (map.hasOwnProperty(k)) {
        var oweName = k;
        var owes = map[k];
        bot.postMessageToChannel('grouppay', `${oweName}  owes $ ${owes}`);
       
        }
    }
}

function pay(){
    
    axios.get('https://slack.com/api/users.profile.get?token=xoxp-533995794803-535165824231-533944060020-74295626b5d686b6cf78d7680c726b70&pretty=1')
    .then(res =>{
    
        const name = res.data.profile.real_name;
        for(var k in map){
            if (map.hasOwnProperty(name)){
                map[name] = 0; 
            }
        }
        bot.postMessageToChannel('grouppay', ` ${name} has paid!`);
})
}

