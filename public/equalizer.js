


let selectedKnob = null;
let mouseDownY = 0;
let preMuteVolume;
let maxPeak=-1000;
let peakThreshold;
let peakArray = [];

async function EQPageOnload() {        
    
    let connectionResult = await connectToDsp();
    if (!connectionResult[0]) {
        displayMessage("Error connecting to server. Please configure server settings and make sure CamillaDSP service is running.",{"type":"error"})
        return;
    }

    await updateConfigList();

    // If no config is uploaded but volume control is enabled, add a volume filter set to -40
    if (autoDownload) downloadConfigFromDSP().then((DSPConfig)=>{       
        
    //     if (Object.keys(DSPConfig.filters).length==0 && showVolumeControl) {
    //         let filterArray = new Array()
    //         let filter = new Object();            
    //         filter["Volume"] = {
    //             "parameters":{
    //                 "gain":"-40"
    //             }
    //         }
    //         filterArray.push(filter);                                               
    //         uploadConfigToDSP(filterArray);
            
    //     }  else {
             let filters = DSPConfig.filters;
             applyFilters(filters);     
             //console.log(filters)

             fetch('/getConfigName').then((res)=>res.text().then(data=>{
                let config =JSON.parse(JSON.parse(data));
                //console.log(config)
                document.getElementById("configName").value=config.configName;
                document.getElementById("configShortcut").value=config.configShortcut;        
            }))
    })
    // }) 

    let levelMaxWidth=document.getElementById('levelBorder').getBoundingClientRect().width
    
    setInterval (function(){sendDSPMessage("GetPlaybackSignalRms").then(r=>{
            if (r==undefined) return;
             let levelL=isNaN(r[0])?-100:r[0];
            let levelR=isNaN(r[1])?-100:r[1];          
            
            levelL<-100?levelL=-100:a=1
            levelR<-100?levelR=-100:a=1

            levelL = 100 + levelL
            levelR = 100 + levelR            

            // console.log(levelL+' : ' + levelR);

            let multiplier = levelMaxWidth>=500?4:2

            document.getElementById('levelLBar').style.width=levelMaxWidth-(multiplier*levelL)+'px';
            document.getElementById('levelRBar').style.width=levelMaxWidth-(multiplier*levelR)+'px';
        })},50)

    //git sendDSPMessage("GetCaptureRate").then(r=>console.log(r))
        
    setInterval (function(){        
        sendDSPMessage("GetPlaybackSignalPeak").then(peak=>{   
            if (document.getElementById('limit').checked) {
                let peakL = peak[0];                
                let peakR = peak[1];

                peakArray.push(peakL)                
                peakArray.push(peakR)

                if (peakArray.length<20 *3) return;                

                while (peakArray.length>(20 * 3)) { peakArray.shift(); }
                maxPeak =  peakArray.reduce((acc, cur) => Math.max(acc,cur),-1000);                
                if (peakThreshold===undefined) {
                    peakThreshold=maxPeak+1;
                    document.getElementById('limit').nextSibling.innerText='Limit ('+parseInt(peakThreshold)+'db)';                
                }
                console.log(peakThreshold,maxPeak);                
                
               if (Math.max(peakL,peakR)>peakThreshold) {                    
                    let currentVolume = parseInt(volumeControler.value);
                    volumeControler.value= currentVolume-1;
                    volumeControler.dispatchEvent(new Event('input'));                                    
                    console.log("Volume adjusted to "+volumeControler.value);
                }

                // if (Math.max(peakL,peakR)<peakThreshold-20) {    
                //     let currentVolume = parseInt(volumeControler.value);      
                //     volumeControler.value= currentVolume+1;
                //     volumeControler.dispatchEvent(new Event('input'));                                    
                //     console.log("Volume adjusted to "+volumeControler.value);
                // }
            }                 
            
        })}
    ,50);
    
        //// This section handles clipping detection but needs some work
        // setInterval(function(){
        //     sendDSPMessage("GetClippedSamples").then(clipCount=>{
        //         console.log(clipCount)
        //         if (clipCount>0) {
        //             console.log("Clipping detected!")                    
        //             document.getElementById('clipped').style.backgroundColor='#F00';
        //             document.getElementById('clippedMessage').innerText="Clipping detected! Please review your pre-amp setting!";
                    
        //         }
        //     })},1000)     
    
        // document.getElementById('clipped').style.display='none';
        // document.getElementById('clippedMessage').style.display='none';
    
    // Get current state of DSP
    sendDSPMessage("GetState").then(state=>{document.getElementById('state').innerText=state})     

    setInterval (function(){
        sendDSPMessage("GetState").then(state=>{            
            if (typeof state!="object") document.getElementById('state').innerText=state
        })
    },1000)      
    

    let preampGainVal = document.getElementById('preampGainVal');

    preampGainVal.addEventListener('focus',function(){        
        this.value= this.value.replace('dB','');                        
    })
    
    preampGainVal.addEventListener('focusout',function(){                  
        let text = this.value;   
        if (text.length==0) text=0;
        if (isNaN(text)) text=0;                                
        this.value=text+'dB';                                
    })


    ///// Volume Controls 
    let volumeTimerId;

    if (showVolumeControl) {

        setTimeout(()=>document.getElementById('volumeLevel').style.opacity='0',2000);
        document.getElementById('volumeControl').style.display='block';
    
        let volumeControler = document.getElementById('volumeControler');

        volumeControler.addEventListener('input',function(){
            sendDSPMessage({"SetVolume":this.value-100})
            this.dispatchEvent(new Event('change'));
        })

        volumeControler.addEventListener('change',function(){        
            clearTimeout(volumeTimerId);
            document.getElementById('volumeLevel').style.opacity='1'
            document.getElementById('volumeLevel').value=this.value;
            volumeTimerId=setTimeout(()=>document.getElementById('volumeLevel').style.opacity='0',2000);
        })

        sendDSPMessage("GetVolume").then(vol=>{
            let volume = 100+vol;
            volumeControler.value=volume;    
        })

        preMuteVolume=volumeControler.value;

        document.getElementById('mute').addEventListener('click',function(){
            let volumeControler = document.getElementById('volumeControler');
            if (this.checked) {
                preMuteVolume=volumeControler.value;
                volumeControler.value=0;
                
            } else { 
                volumeControler.value=preMuteVolume;
            }

            volumeControler.dispatchEvent(new Event('input'));
        })
        document.getElementById('limit').checked=false;
        
        document.getElementById('limit').addEventListener('click',function(){
            if (!this.checked) {                
                this.nextSibling.innerText='Limit';             
                peakThreshold=undefined;
                peakArray=[];
            }
        })

    } else {
        document.getElementById('volumeControl').style.display='none';
        sendDSPMessage({"SetVolume":0})

    }
    ////////////////////// End of Volume Controls ////////////////////


    for (i=0;i<=9;i++)  addBand();
    
    if (showLevelBars==false) document.getElementById('eqLevel').style.display='none'; else document.getElementById('eqLevel').style.display='block';
    


}

