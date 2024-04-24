

class camillaDSP {
    ws;    
    server;
    port;
    config;

    constructor() { 
        return this;        
    }

    async connect(server,port) {
        if (server==undefined) {
            server = window.localStorage.getItem("server");
            port = window.localStorage.getItem("port");
        }

        return await this.connectToDsp(server,port).then((r)=>{ 
            this.ws = r[1];                                    
            this.server=server;
            this.port=port;
            return true;
        }).catch((e)=>{
            console.error("Connection error");
            console.error(e);            
            return false;
        });        
    }

    async connectToDsp(server,port) {
        if (server==undefined) {
            let serverConfig = getDefaultServerConfig();
            server=serverConfig.serverIp;
            port=serverConfig.port;        
        }    
        let WS = new WebSocket("ws://"+server+":"+port);
        return new Promise((resolve,reject)=>{        
            WS.addEventListener('open',function(){                            
                resolve([true,WS]);
            })
            let errorListener = WS.addEventListener('error',function(m){
                WS.removeEventListener('error',errorListener);
                reject([false,m]);
            })
        })
    }

    static handleDSPMessage(m) {        
        const res = JSON.parse(m.data);                  
    
        const responseCommand = Object.keys(res)[0];
        const result = res[responseCommand].result;
        const value =  res[responseCommand].value;
    
        // console.log("Command : "+responseCommand)
        // console.log("Result : "+result)
        // console.log("Value : "+value)    
    
        switch (responseCommand) {
            case 'GetVersion':
                if (result=='Ok') return [true,value]; else return[false,value];            
                break;
            case 'GetConfigJson':
                if (result=='Ok') return [true,JSON.parse(value)]; else return[false,value];          
                break;                    
            case 'SetConfigJson':
                if (result=='Ok') return [true,value]; else return[false,value];          
                break;
            case 'GetState':
                if (result=='Ok') return [true,value]; else return[false,value];          
                break;
            case "GetPlaybackSignalPeak":
                if (result=='Ok') return [true,value]; else return[false,value];          
                break;
            case "GetPlaybackSignalRms":
                if (result=='Ok') return [true,value]; else return[false,value];           
                break;                
            case "SetUpdateInterval":
                if (result=='Ok') return [true,value]; else return[false,value];           
                break;                
            case "GetClippedSamples":
                if (result=='Ok') return [true,value]; else return[false,value];           
                break;                
            case "GetVolume":            
                if (result=='Ok') return [true,value]; else return[false,value];           
                break;         
            case "SetVolume":            
                if (result=='Ok') return [true,value]; else return[false,value];           
                break;     
            case "GetCaptureRate":            
                if (result=='Ok') return [true,value]; else return[false,value];           
                break;         
            default:
                console.log("Unhandled message received from DSP : "+responseCommand);
                if (result=='Ok') return [true,value]; else return[false,value];                        
        }
    
    }
    
    async sendDSPMessage(message) {        
        return new Promise((resolve,reject)=>{
            let eventListener = this.ws.addEventListener('message',function(m){
                const res = JSON.parse(m.data);
                const responseCommand = Object.keys(res)[0];
                if (message!=responseCommand) return;
    
                let handleResult = camillaDSP.handleDSPMessage(m);
                if (handleResult[0]) resolve(handleResult[1]); else reject(handleResult[1]);

                this.removeEventListener('message',eventListener);
            });

            this.ws.send(JSON.stringify(message));             
        })     
    }   

    static getDefaultConfig(config, override) {
        if (override==undefined) override=false;

        const mixers = {"recombine":{
            "channels":{"in":2,"out":2},
            "mapping":[
                {"dest":0,"sources":[{"channel":0,"gain":0,"inverted":false,"mute":false},{"channel":1,"gain":0,"inverted":false,"mute":true,"scale":"dB"}],"mute":false},
                {"dest":1,"sources":[{"channel":1,"gain":0,"inverted":false,"mute":false},{"channel":0,"gain":0,"inverted":false,"mute":true,"scale":"dB"}],"mute":false}
                ]
            }
        };   
        const pipeline = [{"type":"Mixer","name":"recombine"}];

        config["title"]="CamillaNode 2 Config";
        config["description"]="Config file is auto-generated by CamillaNode 2";
        if (config.mixers==null) config["mixers"]= mixers;                                
        if (config.filters==null) config["filters"]=null;
        if (config.processors==null) config["processors"]=null;
        if (config.pipeline==null) config["pipeline"]=pipeline;       

        if (override) {
            config.mixers=mixers;
            config.pipeline=pipeline;
        }

        return config;
    }

