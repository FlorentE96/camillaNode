
document.loading=false;        
        
// Run equalizerOnLoad function after DSP is connected.
let interval;
interval = setInterval(function(){            
    // console.log(window.parent.DSP);
    if (window.parent.DSP!=undefined) {                
        equalizerOnLoad();
        clearInterval(interval);
    }
},50);


async function equalizerOnLoad() {            
    document.loading=true;
    const PEQ = document.getElementById('PEQ');            
    
    DSP=window.parent.DSP;    
    
    /// Basics Controls Section
    const basicControls = document.getElementById('basicControls');

    // Create UI elements
    let vol = new EQKnob("Volume",31);        
    let balance = new EQKnob("Balance",181);
    let crossfeed = new EQKnob("Crossfeed",31);
    let preamp = new EQKnob("Pre-amp",181);

    crossfeed.knob.instance.offAtDefault=true;
    balance.knob.instance.offAtDefault=true;
    preamp.knob.instance.offAtDefault=true;
    
    basicControls.appendChild(vol.knob);        
    basicControls.appendChild(balance.knob)
    basicControls.appendChild(crossfeed.knob)
    basicControls.appendChild(preamp.knob)

    window.vol=vol;
    window.balance=balance;
    window.crossfeed=crossfeed;
    window.preamp=preamp;

    // Load data from DSP
    DSP.sendDSPMessage("GetVolume").then(r=>{            
        let volMarker = r/3*10 + 181;
        vol.setVal(volMarker);            
    });

    // load crossfeed
    let crossfeedVal = await DSP.getCrossfeed() * 20 +331;        
    crossfeed.knob.instance.setVal(crossfeedVal);
    
    // load balance
    let bal = await DSP.getBalance() * 10 +181;
    balance.knob.instance.setVal(bal)

    vol.knob.addEventListener("change",function(e){
        const volume = (this.instance.getVal() -181)/10*3; // 3db change per every tick            
        DSP.sendDSPMessage({"SetVolume":volume})
    })

    balance.knob.addEventListener("change",function(e){
        const bal = (this.instance.getVal() -181)/10*1; // 1db change per every tick            
        DSP.setBalance(bal);
    })

    crossfeed.knob.addEventListener("change",function(e){
        let crossfeedVal = (this.instance.getVal()-331)/20;
        // console.log(crossfeedVal)
        DSP.setCrossfeed(crossfeedVal);
    })

    preamp.knob.addEventListener("change",function(e){
        const preampGain = (this.instance.getVal() -181)/10*1; // 1db change per every tick       
        // console.log(preampGain);
        setPreamp(preampGain);                 
    })


    /// Parametric EQ section
    loadFiltersFromConfig()

    const canvas = document.getElementById("plotCanvas");            
    let max = plot(DSP.config.filters,canvas,DSP.config.title);                         

    // change loading to false after 100ms to avoud update running multiple times during loading.            
    setInterval(function(){document.loading=false},50);            

    initSpectrum();    
}

async function setPreamp(gain) {
    let config = await DSP.sendDSPMessage("GetConfigJson");
    if (config.filters.Gain == undefined) {
        config.filters.Gain = {"type":"Gain","parameters":{"gain":0,"inverted":false,"scale":"dB"}}
    }  
    config.filters.Gain.parameters.gain=gain;                
    config.pipeline=DSP.updatePipeline(config);
    await DSP.updateConfig(config);
}

function loadFiltersFromConfig() {                        
    PEQ.innerHTML='';
    let config= DSP.config;            
    
    
    let line;
    if (config.filters!=null) {
        for (let filterName of Object.keys(config.filters)) {                               
            // console.log("LoadingFromConfig",config.filters[filterName].type=="Gain")
            switch (config.filters[filterName].type) {
                case "Gain" :
                    let preampGain = config.filters.Gain.parameters.gain; 
                    preamp.knob.instance.setVal(preampGain* 10 +181);                        
                    setPreamp(preampGain);
                    break;
                case "Biquad" :                    
                    let filterType= config.filters[filterName].parameters.type;                    
                    if (filterType=="Peaking" || filterType=="Highshelf" || filterType=="Lowshelf") {
                        line = addLine(PEQ,filterName);                    
                        line.instance.JSONtoValues(config.filters[filterName]);                        
                    }
            }
        }            
        // sortByFreq(PEQ);        
        // console.log("Max Level ",max)            
    }
    

    document.loading=false;
}

