const express = require('express')
const app = express();
const request = require('request')
const session = require('express-session')
const DataInterpreter = require('./interpreter.js')
const bodyParser = require('body-parser');
const sources = ['http://www.emergency.wa.gov.au/data/incident_FCAD.json','http://www.pfes.nt.gov.au/incidentmap/json/ntfrsincidents.json','https://www.emergency.wa.gov.au/data/message_warnings.json']


var test = new DataInterpreter(sources) //invoke datainterpreter
app.use(session({
    path: '/',
    secret: 'testing',
}))

app.use(bodyParser.json());

app.set('trust proxy', 1) // trust first proxy

app.get('/login',(req, res) =>
	{
		var username = req.query.username
    	var lat = req.query.lat
    	var long = req.query.long
    	console.log(req.query)

    	if(!req.session.isLoggedIn) //check to see if user has logged in
    	{
    		req.session.username = username
    		req.session.lat = parseFloat(lat)
    		req.session.long = parseFloat(long)
    		req.session.isLoggedIn = true
    		res.redirect("/")
    	} else 
    	{
    		res.redirect("/")
    	}
	}
) 

app.get("/logout",(req,res)=>{
	req.session.isLoggedIn = false
	req.session.username= null
	req.session.lat = null
	req.long = null
	res.redirect('/')

})

app.get("/api",(req,res) =>
{

	var event_to_show = []
	test.extractData((data) => {
		res.json(data)
	});

})

app.get("/",(req,res) => {
	if(req.session.isLoggedIn)
	{
		getDangerZone(req.session.lat,req.session.long,100,(event_to_show) => {
			var output = ""
			for(var i in event_to_show)
			{
				output += event_to_show[i].name + " at " + event_to_show[i].coordinates + " ("+event_to_show[i].distance+" km away). Status: "+event_to_show[i].status+"<br/>"
			} 
			res.send("Hello: "+ req.session.username +
				"<br/>Please stay away from: <br>"+output)

		})
		
	} else
	{
		res.send("/login?username=[username]&lat=[lat]&long=[long]")
	}
})


function getDangerZone(lat,long, threshold = 100, callback) //distance in km 
{
	var event_to_show = []
	test.extractData((data) => {
		for(var i in data){
			var event = data[i]
			var distance = getDistanceFromLatLonInKm(lat,long, event.coordinates[0], event.coordinates[1])
			if(distance < threshold)
			{
				event.distance = distance
				event_to_show.push(event)
			}
		}
		callback(event_to_show)
	});
}

function getDistanceFromLatLonInKm(lat1,lon1,lat2,lon2) {
  var R = 6371; // Radius of the earth in km
  var dLat = deg2rad(lat2-lat1);  // deg2rad below
  var dLon = deg2rad(lon2-lon1); 
  var a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  var d = R * c; // Distance in km
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI/180)
}

app.listen(8080, () => console.log("service is running"))