/**
 * A javascript library for creating and ingesting JSON-LD based Open Annotations
 * 
 * Depends upon Promise.js for implementing promises model. This is unavoidable due to a dependency from the json-ld framework.
 */
var OA = {
		/*
		 * Constants
		 */
		constants: {
			TYPE_ANNO: 'http://www.w3.org/ns/oa#Annotation',
			TYPE_CONT_AS_TEXT: 'http://www.w3.org/2011/content#ContentAsText',
			TYPE_TEXT: 'http://purl.org/dc/dcmitype/Text',
			TYPE_CITE: 'http://purl.org/spar/cito/CitationAct',
			TYPE_FOAF_PERSON: 'http://xmlns.com/foaf/0.1/Person',
			TYPE_IGNORE: ['http://purl.org/spar/fabio/MetadataDocument','http://purl.org/spar/fabio/Article'],
			
			ATTR_GRAPH:'@graph',
			ATTR_TYPE: '@type',
			ATTR_ID:'@id',
			ATTR_VALUE: '@value',
			ATTR_BODY:'http://www.w3.org/ns/oa#hasBody',
			ATTR_TARGET:'http://www.w3.org/ns/oa#hasTarget',
			ATTR_ANNOTATED_BY: 'http://www.w3.org/ns/oa#annotatedBy',
			ATTR_FORMAT:'http://purl.org/dc/elements/1.1/format',
			ATTR_CHARS:'http://www.w3.org/2011/content#chars',
			ATTR_CITE_EVENT:'http://purl.org/spar/cito/hasCitationEvent',
			ATTR_CITED_ENT:'http://purl.org/spar/cito/hasCitedEntity',
			ATTR_CITING_ENT:'http://purl.org/spar/cito/hasCitingEntity',
			ATTR_MOTIVATED_BY:'http://www.openannotation.org/spec/core/motivatedBy',
			ATTR_FOAF_MAILBOX:'http://xmlns.com/foaf/0.1/mbox',
			ATTR_FOAF_NAME:'http://xmlns.com/foaf/0.1/name',
			
			CITE_EVENT_DS:'http://purl.org/spar/cito/citesAsDataSource',
			MOTIVE_LINKING:'http://www.openannotation.org/spec/core/linking',
			FORMAT_TEXT: 'text/plain',
			FORMAT_HTML: 'text/html'
		},
		/*
		 * Objects
		 */
		
		/*
		 * The OAGraph object is a holder for potentially multiple annotations. This element does not exist in expanded form
		 */
		OAGraph: function OAGraph (){
			this.annotations = [];
			
			/**
			 * Note: DOES NOT RETURN A STRING. The serialize function will generate a JSON-LD object that is normalized and ready for immediate serialization into an AJAX request. 
			 */
			this.serialize = function (){
				var jsonObj = {};
				jsonObj[OA.constants.ATTR_GRAPH]=[];
				for (var i=0; i < this.annotations.length; i++){
					jsonObj[OA.constants.ATTR_GRAPH] = jsonObj[OA.constants.ATTR_GRAPH].concat(this.annotations[i].serialize());
				}
				return jsonObj;
			};
		},
		/**
		 * A parent class for all nodes in a JSON-LD graph (Annotations, Bodies, Targets, etc.)
		 * @returns
		 */
		OANode: function OANode(){
			/*
			 * Private members
			 */
			var _id=''; //Make id a private member with accessors. Use prescribed getters and setters in order to provide hook for id changes.
			var _internalId=''; // The internal id is the id used by the CHARMe data model for identifying annotations. It makes up part of the annotation's URI: http://localhost/resource/<INTERNAL_ID>
			
			/*
			 * Public members
			 */
			this.types=[];
			
			/**
			 * A getter and setter for IDs. This is in order to ensure the ID, and internal ID are kept in synch.
			 */
			this.getId = function(){
				return _id;
			};
			this.setId = function(id){
				_id = id;
				_internalId = id.substring(id.lastIndexOf('/') + 1);
			};
			
			this.getInternalId = function(){
				return _internalId;
			};
			
			return this;
		},
		
		/**
		 * An annotation is composed of a body and a target.
		 * @returns
		 */
		OAnnotation: function OAnnotation (){
			
			this.prototype=new OA.OANode();
			OA.OANode.call(this);
			this.body={};
			this.target={};
			this.annotatedBy={};
			
			this.serialize = function() {
				/**
				 * The result will be 3 'nodes'
				 * 1) The annotation itself
				 * 2) The target
				 * 3) The body
				 */
				var annoNodes = [];
				
				var annoJSON = {};
				annoJSON[OA.constants.ATTR_ID] = this.getId();
				annoJSON[OA.constants.ATTR_TYPE] =[OA.constants.TYPE_ANNO];
				annoJSON[OA.constants.ATTR_BODY] = {}; 
				annoJSON[OA.constants.ATTR_BODY][OA.constants.ATTR_ID] = this.body.getId();
				
				annoJSON[OA.constants.ATTR_TARGET] = {};
				annoJSON[OA.constants.ATTR_TARGET][OA.constants.ATTR_ID] = this.target.getId();
				
				annoJSON[OA.constants.ATTR_MOTIVATED_BY] = {};
				annoJSON[OA.constants.ATTR_MOTIVATED_BY][OA.constants.ATTR_ID] = OA.constants.MOTIVE_LINKING;
				
				var annotatedByNode = null;
				if (this.annotatedBy && this.annotatedBy.email){
					annoJSON[OA.constants.ATTR_ANNOTATED_BY] = {};
					annoJSON[OA.constants.ATTR_ANNOTATED_BY][OA.constants.ATTR_ID] = this.annotatedBy.getId();
					
					annotatedByNode = this.annotatedBy.serialize();
				}

				annoNodes.push(annoJSON);
				
				var bodyNode = this.body.serialize();
				if (bodyNode){
					annoNodes.push(bodyNode);
				}
				
				var targetNode = this.target.serialize();
				if (targetNode){
					annoNodes.push(targetNode);
				}

				if (annotatedByNode){
					annoNodes.push(annotatedByNode);
				}
				
				return annoNodes;
			};
		},
		
		/**
		 * A body represents the annotation being applied to an entity. This can be absolutely anything that can be represented with a URI. Beyond annotations using an external URI,
		 * annotations can also be created with a text body. In this case, the URI points to another node within the same triplestore. Within the jsonoa library however, this
		 * relationship is abstracted and the association between an annotation and a text body is automatically applied.
		 * @returns
		 */
		OABody: function OABody(){
			this.prototype=new OA.OANode();
			OA.OANode.call(this);
			
			this.format='';
			this.text='';
			
			/**
			 * The serialize function will  generate a JSON-LD object that is normalized and ready for immediate serialization into an AJAX request. NOT A STRING
			 */
			this.serialize = function(){
				if (this.getId().length === 0){
					throw new Error('No body ID provided');
				}
				//Processing for plain text bodies
				if (this.types.length > 0 || this.format.length > 0 || this.text.length > 0){
					var thisJSON = {};
					//Attributes identifying this as a textual annotation
					thisJSON[OA.constants.ATTR_ID] = this.getId();
					thisJSON[OA.constants.ATTR_TYPE] = this.types;
					if (this.format.length > 0){
						thisJSON[OA.constants.ATTR_FORMAT] = this.format;
					}
					if (this.text.length > 0){
						thisJSON[OA.constants.ATTR_CHARS] = this.text;
					}
					return thisJSON;
				} else {
					return null;
				}
			};
		},
		
		/**
		 * Represents the body of a reference (citation) type annotation
		 */
		OARefBody: function OARefBody(){
			OA.OABody.call(this);
			this.prototype=new OA.OABody();
			this.citingEntity='';
			this.citedEntity='';

			this.serialize = function(){
				if (this.types.length === 0){
					this.types = [OA.constants.TYPE_CITE];
				}
				var thisJSON = this.prototype.serialize.call(this);
				thisJSON[OA.constants.ATTR_CITE_EVENT]={};
				thisJSON[OA.constants.ATTR_CITE_EVENT][OA.constants.ATTR_ID]=OA.constants.CITE_EVENT_DS;
				
				thisJSON[OA.constants.ATTR_CITED_ENT]={};
				thisJSON[OA.constants.ATTR_CITED_ENT][OA.constants.ATTR_ID]=this.citedEntity;

				thisJSON[OA.constants.ATTR_CITING_ENT]={};
				thisJSON[OA.constants.ATTR_CITING_ENT][OA.constants.ATTR_ID]=this.citingEntity;
				
				return thisJSON;
			};
		},

		OATarget: function OATarget(){
			this.prototype=new OA.OANode();
			OA.OANode.call(this);
			
			this.serialize = function() {
				return null; // do nothing for now
			};
		},
		
		OAPerson: function OAPerson(){
			this.prototype=new OA.OANode();
			OA.OANode.call(this);
			
			this.name='';
			this.email='';
			
			this.serialize = function() {
				if (this.types.length === 0){
					this.types = [OA.constants.TYPE_FOAF_PERSON];
				}
				var thisJSON = {};
				//Attributes identifying this as a textual annotation
				thisJSON[OA.constants.ATTR_ID] = this.getId();
				thisJSON[OA.constants.ATTR_TYPE] = this.types;
				thisJSON[OA.constants.ATTR_FOAF_MAILBOX] = {};
				thisJSON[OA.constants.ATTR_FOAF_MAILBOX][OA.constants.ATTR_ID]='mailto:' + this.email;
				thisJSON[OA.constants.ATTR_FOAF_NAME]=this.name;
				
				return thisJSON;
			};			
		},
		
		/**
		 * A helper function for creating a new 'text' type annotation body object.
		 * @returns {___body0}
		 */
		createTextBody: function(){
			var body = new OA.OABody();
			body.types = [OA.constants.TYPE_CONT_AS_TEXT, OA.constants.TYPE_TEXT];
			body.format=OA.constants.FORMAT_TEXT;
			return body;
		},		
		
		/**
		 * Given some JSON-LD data, generate a new Annotation object
		 * @param data The JSON-LD formated data
		 * @returns {Promise} A promise object that can be used for chaining multiple asynchronous processes. For more on Promises, see http://12devs.co.uk/articles/promises-an-alternative-way-to-approach-asynchronous-javascript/
		 */
		deserialize: function(data){
			return new Promise(function(resolver) {
				//first, expand the data. Expanding the data standardises it and simplifies the process of parsing it.
				var processor = new jsonld.JsonLdProcessor();
				// set base URI
				var options = {base: document.baseURI};

				processor.expand(data, options).then(function(graph){

					var oag = new OA.OAGraph();
					var nodeMap = {};
					/*
					 * First, iterate through all of the nodes in the graph, and deserialize them
					 */
					//for (i=0; i < graph[OA.constants.ATTR_GRAPH].length; i++){
					for (var i=0; i < graph.length; i++){
						var n = graph[i];
						var type=n[OA.constants.ATTR_TYPE];
						var node = null;
						
						//Some json-ld nodes in the open annotations tree have a type, and in *some* cases it's an array. In other cases it is a string.
						//Put all types in an array, to avoid having two types of handling
						if (type !== undefined && !(type instanceof Array)){
								var tmp = type;
								(type = []).push(tmp);
						}
						
						//Check if this is an annotation node
						if ($.inArray(OA.constants.TYPE_ANNO, type) >= 0 ){
							node = new OA.OAnnotation();
							node.setId(n[OA.constants.ATTR_ID]);
							//Add a placeholder body and target. In some cases these will point to a another node, in other cases to an external resource. 
							// In the case of other nodes, the internal links will be resolved in a second pass
							if (n[OA.constants.ATTR_BODY]){
								var body = new OA.OABody();
								body.setId(n[OA.constants.ATTR_BODY][0][OA.constants.ATTR_ID]);
								node.body = body;
							}
							
							var target = new OA.OATarget();
							target.setId(n[OA.constants.ATTR_TARGET][0][OA.constants.ATTR_ID]);
							node.target=target;
							if (n[OA.constants.ATTR_MOTIVATED_BY]){
								node.motivatedBy = n[OA.constants.ATTR_MOTIVATED_BY][0][OA.constants.ATTR_ID];
							}
							
							if (n[OA.constants.ATTR_ANNOTATED_BY]){
								var annotatedBy = new OA.OAPerson();
								annotatedBy.setId(n[OA.constants.ATTR_ANNOTATED_BY][0][OA.constants.ATTR_ID]);
								node.annotatedBy = annotatedBy;
							}
							
							oag.annotations.push(node); // As this is an annotation, push it into annotations collection
						} else if ($.inArray(OA.constants.TYPE_CONT_AS_TEXT, type) >= 0 || $.inArray(OA.constants.TYPE_TEXT, type) >=0 ){
							node = new OA.OABody();
							node.setId(n[OA.constants.ATTR_ID]);
							node.format=n[OA.constants.ATTR_FORMAT];
							node.text=n[OA.constants.ATTR_CHARS][0][OA.constants.ATTR_VALUE];
							nodeMap[node.getId()]=node; // This node is a segment of an annotation, push it into a map for retrieval later
						} else if ($.inArray(OA.constants.TYPE_CITE, type) >= 0){
							node = new OA.OARefBody();
							node.setId(n[OA.constants.ATTR_ID]);
							node.citedEntity=n[OA.constants.ATTR_CITED_ENT][0][OA.constants.ATTR_ID];
							node.citingEntity=n[OA.constants.ATTR_CITING_ENT][0][OA.constants.ATTR_ID];
							nodeMap[node.getId()]=node;
						} else if ($.inArray(OA.constants.TYPE_FOAF_PERSON, type) >= 0){
							node = new OA.OAPerson();
							node.setId(n[OA.constants.ATTR_ID]);
							node.email=n[OA.constants.ATTR_FOAF_MAILBOX][0][OA.constants.ATTR_ID];
							if (node.email.indexOf('mailto:') === 0){
								node.email=node.email.substring('mailto:'.length);
							}
							node.name= n[OA.constants.ATTR_FOAF_NAME] ? n[OA.constants.ATTR_FOAF_NAME][0][OA.constants.ATTR_VALUE] : '';
							nodeMap[node.getId()]=node;
						}
						else if($(type).filter(OA.constants.TYPE_IGNORE).length >=0){
							//DO NOTHING;
							continue;
						}
						else if ((type === undefined) || type.length === 0){
							node = new OA.OATarget();
							node.setId(n[OA.constants.ATTR_ID]);
							nodeMap[node.getId()]=node; // Targets seem to be identifiable only by their lack of type? Not sure what to do with these right now...
						} else {
							//DO NOTHING - this is just temporary, as the node graphs are changing rapidly;
							if (window.console && window.console.warn) 
								console.warn('Unknown JSON-LD graph node type ' + type);
							continue;
							//resolver.reject(new Error('Unknown JSON-LD graph node type ' + type));
							//return;
						}
						if (type instanceof Array){
							for (var j=0; j < type.length; j++){
								node.types.push(type[j]);
							}
						} else {
							node.types.push(type);
						}
					}
					/*
					 * Iterate over the deserialized annotations, and recreate the relationships between them and their bodies and targets
					 */
					for (var k=0; k < oag.annotations.length; k++){
						a = oag.annotations[k];
						if (a.body && a.body.getId){
							var annoBody = nodeMap[a.body.getId()];
							if (annoBody){
								a.body = annoBody;
							}
						}
						if (a.target && a.target.getId){
							var annoTarget = nodeMap[a.target.getId()];
							if (annoTarget){
								a.target=annoTarget;
							}
						}
						if (a.annotatedBy && a.annotatedBy.getId){
							var annoAnnotatedBy = nodeMap[a.annotatedBy.getId()];
							if (annoAnnotatedBy){
								a.annotatedBy = annoAnnotatedBy;
							}							
						}
					}
					resolver.resolve(oag);
			})["catch"](resolver.reject);
		});
		}/*,

		serialize: function (OAGraph){
			return OAGraph.serialize();
		}*/
};