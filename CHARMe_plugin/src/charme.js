if (!charme)
	var charme = {};

charme.plugin = {};
charme.authToken = null;

charme.plugin.constants = function(){
		this.REMOTE_BASE_URL		= '@@triplestore.url@@';
		this.XPATH_BASE				= '//atm:feed';
		this.XPATH_TOTAL_RESULTS	= this.XPATH_BASE + '/os:totalResults';
};

charme.plugin.nsResolver = function(prefix){
	var ns = {
			'atm' : 'http://www.w3.org/2005/Atom',
			'os': 'http://a9.com/-/spec/opensearch/1.1/'
	};
	return ns[prefix] || null;
};

charme.plugin.xpathQuery = function(xpath, xmlDoc, type){
	var xmlEval = xmlDoc;
	if (typeof xmlEval.evaluate === 'undefined'){
		xmlEval = document;
	}
	if (typeof xmlEval.selectNodes !== 'undefined'){
		//Internet explorer
		throw 'Not yet implemented';
	} else if (typeof xmlEval.evaluate !== 'undefined'){
		//Other browsers
		return xmlEval.evaluate(xpath, xmlDoc, charme.plugin.nsResolver, type ? type : XPathResult.ANY_TYPE, null);
	} else {
		throw 'Unsupported browser';
	}
};
charme.plugin.request = {};

charme.plugin.request.fetchForTarget=function (targetId){
	var constants = new charme.plugin.constants()
	return (constants.REMOTE_BASE_URL.match(/\/$/) ? constants.REMOTE_BASE_URL : constants.REMOTE_BASE_URL + '/') + 'search/atom?target=' + encodeURIComponent(targetId) + '&status=submitted';
};

charme.plugin.parseXML=function(xmlString){
	if (window.DOMParser){
		parser=new DOMParser();
		xmlDoc=parser.parseFromString(xmlString,"text/xml");
	}
	else{ // Internet Explorer
		xmlDoc=new ActiveXObject("Microsoft.XMLDOM");
		xmlDoc.async=false;
		xmlDoc.loadXML(xmlString);
	}
	return xmlDoc;
};

charme.plugin.ajax = function(url, successCB, errorCB){
	var oReq = new XMLHttpRequest();
	oReq.addEventListener("load", function(evt){
		if (oReq.status===200){
			try {
				var xmlDoc = oReq.responseXML;
				if (!xmlDoc){
					xmlDoc = charme.plugin.parseXML(oReq.responseText);
				}
				successCB.call(oReq, xmlDoc);
			} catch (err){
				errorCB.call(oReq);
			}
		}
	}, false);
	oReq.addEventListener("error", function(){errorCB.call(oReq);}, false);
	oReq.open('GET', url, true);
	oReq.setRequestHeader('Accept', "application/atom+xml,application/xml");
	//oReq.setRequestHeader('Authorization', ' Bearer ' + charme.authToken);
	oReq.send();
};

charme.plugin.getAnnotationCountForTarget = function(el, activeImgSrc, inactiveImgSrc){
	
	charme.plugin.ajax(charme.plugin.request.fetchForTarget(el.href),
		function(xmlDoc){
			// Success callback
			var constants = new charme.plugin.constants();
			var annoCount = charme.plugin.xpathQuery(constants.XPATH_TOTAL_RESULTS, xmlDoc, XPathResult.NUMBER_TYPE).numberValue;
			if (annoCount > 0){
				el.title='CHARMe annotations exist.';
				el.style.background = 'url("' + activeImgSrc + '") no-repeat left top';
			} else {
				el.title='No CHARMe annotations.';
				el.style.background = 'url("' + inactiveImgSrc + '") no-repeat left top';
			}
		}, 
		function(){
			if (window.console)
				window.console.error('CHARMe Plugin - Unable to fetch annotation data');
			else
				throw 'CHARMe Plugin - Unable to fetch annotation data';
	});
};

/**
 * Cross browser class selector
 */
charme.plugin.getByClass = function(className){
	//Default to native function if it exists
	if (document.getElementsByClassName){
		return document.getElementsByClassName(className);
	} else {
		//Else, search exhaustively
        var elArray = [];
        var tmp = document.getElementsByTagName("*");
        var regex = new RegExp("(^|\\s)" + className + "(\\s|$)");
        for (var i = 0; i < tmp.length; i++) {

            if (regex.test(tmp[i].className)) {
                elArray.push(tmp[i]);
            }
        }

        return elArray;
	}
};