function addLine(parent,filterName,insertBefore) {
    let line = PEQline.addPEQLine(parent,insertBefore);            
    line.setAttribute("filterName",filterName);            
    line.addEventListener("update",peqlineUpdate);            
    line.addEventListener("remove",function(){peqlineRemove(this)});     
    line.addEventListener("add",function(){peqlineAdd(this)});  
    return line;   
}

function sortAll() {
    const PEQs=document.getElementsByClassName("PEQ");                        
    for (let PEQ of PEQs) {
        sortByFreq(PEQ);
    }
}

function sortByFreq(parent) {    

    let elementArray=[];
    parent.childNodes.forEach(element => {                
        if (element.className=="peqline") {                    
            elementArray.push(element);                        
        }
        //parent.removeChild(element)
    });

    function compareLines(a,b) {    
        return parseInt(a.instance.getParams().freq) - parseInt(b.instance.getParams().freq);                
    }

    elementArray.sort(compareLines);            
    for (let element of elementArray) {                
        parent.appendChild(element);
    }            
}

async function peqlineUpdate() {                        
    if (document.loading) return;
    const ctx = document.getElementById("plotCanvas")
    let filters = generateFiltersObject();
    // console.log(filters)

    
    let config = await DSP.sendDSPMessage("GetConfigJson");
    config.filters=filters;       

    plot(filters,ctx,config.title);              
    
    config.pipeline= DSP.updatePipeline(config);                 
    await DSP.updateConfig(config);
    // console.log("peqlineupdate")            
}

function generateFiltersObject() {
    let filters={};
    const PEQ = document.getElementById('PEQ');
    PEQ.childNodes.forEach(e=>{
        if (e.className=="peqline") {                                   
            filters[e.getAttribute("filterName")] = e.instance.valuesToJSON();
        }
    })
    // If there is a preamp setting, create the preamp filter
    preampGain=(preamp.knob.instance.getVal()-181)/10;
    if (preampGain!=0) {
        filters.Gain = {"type":"Gain","parameters":{"gain":preampGain,"inverted":false,"scale":"dB"}}
    }
    return filters;
}

function peqlineRemove(peqline) {            
    if (document.loading) return;
    const PEQ = document.getElementById('PEQ');
    PEQ.removeChild(peqline);
    peqline=null;
    peqlineUpdate();
}

function peqlineAdd(peqline) {
    const PEQ = document.getElementById('PEQ');
    addLine(PEQ,"NewFilter"+PEQ.children.length+1,peqline)
}

async function clearPEQ() {
    document.getElementById('PEQ').innerHTML='';
    await peqlineUpdate();
    console.log("PEQ Cleared.");
}

const  freq = ['25', '30', '40', '50', '63', '80', '100', '125', '160', '200', '250',
'315', '400', '500', '630', '800', '1K', '1.2K', '1.6K', '2K', '2.5K',
'3.1K', '4K', '5K', '6.3K', '8K', '10K', '12K', '16K', '20K']

async function initSpectrum(){          
    // Create bars and boxes
    const spec = document.getElementById("spectrum");   
    const barCount=freq.length-1;
    let bar,box;
    spec.innerHTML='';
    for (i=0;i<=barCount;i++){
        bar = document.createElement("div");
        bar.className='levelbar';
        // bar.classList.add(bar % 2==0)?'left':'right';
        bar.setAttribute('freq',freq[i]);        
        let hue=parseInt(window.document.documentElement.style.getPropertyValue('--bck-hue'));
        for (j=1;j<40;j++) {
            box = document.createElement('div');
            box.className='levelbox';                    
            box.style="background-color: hsl("+hue+", 30%, 50%);"        
            hue=hue-10;
            bar.appendChild(box);
        }

        spec.appendChild(bar);
    }

    // Get the data and update the analyser
    
    setInterval(async function(){
        const spec = document.getElementById("spectrum");
        let r = await DSP.getSpectrumData();                
        
        let i=0, height, boxCount, count;
        spec.childNodes.forEach(e=>{
            if (e.tagName=="DIV") {                         
                height = 200 + (2*Math.round(r[i]));  
                if (height<0) height=0;
                if (height>200) height=0;     
                boxCount= Math.round(height/8)-1;                                
                count=0;
                e.childNodes.forEach(e=>{
                    if (e.tagName=="DIV") {
                        if (count>boxCount) e.style.opacity=0; else e.style.opacity=1;
                        count++
                    }
                })
                i=i+2;
            }                     
        })       
                

    },100)
}