/// Helper functions

function uploadClick() {
    let filterArray= EQSlider.createFilterArray();

    //console.log(filterArray);
    let configName = document.getElementById('configName').value;
    let configShortcut = document.getElementById('configShortcut').value;
    let currentConfig = {"configName":configName,"configShortcut":configShortcut};

    uploadConfigToDSP(filterArray,currentConfig).then(displayMessage("Upload successful",{"type":"success"})).catch(err=>{displayMessage("Failed to upload EQ configuration",{"type":"error"}); console.log(err)});
    
}

async function downloadClick() {
    downloadConfigFromDSP().then((DSPConfig)=>{        
        let filters = DSPConfig.filters;
        applyFilters(filters);        
        console.log("Config download successful.");        
        displayMessage("Download successful");

        fetch('/getConfigName').then((res)=>res.text().then(data=>{
            let config =JSON.parse(JSON.parse(data));
            //console.log(config)
            document.getElementById("configName").value=config.configName;
            document.getElementById("configShortcut").value=config.configShortcut;        
        }))

    }).catch((err)=>{
        console.log("Failed to download config.")
        console.log(err)
    })
}

function exportClick() {
    let configText = EQSlider.convertConfigToText();
    downloadFile('camillaNode EQ settings',configText);
}

function applyFilters(filters) {
    i=0;     
    document.getElementById('equalizer').replaceChildren();

    //console.log(filters)
    for (const filterName of Object.keys(filters).sort()) {        

        switch (filterName) {
            case "Preamp":
                document.getElementById("preampGainVal").value=filters[filterName].parameters.gain+'dB';
                break;
            case "Volume":                
                break;
            default:        
                let sliderId=i+1;
                sliderId<10?sliderId="Filter0"+sliderId:sliderId="Filter"+sliderId;        
                let slider= document.getElementById(sliderId);

                //console.log(filterName);
                if (slider==null) { addBand(); slider= document.getElementById(sliderId); }
                slider.children['freq'].value=filters[filterName].parameters.freq+'Hz';
                slider.children['gain'].value=filters[filterName].parameters.gain+'dB';
                slider.children['qfact'].value=filters[filterName].parameters.q;            
                slider.children['filterType'].value=filters[filterName].parameters.type;            
                EQSlider.sliderUpdateVal(slider,filters[filterName].parameters.gain);            
                i++;        
        }
    }
}

