
class preferences {
    defaultSettings;

    
    preferenceObject;
    

    constructor() {
        this.loadSettings();
        return this;    
    }

    getDefaults() {
        let tmpPref =  new Object();
        tmpPref["sections"] = {"general":"Generel Preferences","ui":"User Interface Preferences","basic":"Basic Section Preferences","equalizer":"Equalizer Section Preferences"}
        tmpPref["general"] = [
            {"id":"DCProtection",
            "name":"Enable DC Protection",        
            "value":true,
            "type":"boolean",
            "enabled":true,
            },

            {"id":"enableSpectrum",
            "name":"Enable Spectrum Analyzer",        
            "value":true,
            "type":"boolean",
            "enabled":true,
            },       
        ]

        tmpPref["ui"] = [
            {"id":"defaultPage",            
            "name":"Default page on load",            
            "value":"Equalizer",
            "type":"select",
            "options":{"Connections":"connections","Basic":"basic","Equalizer":"equalizer","Advanced":"advanced","Room EQ":"room"},            
            "enabled":true,
            },

            {"id":"backgroundHue",
            "name":"Backround hue",
            "value":140,
            "type":"range",        
            "options":{"min":0,"max":330,"step":1},
            "enabled":true,
            "callback":"backgroundHueChange",                                
            },        
        ]

        tmpPref["basic"] = [
            
            {"id":"showBasicSpectrum",
            "name":"Show spectrum analyzer in Basic section",
            "value":false,
            "type":"boolean",                
            "dependsOn":"enableSpectrum",
            "enabled":false,
            },        
        ]

        tmpPref["equalizer"] = [
            {"id":"showBasicSpectrum",
            "name":"Show spectrum analyzer in Basic section",
            "value":false,
            "type":"boolean",            
            "dependsOn":"enableSpectrum",    
            "enabled":false,
            },        
        ]  
        return tmpPref;
    }


    createPreferencesElements(parentElement) {
        let sectionElement, subElement, subTitleElement, optionElement;
        for (let section of Object.keys(this.preferenceObject.sections)) {
            sectionElement=document.createElement("div");
            sectionElement.setAttribute("id",section);
            sectionElement.setAttribute("label",this.preferenceObject.sections[section]);
            sectionElement.className="preferenceSection";
            for (let item of this.preferenceObject[section]) {
                // console.log(section,item);
                subTitleElement = document.createElement("div");
                subTitleElement.innerText=item.name;
                sectionElement.appendChild(subTitleElement);
                
                switch (item.type) {
                    case "boolean":
                        subElement = document.createElement("input");
                        subElement.setAttribute("type","checkbox")
                        subElement.checked = item.value;
                        break;
                    case "select":
                        subElement = document.createElement("select");
                        for (let option of Object.keys(item.options)) {
                            optionElement = document.createElement("option");
                            optionElement.innerText=option;
                            optionElement.setAttribute("value",item.options[option]);
                            subElement.appendChild(optionElement);
                        }
                        break;
                    case "text":
                        subElement = document.createElement("input");
                        subElement.setAttribute("type","text")
                        subElement.value=item.value;
                        break;
                    case "range":
                        subElement = document.createElement("input");
                        subElement.setAttribute("type","range")
                        subElement.setAttribute("min",item.options.min);
                        subElement.setAttribute("max",item.options.max);
                        subElement.setAttribute("step",item.options.step);
                        subElement.setAttribute("value",item.value);
                        break;
                }

                subElement.disabled=!item.enabled;                
                subElement.setAttribute("id",item.id);                

                // Process dependency 
                if (item.dependsOn!=undefined) {
                    document.getElementById(item.dependsOn).addEventListener("change",function(){
                        const targetElement = document.getElementById(item.id);
                        if (this.checked==false) targetElement.checked=false;
                        targetElement.disabled = !this.checked;
                    })
                    subElement.disabled = !document.getElementById(item.dependsOn).checked;
                }

                // Process special callback event
                if (item.callback!=undefined) subElement.addEventListener("callback",window[item.callback]);                                       
                
                subElement.preferences=this;
                subElement.section=section;
                subElement.addEventListener("change",function(){
                    // console.log("Event default.",item);
                    let value;
                    if (this.type=="checkbox") value=this.checked; else value=this.value;
                    this.preferences.applySetting(section,this.id,value)                     
                    this.preferences.saveSettings();
                    this.dispatchEvent(new Event("callback"));
                });
                sectionElement.appendChild(subElement);
            }

            parentElement.appendChild(sectionElement);
        }
        return true;
    }

    applySetting(section,setting,value) {       
        console.log("Apply Setting",section,setting,value)
        this.preferenceObject[section].filter((e)=>e.id==setting)[0].value = value;
        console.log(this.preferenceObject[section])
    }
    
    getSettingValue(section,setting) {
        return this.preferenceObject[section].filter((e)=>e.id==setting)[0].value;
    }

    loadSettings() {
        this.preferenceObject = window.localStorage.getItem("preferences");
        if (this.preferenceObject==undefined || this.preferenceObject==null) this.preferenceObject=this.getDefaults(); else this.preferenceObject=JSON.parse(this.preferenceObject);
        // console.log(this.preferenceObject);
    }

    saveSettings() {
        window.localStorage.setItem("preferences",JSON.stringify(this.preferenceObject))
        return true;
    }

    setSettingValue(setting,value) {
        
    }


    applyBackgroundHue(document,hue) {
        document.documentElement.style.setProperty('--bck-hue',parseInt(hue));
        document.documentElement.style.setProperty('--hue-rotate',parseInt(hue)-230+"deg");                        
    }

}


export default preferences;