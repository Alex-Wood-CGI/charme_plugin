charme.web.services = angular.module('charmeServices', []);

charme.web.services.factory('persistence', function(){ 
	console.log('Created new lawnchair instance');
	
	var persistService = {};
	persistService.persist = function(key, val){
		$.jStorage.set(key, val);
	};
	persistService.retrieve = function(key){
		var promise = new Promise(function(resolver){
			var val = $.jStorage.get(key);
			if (val){
				resolver.fulfill(val);
			} else {
				resolver.reject(val);
			}
		});
		return promise;
	};
	persistService.clear = function(){
		$.jStorage.flush();
	};
	return persistService;
});

charme.web.services.factory('loginService', ['persistence', function(persistence){
	var loginService = {};
	loginService._loginListeners = [];
	loginService._logoutListeners = [];
	loginService._auth = null;
	
	/**
	 * Load stored credentials (if any)
	 */
	loginService._loadState=function(){
		persistence.retrieve(charme.web.constants.CHARME_TK).then(function(auth){
			loginService._doLogin(auth);
		});
	};
	
	loginService.setAuth=function(auth){
			loginService._auth = auth;
	};
	loginService.isLoggedIn=function(){
			return loginService._auth && !loginService.isExpired() ? true : false;
	};
	loginService.isExpired=function(){
			if (loginService._auth.expiry < new Date()){
				persistence.clear();
				return true;
			}
			return false;
	};
	loginService.getAuth=function(){
//			if (loginService._auth)
//				loginService._auth.user={first_name:'John', last_name:'Smith', email:'j.smith@cgi.com'};
			return loginService._auth;
	};
	
	loginService.fetchUserDetails=function(authToken){
		return charme.logic.fetchUserDetails(authToken.token);
	};
	
	loginService._doLogin=function(authData){
		if (authData.expiry){
			authData.expiry = new Date(authData.expiry);
		}
		if (authData.token){
			loginService.setAuth(authData);
		}
		loginService.fetchUserDetails(authData).then(function(userDetails){
			loginService.getAuth().user = userDetails;
			angular.forEach(loginService._loginListeners, function(value, key){
				value(loginService.getAuth());
			});
		});
	};
	
	loginService._loginEvent=function(evt){
		if (evt.data){
			var msg = JSON.parse(evt.data);
			try {
				persistence.persist(charme.web.constants.CHARME_TK, msg);
			}
			catch (e){
				if (console){
					console.log('Unable to persist user credentials ');
					console.log(e);
				}
			}
			loginService._doLogin(msg);
		}
	};
	
	loginService._logoutEvent = function(){
		angular.forEach(loginService._logoutListeners, function(value, key){
			value();
		});
		persistence.clear();
	};
	
	loginService.logout=function(){
		loginService._auth = null;
		loginService._logoutEvent();
	};
	
	/**
	 * Function to allow objects to register for login events
	 */
	loginService.addLoginListener=function(listener){
		loginService._loginListeners.push(listener);
	};

	/**
	 * Function to allow objects to register for login events
	 */
	loginService.addLogoutListener=function(listener){
		loginService._logoutListeners.push(listener);
	};
	
	return loginService;
}]);

/**
 * Register charme.logic methods as service methods
 */
charme.web.services.factory('fetchAnnotationsForTarget', function(){ 
		return charme.logic.fetchAnnotationsForTarget;
	}
);

charme.web.services.factory('fetchAnnotation', function(){ 
	return charme.logic.fetchAnnotation;
}
);

charme.web.services.factory('saveAnnotation', function(){ 
	return function(annoModel, targetId, auth){
		var promise = new Promise(function(resolver){
			
			var graph = new jsonoa.types.Graph();
			var anno = graph.createNode(jsonoa.types.Annotation, charme.logic.constants.ATN_ID_PREFIX + 'annoID');
			var bodyId = charme.logic.constants.BODY_ID_PREFIX + 'bodyID';
			var commentId = bodyId; 
			
			if (annoModel.comment){
				var comment = graph.createNode(jsonoa.types.TextBody, commentId);
				comment.setValue(comment.CONTENT_CHARS, annoModel.comment);
				anno.addValue(anno.BODY, comment);
			} 
			if (annoModel.type){
				//var type = jsonoa.types[annoModel.type]; // Take specified type, and return function representation
				var type = jsonoa.types.identifyFromType(annoModel.type);
				var typeInst;
				if (typeof type !== 'function'){
					resolver.reject('Invalid selection ' + annoModel.type);
				} else {
					///typeInst = new type();
				}
				if (annoModel.uri){
					var linkURI = annoModel.uri;
					
					var doiVal = charme.logic.findDOI(linkURI);
					
					//If a DOI is provided, create a citation act for the body
					if (doiVal){
						//Create a fully qualified canonical URI for the DOI
						linkURI=charme.logic.constants.DOI_PREFIX + linkURI;
						//Auto-generating IDs at the moment on client side, which shouldn't happen. The Node must take responsibility for this, but no method is available yet for multiple bodies
						var citoId = charme.logic.generateId();
						
						/**
						 * Add logic here for determining if DOI. If it is a DOI, then use CITO ontology
						 */
						/*
						 * Create a citation act for the body. 
						 */
						var publication = graph.createNode(jsonoa.types.Publication, citoId);
						publication.setValue(publication.CITED_ENTITY, graph.createStub(targetId));
						publication.setValue(publication.CITING_ENTITY, graph.createStub(linkURI));	
						anno.addValue(anno.BODY, publication);
						//Create node for link uri, with typing information
						graph.createNode(type, linkURI);
					} else {
						var linkBody =graph.createNode(type, linkURI);
						anno.addValue(anno.BODY, linkBody);
					}
					
				} else {
					resolver.reject('No URI entered');
				}
				
			}
			if (annoModel.domain){
				angular.forEach(annoModel.domain, function(value){
					var tagId = charme.logic.generateId();
					var page = graph.createStub(value);
					var tag = graph.createNode(jsonoa.types.SemanticTag, tagId);
					tag.setValue(tag.PAGE, page);
					anno.addValue(anno.BODY, tag);
				});
			}
			var person = graph.createNode(jsonoa.types.Person, 'http://localhost/' + charme.logic.generateGUID());
			person.setValue(person.MBOX, graph.createStub('mailto:' + auth.user.email));
			person.setValue(person.NAME, auth.user.first_name + ' ' + auth.user.last_name);
			anno.setValue(anno.ANNOTATED_BY, person);
			
			var target = graph.createNode(jsonoa.types.DatasetTarget, targetId);
			anno.setValue(anno.TARGET, target);
			charme.logic.saveGraph(graph, auth.token).then(
				function(data){
					resolver.fulfill(data);
				}, 
				function(error){
					resolver.reject(error);
				}
			);
		});
		return promise;
	};
});

charme.web.services.factory('fetchKeywords', function(){
	var categories = [];//Only fetch once, and scope to session
	return function(annoModel, targetId){	
		var promise = new Promise(function(resolver){
			if (categories.length===0){
				charme.logic.fetchGCMDVocab().then(function(keywords){
					categories.push({
						name: 'GCMD',
						keywords: keywords
					});
					resolver.fulfill(categories);
				});
			} else {
				resolver.fulfill(categories);
			}
		}, function(error){
			resolver.reject(error);
		});
		return promise;
	};
});

charme.web.services.factory('fetchFabioTypes', function(){
	return function(annoModel, targetId){	
		var promise = new Promise(function(resolver){
			charme.logic.fetchFabioTypes().then(function(types){
				resolver.fulfill(types);
			});
		}, function(error){
			resolver.reject(error);
		});
		return promise;
	};
});