///////// EQ Management functions


function flatten() {
    const sliders = document.getElementsByClassName('slider-container');
    for (i=0;i<sliders.length;i++) {
        sliders[i].children['gain'].value='0db';
        EQSlider.sliderUpdateVal(sliders[i],0);
    }
}

function reset() {
    const sliders = document.getElementsByClassName('slider-container');
    for (i=0;i<sliders.length;i++) {
        sliders[i].children['gain'].value='0db';
        sliders[i].children['qfact'].value='1.4';
        sliders[i].children['freq'].value=defaultFreqList[i % 10]+'Hz';
        sliders[i].children['filterType'].value='Peaking';
        EQSlider.sliderUpdateVal(sliders[i],0);
    }
    document.getElementById("preampGainVal").value='0db'
}

function compress() {
    const sliders = document.getElementsByClassName('slider-container');
    for (i=0;i<sliders.length;i++) {
        let gain=parseFloat(sliders[i].children['gain'].value.replace('dB',''));
        gain==0?gain=0:gain<0?gain++:gain--; 
        if (Math.abs(gain)<1) gain=0;
        sliders[i].children['gain'].value=gain+'dB';
        sliderUpdateVal(sliders[i],gain);
    }
}

function addBand() {
    
    let s = new EQSlider();
    let EQParent = document.getElementById('equalizer');
    let nextId = parseInt(EQParent.childElementCount)+1;
    if (nextId>maxBands) return;
    nextId<10?nextId="0"+nextId:a=1;
    s.id = "Filter"+ nextId;    
    EQParent.appendChild(s);
    if (autoUpload) {
        s.addEventListener('change',function(){
            console.log('DSP updated')
            uploadClick();
        })
    }
}

function removeLast() {
    let sliders = document.getElementsByClassName('slider-container');    
    if (sliders.length<=1) return;

    let lastSlider = sliders[sliders.length-1];
    lastSlider.parentElement.removeChild(lastSlider);
}

function sortByFreq() {    
    let filterArray = EQSlider.createFilterArray()    
    filterArray.sort((a,b)=>{
        return a[Object.keys(a)[0]].freq - b[Object.keys(b)[0]].freq;
    })
    //console.log(filterArray);       
    let tempfilterArray = new Array();    

    for (i=1;i<=filterArray.length-1;i++) {
        let tempFilter = new Object();
        let filterName = i<10?'Filter0'+i:'Filter'+i;
        // console.log(filterName);
        // console.log(filterArray[i-1][Object.keys(filterArray[i-1])]);        
        console.log(Object.keys(filterArray[i-1])[0]);
        switch (Object.keys(filterArray[i-1])[0]) {
            case "Preamp":
                // tempFilter["Preamp"]=filterArray[i-1][Object.keys(filterArray[i-1])]
                continue;
                break;
            case "Volume":
                // tempFilter["Volume"]=filterArray[i-1][Object.keys(filterArray[i-1])]
                continue;
                break;
            default:
                tempFilter[filterName]=filterArray[i-1][Object.keys(filterArray[i-1])]  
        }


        // console.log(tempFilter);
        tempfilterArray.push(tempFilter)
    }
    console.log(tempfilterArray)
    let filterArrayJSON = convertFilterArayToJSON(tempfilterArray);            
    applyFilters(filterArrayJSON.filters);    
}

////////// EQ Config management functions