    async setBalance(bal) {
        let config = await this.sendDSPMessage("GetConfigJson");

        config.mixers.recombine.mapping[0].sources[0].gain = -bal
        config.mixers.recombine.mapping[1].sources[0].gain = bal

        await this.sendDSPMessage({'SetConfigJson':JSON.stringify(config)})
    }

    async getBalance() {
        let config = await this.sendDSPMessage("GetConfigJson");
        return config.mixers.recombine.mapping[1].sources[0].gain;
    }

    async setTone(subBass, bass, mids, upperMids, treble) {
        let config = await this.sendDSPMessage("GetConfigJson");

        const subBassFilter = camillaDSP.createPeakFilterJSON(40,subBass,1.41);
        const bassFilter = camillaDSP.createPeakFilterJSON(100,bass,1.41);
        const midsFilter = camillaDSP.createPeakFilterJSON(600,mids,1.41);
        const upperMidsFilter = camillaDSP.createPeakFilterJSON(3000,upperMids,1.41);
        const trebleFilter = camillaDSP.createPeakFilterJSON(10000,treble,1.41);

        config.filters={};
        config.filters["subBass"]=subBassFilter;
        config.filters["bass"]=bassFilter;
        config.filters["mids"]=midsFilter;
        config.filters["upperMids"]=upperMidsFilter;
        config.filters["treble"]=trebleFilter;
        
        config.pipeline=[{"type":"Mixer","name":"recombine"}];
        config.pipeline.push({"type":"Filter","channel":0,"names":["subBass","bass","mids","upperMids","treble"]})
        config.pipeline.push({"type":"Filter","channel":1,"names":["subBass","bass","mids","upperMids","treble"]})
        
        return this.sendDSPMessage({'SetConfigJson':JSON.stringify(config)}).then(r=>console.log(r)).catch(e=>console.error(e));
    }

    async setCrossfeed(crossfeedVal) {
        let config = await this.sendDSPMessage("GetConfigJson");

        if (crossfeedVal<=-16.5) {
            config.mixers.recombine.mapping[0].sources[1].mute = true;   
            config.mixers.recombine.mapping[1].sources[1].mute = true;
        } else {
            config.mixers.recombine.mapping[0].sources[1].mute = false;   
            config.mixers.recombine.mapping[1].sources[1].mute = false;

            config.mixers.recombine.mapping[0].sources[1].gain = crossfeedVal;   
            config.mixers.recombine.mapping[1].sources[1].gain = crossfeedVal;
        }

        // console.log(config.mixers.recombine.mapping)

        return this.sendDSPMessage({'SetConfigJson':JSON.stringify(config)})
    }

    async getCrossfeed() {
        let config = await this.sendDSPMessage("GetConfigJson");
        if (config.mixers.recombine.mapping[0].sources[1].mute == true) return -16.5; else return config.mixers.recombine.mapping[0].sources[1].gain;
    }
    
    static createPeakFilterJSON(freq,gain,q) {         
        return {"type":"Biquad","parameters":{"type":"Peaking","freq":freq,"gain":gain,"q":q}};                
    }        
    
    updatePipeline(config) {
        let pipeline=[];        
        pipeline.push({"type":"Mixer","name":Object.keys(config.mixers)[0]});
        pipeline.push({"type":"Filter","channel":0,"names":Object.keys(config.filters)})
        pipeline.push({"type":"Filter","channel":1,"names":Object.keys(config.filters)})
        return pipeline;
    }




}

export default camillaDSP;