/**
 * Find CHARMe icon insertion points
 */
charme.plugin.markupTags = function(){
	//preload charme icon
	var activeImage = new Image();
	activeImage.src = charme.settings.path + '/activebuttonsmall.png';
	var inactiveImage = new Image();
	inactiveImage.src = charme.settings.path + '/inactivebuttonsmall.png';
	
	var els = charme.plugin.getByClass('charme-dataset');
	for (var i=0; i < els.length; i++){
		if (els[i].href){
			charme.plugin.getAnnotationCountForTarget(els[i], activeImage.src, inactiveImage.src);
		}
		els[i].style.display='inline-block';
		els[i].style.width='36px';
		els[i].style.height='26px';
		charme.common.addEvent(els[i], 'click', charme.plugin.showPlugin);
	}
};

charme.plugin.loadPlugin = function(){
	/* Use an iframe to completely isolate plugin from javascript and css on the main site */
	var plugin = document.createElement('iframe');
	plugin.frameBorder = "no";
	plugin.id='charme-plugin-frame';
	plugin.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-forms');
	document.lastChild.appendChild(plugin);
	plugin.style.backgroundColor='transparent';
	plugin.style.minWidth='70%';
	plugin.style.display='none';
	plugin.style.margin='auto';
	plugin.style.position='absolute';
	plugin.style.left='0';
	plugin.style.right='0';
	plugin.style.bottom='0';
	plugin.style.top='0';
	plugin.allowTransparency=true;
	plugin.style.height='500px';
	plugin.setAttribute('scrolling','no');
	
};

charme.plugin.loadFunc = function(){
	var plugin = this;
	this.style.display='block'; // Only show the iframe once the content has loaded in order to minimize flicker
};

charme.plugin.showPlugin = function(e){
	var plugin = document.getElementById('charme-plugin-frame');
	charme.common.removeEvent(plugin, 'load', charme.plugin.loadFunc);
	charme.common.addEvent(plugin, 'load', charme.plugin.loadFunc);
	
	/*
	 * Prevent default behaviour for anchor onclick (ie following the link)
	 */
	if (e && e.stopPropagation){ // Non-IE browsers
		e.preventDefault(); // Prevent default behaviour, but NOT BUBBLING - This is an important distinction, 
							// we don't want to prevent events firing further up the chain as this might interfere with data provider's site.
	}
	else { // IE versions <= 8
		if (window.event){
			window.event.returnValue=false; // Prevent default behaviour, but NOT BUBBLING
		}
		if (e){
			e.returnValue=false;
		}
	}
	
	var target = e.target;
	if (typeof target==='undefined'){
		target = e.srcElement;
	}
	
	var url = charme.settings.path + '/plugin/plugin.html#/' + encodeURIComponent(encodeURIComponent(target.href)) + '/annotations/';
	
	plugin.src = url;
};

charme.plugin.loginListener = function(evt){
	if (evt.data){
		var msg = JSON.parse(evt.data);
		charme.authToken = msg.authToken;
		if (msg.authToken){
		}
		//console.log('Received token: ' + msg.authToken + ' with expiry: ' + msg.authExpiry);
	}
};

charme.plugin.login = function(){
	var host = 'http://charme-dev.cems.rl.ac.uk:8027';
	var path = '/oauth2/authorize';
	var clientId = '12345';
	var responseType = 'token';
	window.addEventListener('message', charme.plugin.loginListener, false);
	window.open(host + path + '/?client_id=' + clientId + '&response_type=' + responseType);
};

charme.plugin.decorateElements = function(){
	var loginElement = document.getElementById('login');
	charme.common.addEvent(loginElement, 'click', charme.plugin.login);
};

/**
 * Will execute on window load (most init code should go in here)
 */
charme.plugin.init = function(){
	charme.plugin.decorateElements();
	charme.plugin.markupTags();
	charme.plugin.loadPlugin();
};

/**
 * Will execute immediately (should rarely be used)
 */
(function(){
	charme.common.addEvent(window, 'load', charme.plugin.init);
})();