function saveConfigClick() {    
    let configNameObject = document.getElementById('configName');
    let configName = configNameObject.value.trim();    
    if (configName.length==0) return;8
    if (configName.indexOf('/')>-1 || configName.indexOf('\\')>-1) {
        displayMessage("Invalid character in config name.",{"type":"error"})
        return;
    }

    fetch('/configExists?configName='+configName).then((res)=>res.text().then(data=>{
        if (data=='true' && !confirm('Configuration with a same name already exists. Would you like to overwrite?')) return;       

        let filterArray=EQSlider.createFilterArray();      
        let accessKey= document.getElementById("configShortcut").value
        saveConfig(({"configName":configName,"accessKey":accessKey,"filterArray":filterArray}));
        configNameObject.value='';
        updateConfigList();
    }));   
}

function deleteConfigClick() {
    let configNameObject = document.getElementById('configName');
    let configName = configNameObject.value;
    if (configName.length==0) return;

    if (!confirm("Do you want to delete the configuration '"+configName+"'?")) return;
    fetch('/deleteConfig?configName='+configName).then((res)=>updateConfigList());
    configNameObject.value='';
    updateConfigList();    
}

let hoverConfig;

async function updateConfigList() {      
    fetch('/getConfigList').then((res)=>res.json().then(data=>{
        const configList = document.getElementById('configList');
        configList.replaceChildren();

        let savedConfigList = data;
        i=1;
        for (let config of savedConfigList) {            
            const div = document.createElement('div');            
            div.classList.add('config');                        
            div.innerText=config;
            getConfigFromServer(config).then((config)=>{
               if (config.accessKey!=undefined) div.accessKey=config.accessKey; 
            })
            i++;
            
            // Load config from server when configName is clicked
            div.addEventListener('click',function () {                               
                document.getElementById('configName').value=this.innerText;
                document.getElementById('configShortcut').value=this.accessKey;
                getConfigFromServer(this.innerText).then((config)=>{                    
                    let filterArrayJSON = convertFilterArayToJSON(config.filterArray);            
                    applyFilters(filterArrayJSON.filters);
                    if (autoUpload) {
                        let filterArray= EQSlider.createFilterArray();                    
                        uploadConfigToDSP(filterArray).then(displayMessage("Upload successful",{"type":"success"}));
                    }
                });                
            });            
            configList.appendChild(div);
        }
    }))    

}


////////// Generic helper functions

function displayMessage(message,options) {


    if (options==undefined) options={};

    if (options.timeout==undefined) options.timeout=1500;
    if (options.persist==undefined) options.persist=false;
    if (options.type == undefined) options.type="default";

    let messageBox = document.getElementById('messageBox');    
    let equalizerRect = document.getElementById('equalizer').getBoundingClientRect();    
    messageBox.style.top=equalizerRect.top+equalizerRect.height/2;
    messageBox.style.top=equalizerRect.left+equalizerRect.width/2;

    
    let timeout = options.timeout    
    if (options.type=="error") {
        messageBox.style.backgroundColor='var(--error-background)';
        messageBox.style.color='var(--error-color)';
    }

    if (options.type=="success") {
        messageBox.style.backgroundColor='var(--success-background)';
        messageBox.style.color='var(--success-color)';
    }

    if (options.type=="question") {        
        for (button of options.buttons) {            
            const div = document.createElement('div');
            
            div.className=button.className;
            div.innerText=button.text;
            // div.addEventListener('click',button.clickEvent);            


            messageBox.appendChild(div);         
        }
    }
    
    messageBox.innerText=message;    
    messageBox.style.display='block';

    if (!options.persist) setTimeout(function(){messageBox.style.display='none'},timeout)
}

function downloadFile(filename, text) {
    let element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);
  
    element.style.display = 'none';
    document.body.appendChild(element);
  
    element.click();
  
    document.body.removeChild(element);
  }


///////// AutoEQ Functions

function refreshAutoEq() {
    let list = document.getElementById('headphoneList')
    list.replaceChildren();
    list.innerText="Dowloading headphone data from AutoEQ..."   

    downloadHeadphoneList().then((data)=>{
        let headphoneList = JSON.parse(data);
        let record;
        let records = Object();
        for (let headphone of headphoneList.tree ) {
            record =  {"name":headphone.path,"url": headphone.url}
            records[headphone.path]=record;
        }
        window.localStorage.setItem("headphoneRecords",JSON.stringify(records));
        loadHeadphoneList();
    })
    
}

