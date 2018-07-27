
var request = require('request')
 
var date = require('date-and-time');

//Define query
//add new sources here
var INSTRUCTION =
{
    'http://www.emergency.wa.gov.au/data/incident_FCAD.json':
    {
        global:{
             instances : '$$data->features'
        },
        instance: {
            name: '$$instances[]->properties->type',
            lastupdate: '$$instances[]->properties->lastUpdatedTime',
            status: '$$instances[]->properties->status',
            coordinates: '$$instances[]->geometry->coordinates'
        },
        dateformat: 'YYYY-MM-DD hh:mm:ss'
    },
    'http://www.pfes.nt.gov.au/incidentmap/json/ntfrsincidents.json':
    {
        global:{
            instances: '$$data->incidents',
            title: '$$data->title'
        },
        instance: {
            name: '$$instances[]->eventtype',
            lastupdate: '$$instances[]->properties->Last Update',
            status: '$$instances[]->status',
            coordinates: '$$instances[]->coordinate'
        },
        dateformat: 'DD/MM/YYYY hh:mm'
    },
    'https://www.emergency.wa.gov.au/data/message_warnings.json':
    {

        global:{
            instances: '$$data->features'
        },
        instance: {
            name: '$$instances[]->properties->type',
            lastupdate: '$$instances[]->properties->lastUpdatedTime',
            status: '$$instances[]->properties->status',
            coordinates: '$$instances[]->geometry->coordinates'
        },
        dateformat: 'DD/MM/YY hh:mm:ss A'
    }
 
}
 
 
class DataInterpreter
{
 
    constructor(sources)
    {
        if(!Array.isArray(sources))
            throw "argument sources has to be an array"
        this.sources = sources
        this.extractData = this.extractData.bind(this)
        this.tokenParser = this.tokenParser.bind(this)
        this.parseData = this.parseData.bind(this)
    }
 
    extractData(callback)
    {
      
        var returnData = []
        var count = 0;
        for(var c in this.sources)
        {
            try
            {
                this.parseData(this.sources[c],
                    (data) =>
                    {
                        count+=1
                        returnData = returnData.concat(data)
                        if(count == this.sources.length)
                        {
                            callback(returnData);
                        }
                    })

            } catch(error){
                count +=1
                if(count == this.sources.length)
                {  
                    console.log(count)
                    callback(returnData)
                }
            }
        }
    }


    //parse data from source link
    parseData(source_link,callback)
    {
        var returnData = []
        var instruction = INSTRUCTION[source_link]
        if(instruction != undefined){
            request.get({url:source_link},
                        (err, response, body) =>    {
                            if(err)
                            {
                                callback([]);
                            } 
                            else 
                            {
                                var processData = {
                                    data : null,
                                    instances: []
                                }
                                try
                                {
                                    processData.data = JSON.parse(body);

                                    //passing data for global source_key
                                    for(var source_key in instruction.global)
                                    {
                                        var split_instruction = instruction.global[source_key].split('->')
                                        //parse instances
                                        if(split_instruction[0] == '$$data') //start source
                                        {
                                            processData[source_key] = this.tokenParser(processData.data, split_instruction)
                                        } 
                                        else
                                        {
                                            throw "Invalid syntax"
                                        }
                                    }
                     
                                    //get data for each instance
                                    if(processData.instances.length > 0)
                                    {
                                        for(var i in processData.instances)
                                        {
                                            var instance_data = {}
                                            for(var key in instruction.instance)
                                            {
                                                if(instruction.instance[key] != null){
                                                    var split_instruction = instruction.instance[key].split('->')
                                                    //getting data from primary high level scopes
                                                    if(split_instruction[0].includes("$$"))
                                                    {
                                                        var data_source = null
                                                        if(split_instruction[0] == '$$data')
                                                            data_source = data
                                                        else{
                                                            var source_key = split_instruction[0].replace("$$","")
                                                            var is_dynamic = split_instruction[0].includes("[]")
                                                            if(is_dynamic)
                                                                source_key = source_key.replace("[]","")

                                                            if(processData[source_key] == undefined)
                                                                throw 'Invalid syntax! Please recheck your query'
                                                            data_source = is_dynamic ? processData[source_key][i] : processData[source_key]
                                                            instance_data[key] = this.tokenParser(data_source, split_instruction)
                                                        }
                                                    }
                                                    else
                                                    {
                                                        throw "Invalid syntax"
                                                    }
                                                }
                                            }

                                            //generalize coords
                                            if(typeof(instance_data.coordinates) == 'string'){
                                                instance_data.coordinates = [parseFloat(instance_data.coordinates.split(', ')[0]), 
                                                                            parseFloat(instance_data.coordinates.split(', ')[1])]
                                            }
                                        
                                        
                                            //generalize datetime
                                            try
                                            {  
                                                instance_data.lastupdate = instance_data.lastupdate.replace("AM","a.m.")
                                                instance_data.lastupdate = instance_data.lastupdate.replace("PM","p.m.")
                                                instance_data.timestamp = date.parse(instance_data.lastupdate, instruction.dateformat).getTime()
                                            } catch (err)
                                            {

                                            }
                                            returnData.push(instance_data)
                                        }
                                    }

                                    callback(returnData)
                                } 
                                catch(error)
                                {
                                    console.log(error)
                                    callback([])
                                }
                            }
            });
        } 
        else
            callback([])
    }
 
    tokenParser(data_source, split_instruction)
    {
        var temp = data_source
        for(var i = 1; i < split_instruction.length; i++)
        {
            temp = temp[split_instruction[i]];
        }
        return temp;
 
    }
}
 
// var test = new DataInterpreter(['http://www.emergency.wa.gov.au/data/incident_FCAD.json','http://www.pfes.nt.gov.au/incidentmap/json/ntfrsincidents.json','https://www.emergency.wa.gov.au/data/message_warnings.json'])
// test.extractData((data) => {
//         console.log(data)
//     });
module.exports = DataInterpreter