function refreshAutoEqIEM() {
    let list = document.getElementById('headphoneList')
    list.replaceChildren();
    list.innerText="Dowloading headphone data from AutoEQ..."   

    downloadIEMList().then((data)=>{
        let headphoneList = JSON.parse(data);
        let record;
        let records = Object();
        for (let headphone of headphoneList.tree ) {
            record =  {"name":headphone.path,"url": headphone.url}
            records[headphone.path]=record;
        }
        window.localStorage.setItem("headphoneRecords",JSON.stringify(records));
        loadHeadphoneList();
    })
    
}


function loadHeadphoneList(filter) {    
    const listObject = document.getElementById('headphoneList');
    listObject.replaceChildren();
    
    let headphoneRecords = JSON.parse(window.localStorage.getItem('autoEQDB'));    

    // Filter the array if any search filter is applied
    if (filter!=undefined) headphoneRecords=headphoneRecords.filter(e=>e.deviceName.toLowerCase().match(filter));    

    // console.log(headphoneRecords)    
    let div;    

    for (let headphone of headphoneRecords) {
        div = document.createElement('div');
        div.className='config';        
        div.innerText=headphone.deviceName;
        div.setAttribute('url',headphone.url);
        div.setAttribute('repoName',headphone.repoName);
        div.setAttribute('sourceName',headphone.sourceName);

        
        div.addEventListener('dblclick',function(){
            let url = this.getAttribute('url')
            fetch(url).then((res)=>res.text().then(fileList=>{        
                let list = JSON.parse(fileList).tree;
                let paramEQUrl;
                for (i=0;i<list.length;i++) {
                    if (list[i].path.toLowerCase().search('parametriceq')>-1) {
                        paramEQUrl=list[i].url;
                        break;
                    }
                }                
                //console.log(JSON.parse(fileList).tree);
                fetch(paramEQUrl).then((res)=>res.json().then(paramEQ=>{                            
                    let paramEQText = atob(paramEQ.content);                    
                    let filterArray = parseAutoEQText(paramEQText);
                    let filterArrayJSON = convertFilterArayToJSON(filterArray);            
                    applyFilters(filterArrayJSON.filters);
                    document.getElementById('configName').value=this.innerText;
                    document.getElementById('configShortcut').value='';
                    document.getElementById('autoEQDialog').close();
                }))
            }))
        })
        listObject.appendChild(div)
    }
}

function showAutoEQClick() {
    let autoEQDialog = document.getElementById('autoEQDialog')
    autoEQDialog.showModal();    
    loadRepoList();
    loadHeadphoneList();
}


function loadRepoList() {
    let repoList = document.getElementById('autoEQRepo');
    repoList.replaceChildren();
    let o = document.createElement('option');
    o.innerText="[All]";
    repoList.appendChild(o);

    for (let source of Object.keys(AutoEQResults)) {        
        let o = document.createElement('option');
        o.innerText=source;
        o.value=source;
        repoList.appendChild(o)
    }
    
    let lastVal = window.localStorage.getItem('lastRepo');
    if (lastVal!=undefined) repoList.value=lastVal;

    repoList.addEventListener('change',function(){
        repoList.value=="[All]"?initAutoEQDB():initAutoEQDB(repoList.value);
        window.localStorage.setItem('lastRepo',repoList.value);
    })
}


function importClick() {
    let importDialogue = document.getElementById('importDialog')
    importDialogue.showModal();
 
}

async function searchAutoEq() {
    let searchText = document.getElementById('autoEQSearch').value.toLowerCase();        
    let sourceText = document.getElementById("autoEQRepo").value;

    sourceText=='[All]'?sourceText=undefined:sourceText=sourceText;    
    loadHeadphoneList(searchText);    
}

function autoEQSearchKeyDown() {
    if (event.keyCode==13) searchAutoEq()
}

function importFromText() {
    let importText = document.getElementById('importText').innerText;    
    let filterArray = parseAutoEQText(importText);
    console.log(filterArray)
    if (filterArray===false) {
        displayMessage("Invalid configuration format.")
        return;
    };

    let filterArrayJSON = convertFilterArayToJSON(filterArray);            
    applyFilters(filterArrayJSON.filters);
    document.getElementById('importDialog').close()
    
}


// EQ Slider class 
class EQSlider {    
    mousePos;
    selectedGain; 
    constructor() {
        let sliderContainer = document.createElement('div');
        let sliderBody = document.createElement('div');
        let sliderKnob = document.createElement('div');

        sliderContainer.className='slider-container';
        sliderBody.className='slider-body';
        sliderKnob.className='slider-knob';
        
        let freq = document.createElement('input');
        freq.type='text';
        freq.className='eqparam';
        freq.value='1000hz'
        freq.id='freq';


        let tempFreq;

        freq.addEventListener('click',function(){
            tempFreq=this.value;
            this.value= this.value.replace('Hz','');
        })

        freq.addEventListener('focus',function(){
            tempFreq=this.value;
            this.value= this.value.replace('Hz','');                        
        })
        
        freq.addEventListener('focusout',function(){            
            let text = this.value;               
            if (isNaN(text) || text<0) text=tempFreq;                        
            this.value=text+'Hz';                   
            dispatchEvent(new Event('change'));     
        })

        let gain = document.createElement('input');
        gain.type='text';
        gain.className='eqparam';
        gain.value='0db'
        gain.id='gain';

        let tempGain;

        gain.addEventListener('click',function(){
            tempGain=this.value;
            this.value= this.value.replace('dB','');            
        })

        gain.addEventListener('focus',function(){
            tempGain=this.value;
            this.value= this.value.replace('dB','');                        
        })
        
        gain.addEventListener('focusout',function(){            
            let text = this.value;               
            if (isNaN(text)) text=tempGain;
            this.value=text+'dB';            
            EQSlider.sliderUpdateVal(sliderContainer,text);
            dispatchEvent(new Event('change'));
        })

        let qfact = document.createElement('input');
        qfact.type='text';
        qfact.className='eqparam';
        qfact.value='1.41';
        qfact.id='qfact';


        let tempQfact;
        
        qfact.addEventListener('focus',function(){         
            tempQfact=this.value;
        })

        qfact.addEventListener('focusout',function(){            
            let text = this.value;               
            if (isNaN(text) || text<=0) text=tempQfact;
            this.value=text;       
            dispatchEvent(new Event('change'));              
       })


       let filterType = document.createElement('select');       
       filterType.className='eqparam';
       filterType.value='Peaking';
       filterType.id='filterType';
       
       let PK = document.createElement('option');
       PK.value="Peaking"; 
       PK.innerText="PK"
       filterType.appendChild(PK)

       let LS = document.createElement('option');
       LS.value="Lowshelf";
       LS.innerText="LS"
       filterType.appendChild(LS)

       let HS = document.createElement('option');
       HS.value="Highshelf";
       HS.innerText="HS"
       filterType.appendChild(HS)

       filterType.addEventListener('change',function(){
            dispatchEvent(new Event('change'));
       })
    
       const sliderTop = parseInt(sliderBody.getBoundingClientRect().top);
       const sliderHeight = sliderBody.getBoundingClientRect().bottom - sliderTop;
       const sliderKnobHeight = sliderKnob.getBoundingClientRect().bottom - sliderKnob.getBoundingClientRect().top;
       const sliderMax = sliderHeight-sliderKnobHeight/2;
       
       sliderKnob.style.top=(sliderMax)/2+'px';
       
       let selected=false;

       sliderKnob.addEventListener('mousedown',function() {
           selected=true;
       })

       sliderKnob.addEventListener('mouseup',function() {
           selected=false;           
           dispatchEvent(new Event('change'));
       })


       sliderContainer.addEventListener('mouseup',function() {
           selected=false;
           dispatchEvent(new Event('change'));
       })
       
       sliderContainer.addEventListener('mousemove',function(event) {
            if (selected==false) return;          
            const pos = event.clientY-sliderBody.getBoundingClientRect().top;
            const sliderMax= sliderBody.clientHeight-sliderKnob.clientHeight;
            const yPos = Math.max(0,Math.min(pos,sliderBody.clientHeight-sliderKnob.clientHeight));
            sliderKnob.style.top = yPos+'px';            

            const num = MaxDB-(MaxDB*2*yPos/sliderMax);
            sliderContainer.value = Math.round((num + Number.EPSILON)*10)/10;            
            gain.value = sliderContainer.value+'dB';            

            let hueAngle = parseInt((sliderMax/2-yPos) * (sliderMax/360));    
            if (hueRotate) sliderBody.style.filter='hue-rotate('+hueAngle+'deg)';
       })

       sliderContainer.addEventListener('wheel',function(e) {
            let dif = e.deltaY<0?0.1:-0.1;            
            let val=parseInt(10*(parseFloat(gain.value.replace('dB',''))+dif))/10;
            gain.value=val+'dB';
            e.preventDefault();
            EQSlider.sliderUpdateVal(sliderContainer,val);
       })          

       sliderBody.appendChild(sliderKnob);
       sliderContainer.appendChild(sliderBody);
       sliderContainer.appendChild(freq)
       sliderContainer.appendChild(gain)
       sliderContainer.appendChild(qfact)
       sliderContainer.appendChild(filterType)

       let sh = getComputedStyle(document.body).getPropertyValue('--slider-height').replace('rem','');
       sh *= getComputedStyle(document.body).fontSize.replace('px','')/2
       sliderKnob.style.top=sh+'px';       
       
       return sliderContainer;
    }

    static sliderUpdateVal(slider,val) {
        const sliderKnobHeight = document.getElementsByClassName('slider-container')[0].children[0].children[0].getBoundingClientRect().height;        
        const sliderMax = document.getElementsByClassName('slider-container')[0].getBoundingClientRect().height-sliderKnobHeight/2;
    
        const sliderKnob = slider.children[0].children[0];            
        const yPos = ((parseFloat(-val)+MaxDB)/(2*MaxDB))*sliderMax;
        
        sliderKnob.style.top=yPos+'px';
        
        let hueAngle = parseInt((sliderMax/2-yPos) * (sliderMax/360));    
        if (hueRotate) sliderKnob.parentElement.style.filter='hue-rotate('+hueAngle+'deg)';
    
        // console.log('Val : '+val)            
        // console.log('sliderMax : '+sliderMax)       
        // console.log("Move to : " + yPos);
        // console.log(sliderKnob)
        //slider.dispatchEvent(new Event('change'));    
    }

    static createFilterArray() {
        let filterArray=new Array();
        const sliders = document.getElementsByClassName('slider-container')       
        for (i=0;i<sliders.length;i++) {                
            let sliderId=i+1;
            sliderId<10?sliderId="Filter0"+sliderId:sliderId="Filter"+sliderId;        
            let slider= document.getElementById(sliderId);
    
            // console.log(sliderId);
            // console.log(slider);
            let filter = new Object();
            filter[sliderId] = {
                "type"  : slider.children['filterType'].value,
                "freq"  : parseFloat(slider.children['freq'].value.replace('Hz','')),
                "gain"  : parseFloat(slider.children['gain'].value.replace('dB','')),
                "q"     : parseFloat(slider.children['qfact'].value)
            }
            filterArray.push(filter);
        }
    
        // Pre-amp filter
        preampGainVal=document.getElementById("preampGainVal").value.replace('dB','');
        let filter = new Object();
        filter["Preamp"] = {        
            "gain"  : parseFloat(preampGainVal),        
        }
        filterArray.push(filter);
    
        filter = new Object();
        // Volume filter
        filter["Volume"] = {         
            "type":"Volume",           
            "parameters":{}                
        }
        filterArray.push(filter);
    
        // console.log(filterArray)
        return filterArray;
    }

    static convertConfigToText() {
        let preampGain = document.getElementById('preampGainVal').value;
        let configText=`Preamp: ${preampGain} dB\n`
        let sliders = document.getElementsByClassName('slider-container');
        for (let filterNo=0;filterNo<sliders.length;filterNo++) {
            let filterTypeText = sliders[filterNo].children['filterType'].value;            
            let filterType ='PK';
            
            if (filterTypeText=='Highshelf') filterType='HSC';
            if (filterTypeText=='Lowshelf') filterType='LSC';
            
            let freq = sliders[filterNo].children['freq'].value.toLowerCase().replace('hz','');
            let gain = sliders[filterNo].children['gain'].value.replace('dB','');
            let qfact = sliders[filterNo].children['qfact'].value;

            configText+=`Filter ${filterNo+1}: ON ${filterType} Fc ${freq} Hz Gain ${gain} dB Q ${qfact}\n`;
        }
        
        
        //console.log(configText);
        return(configText);
        
    }
}


