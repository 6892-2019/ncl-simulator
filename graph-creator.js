(function(d3, saveAs, Blob, UndoManager, alertify){
  "use strict";

  // TODO add user settings
  var settings = {
    appendElSpec: "#graph",
    alert_settings: {
      transition: 'fade'
    },
    confirm_settings: {
      transition: 'fade'
    }
  };
  // define graphcreator object
  var GraphCreator = function(svg, nodes, edges, config){
    var thisGraph = this;
        thisGraph.idct = 0;

    if (!config) {
        config = {};
    }

    var default_config = GraphCreator.prototype.consts;
    for (var key in default_config) {
        if (default_config.hasOwnProperty(key) && !config.hasOwnProperty(key)) {
            config[key] = default_config[key];
        }
    }

    this.consts = config;
    this.undo_manager = new UndoManager();

    thisGraph.nodes = nodes || [];
    thisGraph.edges = edges || [];

    thisGraph.state = {
      selectedNode: null,
      selectedEdge: null,
      mouseDownNode: null,
      mouseDownLink: null,
      justDragged: false,
      justScaleTransGraph: false,
      lastKeyDown: -1,
      shiftNodeDrag: false,
      selectedText: null
    };

    // define arrow markers for graph links
    var defs = svg.append('svg:defs');
    defs.append('svg:marker')
      .attr('id', 'end-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('markerWidth', 3.5)
      .attr('markerHeight', 3.5)
      .attr('orient', 'auto')
      .append('svg:path')
      .attr('d', 'M0,-5L10,0L0,5');

    // define arrow markers for leading arrow
    defs.append('svg:marker')
      .attr('id', 'mark-end-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 7)
      .attr('markerWidth', 3.5)
      .attr('markerHeight', 3.5)
      .attr('orient', 'auto')
      .append('svg:path')
      .attr('d', 'M0,-5L10,0L0,5');

    thisGraph.svg = svg;
    thisGraph.svgG = svg.append("g")
          .classed(thisGraph.consts.graphClass, true);
    var svgG = thisGraph.svgG;

    // displayed when dragging between nodes
    thisGraph.dragLine = svgG.append('svg:path')
          .attr('class', 'link dragline hidden')
          .attr('d', 'M0,0L0,0')
          .style('marker-end', 'url(#mark-end-arrow)');

    // svg nodes and edges
    thisGraph.gedges = svgG.append("g").selectAll("g");
    thisGraph.gnodes = svgG.append("g").selectAll("g");

    thisGraph.drag = d3.behavior.drag()
          .origin(function(d){
            return {x: d.x, y: d.y};
          })
          .on("drag", function(args){
            thisGraph.state.justDragged = true;
            thisGraph.dragmove.call(thisGraph, args);
          })
          .on("dragend", function() {
            // todo check if edge-mode is selected
          });

    // listen for key events
    d3.select(window).on("keydown", function(){
      thisGraph.svgKeyDown.call(thisGraph);
    })
    .on("keyup", function(){
      thisGraph.svgKeyUp.call(thisGraph);
    });
    svg.on("mousedown", function(d){thisGraph.svgMouseDown.call(thisGraph, d);});
    svg.on("mouseup", function(d){thisGraph.svgMouseUp.call(thisGraph, d);});

    // listen for dragging
    var dragSvg = d3.behavior.zoom()
          .scaleExtent([thisGraph.consts.zoomMinScale, thisGraph.consts.zoomMaxScale])
          .on("zoom", function(){
            if (d3.event.sourceEvent.shiftKey){
              // TODO  the internal d3 state is still changing
              return false;
            } else{
              thisGraph.zoomed.call(thisGraph);
            }
            return true;
          })
          .on("zoomstart", function(){
            var ael = d3.select("#" + thisGraph.consts.activeEditId).node();
            if (ael){
              ael.blur();
            }
            if (!d3.event.sourceEvent.shiftKey) d3.select('body').style("cursor", "move");
          })
          .on("zoomend", function(){
            d3.select('body').style("cursor", "auto");
          });

    thisGraph.dragSvg = dragSvg;
    svg.call(dragSvg).on("dblclick.zoom", null);

    // listen for resize
    window.onresize = function(){thisGraph.updateWindow(svg);};

    // handle download data
    d3.select("#download-input").on("click", function(){
      var saveEdges = [];
      thisGraph.edges.forEach(function(val, i){
        saveEdges.push({source: val.source.id, target: val.target.id, color: val.color, stroke: val.stroke, dir: val.dir, fint: val.fint});
      });
      var blob = new Blob([window.JSON.stringify({"nodes": thisGraph.nodes, "edges": saveEdges})], {type: "text/plain;charset=utf-8"});
      saveAs(blob, "mydag.json");
    });

    // save the graph as an image
    d3.select('#download-image').on('click', function(){
        var svg = thisGraph.svg;
        var width = svg.attr('width');
        var height = svg.attr('height');

        save_svg_as_png_image(svg.node(), width, height, function (dataBlob, filesize) {
            saveAs(dataBlob, 'mydag.png');
        });
    });


    // handle uploaded data
    d3.select("#upload-input").on("click", function(){
      document.getElementById("hidden-file-upload").click();
    });
    d3.select("#hidden-file-upload").on("change", function(){
      if (window.File && window.FileReader && window.FileList && window.Blob) {
        var uploadFile = this.files[0];
        var filereader = new window.FileReader();

        filereader.onload = function(){
          var txtRes = filereader.result;
          // TODO better error handling
          try{
            thisGraph.load_graph_from_json(txtRes);
          }catch(err){
            alertify.alert('Ups!', "Error parsing uploaded file\nerror message: " + err.message).
                     setting(settings.alert_settings);
            return;
          }
        };
        filereader.readAsText(uploadFile);

      } else {
        alertify.alert('Ups!', "Your browser won't let you save this graph " +
                               "-- try upgrading your browser to IE 10+ or Chrome or Firefox.").
                setting(settings.alert_settings);
      }

    });

    // handle delete graph
    d3.select("#delete-graph").on("click", function(){
      alertify.confirm("Delete graph", 
                       "Are you sure that you want to delete this graph?", 
                        function () {
                          thisGraph.deleteGraph();
                        }, 
                        function noop() {}).
                setting(settings.confirm_settings);
    });
    
    // center the graph
    d3.select("#center-graph").on("click", function(){
      thisGraph.centerGraph();
    });
  };

  GraphCreator.prototype.setIdCt = function(idct){
    this.idct = idct;
  };

  GraphCreator.prototype.consts =  {
    defaultTitle: "random variable",
    selectedClass: "selected",
    connectClass: "connect-node",
    nodeGClass: "conceptG",
    graphClass: "graph",
    activeEditId: "active-editing",
    editingOpacity: 0.1,
    BACKSPACE_KEY: 8,
    DELETE_KEY: 46,
    ENTER_KEY: 13,
    UNDO_KEY: 90, // Z
    REDO_KEY: 89, // Y
    COLOR_KEY: 67,     // C
    FILL_KEY:  70,     // F
    STROKE_KEY: 83,    // S
    DIRECTION_KEY: 68, // D
    nodeRadius: 50,
    nodeMargin: 7,
    continuationWordMarker: "...",
    maxWordLength: 16,
    charWidthPixel: 10,
    lineHeightPixel: 15,
    lowerTextRatio: 1.60,
    upperTextRatio: 4.0,
    zoomMinScale: 0.25,
    zoomMaxScale: 1.5,
    COLORS: [
      ["#f6fbff"].concat(colorbrewer.Greys[5]),
      ["#f6fbff"].concat(colorbrewer.Blues[5]),
      ["#f6fbff"].concat(colorbrewer.Greens[5]),
      ["#f6fbff"].concat(colorbrewer.Reds[5]),
      ["#f6fbff"].concat(colorbrewer.Purples[5]),
      ["#f6fbff"].concat(colorbrewer.Oranges[5]),
    ],
    COLOR_INTENSITIES: 6,
    STROKES: [
        "none", // contiguous line
        "5, 2",
        "10, 5", 
        "10, 15", 
        "5, 10",
        "10, 5, 5, 5, 5, 5",
        "5, 2, 2, 2, 2, 2",
    ]
  };

  /* PROTOTYPE FUNCTIONS */

  GraphCreator.prototype.load_graph_from_json = function (json_txt) {
    var thisGraph = this;
    var jsonObj = JSON.parse(json_txt);

    thisGraph.deleteGraph();
    thisGraph.nodes = jsonObj.nodes;

    var maxIdCt = 0;
    for (var i = 0; i < thisGraph.nodes.length; ++i) {
        if (maxIdCt < thisGraph.nodes[i].id)
            maxIdCt = thisGraph.nodes[i].id;

        // backward compatibility for missing fields
        thisGraph.nodes[i].fint = thisGraph.nodes[i].fint || 0;
    }

    thisGraph.setIdCt(maxIdCt + 1);

    var newEdges = jsonObj.edges;
    newEdges.forEach(function(e, i){
      newEdges[i] = {
                  source: thisGraph.nodes.filter(function(n){return n.id == e.source;})[0],
                  target: thisGraph.nodes.filter(function(n){return n.id == e.target;})[0],
                  color: newEdges[i].color, stroke: newEdges[i].stroke, dir: newEdges[i].dir
                  };
    });

    thisGraph.edges = newEdges;
    thisGraph.updateGraph();
    
    thisGraph.undo_manager.clear();
  };

  GraphCreator.prototype.centerGraph = function () {
    var thisGraph = this;

    // find the mass center of the graph
    var x = 0, y = 0;
    thisGraph.nodes.forEach(function (d) {
      x += d.x;
      y += d.y;
    });
    
    var nnodes = thisGraph.nodes.length || 1;
    x = x / nnodes;
    y = y / nnodes;
    
    // find the difference between the mass center and the center of the canvas
    var w = thisGraph.svg.attr("width");
    var h = thisGraph.svg.attr("height");

    var dx = (w/2) - x;
    var dy = (h/2) - y;

    thisGraph.dragSvg.translate([dx,dy]);
    thisGraph.dragSvg.scale(1);

    thisGraph.zoomed.call(thisGraph);
    thisGraph.updateGraph();
  };

  GraphCreator.prototype.dragmove = function(d) {
    var thisGraph = this;
    if (thisGraph.state.shiftNodeDrag){
      thisGraph.dragLine.attr('d', 'M' + d.x + ',' + d.y + 'L' + d3.mouse(thisGraph.svgG.node())[0] + ',' + d3.mouse(this.svgG.node())[1]);
    } else{
      d.x += d3.event.dx;
      d.y +=  d3.event.dy;
      thisGraph.updateGraph();
    }
  };

  GraphCreator.prototype.deleteGraph = function(){
    var thisGraph = this;

    thisGraph.nodes = [];
    thisGraph.edges = [];
    thisGraph.updateGraph();
  };

  /* select all text in element: taken from http://stackoverflow.com/questions/6139107/programatically-select-text-in-a-contenteditable-html-element */
  GraphCreator.prototype.selectElementContents = function(el) {
    var range = document.createRange();
    range.selectNodeContents(el);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  };


  /* insert svg line breaks: taken from http://stackoverflow.com/questions/13241475/how-do-i-include-newlines-in-labels-in-d3-charts */
  GraphCreator.prototype.insertTitleLinebreaks = function (gEl, title) {
    var lineHeightPixel = this.consts.lineHeightPixel;
    var charWidthPixel = this.consts.charWidthPixel;

    var lowerTextRatio = this.consts.lowerTextRatio;
    var upperTextRatio = this.consts.upperTextRatio;
    var perfectTextRatio = lowerTextRatio + ((upperTextRatio - lowerTextRatio)/2);

    var nodeMargin = this.consts.nodeMargin;

    var words = title.trim().split(/\s+/g);

    // replace tooo long words by shorter ones
    var continuation_marker_length = this.consts.continuationWordMarker.length;
    for (var i = 0; i < words.length; ++i) {
        if (words[i].length > this.consts.maxWordLength) {
            words[i] = words[i].substr(0, this.consts.maxWordLength-continuation_marker_length) +
                            this.consts.continuationWordMarker;
        }
    }

    var lines = words;
    var ratio = (charWidthPixel * lines.length) / (lineHeightPixel * 1);
    var max_line_length = lines[0].length;

    while (1) {
        var old_lines = lines;
        var old_ratio = ratio;

        // try to put small words in a single line
        var new_lines = [];
        var last_line_length = 0;
        for (var i = 0; i < words.length; i++) {
            var l = words[i].length;
            if (last_line_length + l + 1 > max_line_length || new_lines.length === 0) {
                new_lines.push(words[i]);
                last_line_length = l;
            }
            else {
                new_lines[new_lines.length - 1] += (" " + words[i]);
                last_line_length += l + 1;
            }
        }
        lines = new_lines;

        var width  = charWidthPixel  * max_line_length;
        var height = lineHeightPixel * lines.length;
        var ratio  = width / height;


        if (ratio > lowerTextRatio && ratio < upperTextRatio) { // good enough
            break;
        }
        else if (ratio == old_ratio) { // we didn't improved too much
            break;
        }
        else if (ratio < lowerTextRatio) {  // too many lines, continue trying to join them 
            if (lines.length < 2) { 
                break; // we don't have lines to join, finish here
            }
        }
        else { // too few lines, try to revert the last join, if its ratio is better
           if (Math.abs(old_ratio - perfectTextRatio) < Math.abs(ratio - perfectTextRatio)) {
               lines = old_lines;
           }
           break; 
        }

        // search for two consecutive lines to join that sum the minimal length greather than the current maximum 
        var min_joined_lines_length = lines[0].length + lines[1].length + 1;
        var min_at = 0;
        for (var i = 0; i < lines.length - 1; i++) {
            var l = lines[i].length + lines[i+1].length + 1;
            if (l > max_line_length && l < min_joined_lines_length) {
                min_joined_lines_length = l;
                min_at = i;
            }
        }

        // join them
        lines[min_at] = lines[min_at] + " " + lines[min_at+1];
        lines.splice(min_at + 1, 1);

        // update the max line length with the new line added
        if (lines[min_at].length > max_line_length) {
            max_line_length = lines[min_at].length;
        }
        else {
            break; // this was my best effort, sorry 
        }
    }

    var el = gEl.append("text")
          .attr("text-anchor","middle")
          .attr("dy", -(lines.length-1)*(lineHeightPixel / 2) + nodeMargin);

    for (var i = 0; i < lines.length; i++) {
      var tspan = el.append('tspan').text(lines[i]);
      if (i > 0)
        tspan.attr('x', 0).attr('dy', lineHeightPixel);

    }
  };


  GraphCreator.prototype.replaceSelectEdge = function(d3Path, edgeData){
    var thisGraph = this;
    d3Path.classed(thisGraph.consts.selectedClass, true);
    if (thisGraph.state.selectedEdge){
      thisGraph.removeSelectFromEdge();
    }
    thisGraph.state.selectedEdge = edgeData;
  };

  GraphCreator.prototype.replaceSelectNode = function(d3Node, nodeData){
    var thisGraph = this;
    d3Node.classed(this.consts.selectedClass, true);
    if (thisGraph.state.selectedNode){
      thisGraph.removeSelectFromNode();
    }
    thisGraph.state.selectedNode = nodeData;
  };

  GraphCreator.prototype.removeSelectFromNode = function(){
    var thisGraph = this;
    thisGraph.gnodes.filter(function(cd){
      return cd.id === thisGraph.state.selectedNode.id;
    }).classed(thisGraph.consts.selectedClass, false);
    thisGraph.state.selectedNode = null;
  };

  GraphCreator.prototype.removeSelectFromEdge = function(){
    var thisGraph = this;
    thisGraph.gedges.filter(function(cd){
      return cd === thisGraph.state.selectedEdge;
    }).classed(thisGraph.consts.selectedClass, false);
    thisGraph.state.selectedEdge = null;
  };

  GraphCreator.prototype.pathMouseDown = function(d3path, d){
    var thisGraph = this,
        state = thisGraph.state;
    d3.event.stopPropagation();
    state.mouseDownLink = d;

    if (state.selectedNode){
      thisGraph.removeSelectFromNode();
    }

    var prevEdge = state.selectedEdge;
    if (!prevEdge || prevEdge !== d){
      thisGraph.replaceSelectEdge(d3path, d);
    } else{
      thisGraph.removeSelectFromEdge();
    }
  };

  // mousedown on node
  GraphCreator.prototype.circleMouseDown = function(d3node, d){
    var thisGraph = this,
        state = thisGraph.state;
    d3.event.stopPropagation();
    state.mouseDownNode = d;
    if (d3.event.shiftKey){
      state.shiftNodeDrag = d3.event.shiftKey;
      // reposition dragged directed edge
      thisGraph.dragLine.classed('hidden', false)
        .attr('d', 'M' + d.x + ',' + d.y + 'L' + d.x + ',' + d.y);
      return;
    }
  };

  /* place editable text on node in place of svg text */
  GraphCreator.prototype.changeTextOfNode = function(d3node, d, is_a_new_node){
    var thisGraph= this,
        consts = thisGraph.consts,
        htmlEl = d3node.node();

    var graph_canvas = thisGraph.svg.selectAll("." + thisGraph.consts.graphClass);
    var original_opacity = graph_canvas.attr("opacity") || 1;
    graph_canvas.attr("opacity", thisGraph.consts.editingOpacity);

    d3node.selectAll("text").remove();
    var nodeBCR = htmlEl.getBoundingClientRect(),
        curScale = nodeBCR.width/consts.nodeRadius,
        placePad  =  5*curScale,
        useHW = curScale > 1 ? nodeBCR.width*0.71 : consts.nodeRadius*1.42;
    // replace with editableconent text
    var d3txt = thisGraph.svg.selectAll("foreignObject")
          .data([d])
          .enter()
          .append("foreignObject")
          .attr("x", nodeBCR.left + placePad )
          .attr("y", nodeBCR.top + placePad)
          .attr("height", 16*useHW)
          .attr("width", 6*useHW)
          .append("xhtml:p")
          .attr("id", consts.activeEditId)
          .attr("contentEditable", "true")
          .text(d.title)
          .on("mousedown", function(d){
            d3.event.stopPropagation();
          })
          .on("keydown", function(d){
            d3.event.stopPropagation();
            if (d3.event.keyCode == consts.ENTER_KEY && !d3.event.shiftKey){
              this.blur();
            }
          })
          .on("blur", function(d){
            thisGraph.updateNodesTitle(d3node, d, this.textContent, is_a_new_node);
            
            d3.select(this.parentElement).remove();
            graph_canvas.attr("opacity", original_opacity);
          });
    return d3txt;
  };
  
  GraphCreator.prototype.updateNodesTitle = function(d3node, d, new_title, is_a_new_node) {
    var thisGraph = this;
    var old_title = d.title;

    d3node.selectAll("text").remove();

    d.title = new_title;
    thisGraph.insertTitleLinebreaks(d3node, d.title);
    thisGraph.update_rectangle_size_based_on_text_size(d3node[0][0]);
    
    if (!is_a_new_node) {
      thisGraph.undo_manager.add({
              undo: function () {
                  thisGraph.updateNodesTitle(d3node, d, old_title);
              },
              redo: function () {
                  thisGraph.updateNodesTitle(d3node, d, new_title);
              }
          });
    }
  };

  // mouseup on nodes
  GraphCreator.prototype.circleMouseUp = function(d3node, d){
    var thisGraph = this,
        state = thisGraph.state,
        consts = thisGraph.consts;
    // reset the states
    state.shiftNodeDrag = false;
    d3node.classed(consts.connectClass, false);

    var mouseDownNode = state.mouseDownNode;

    if (!mouseDownNode) return;

    thisGraph.dragLine.classed("hidden", true);

    if (mouseDownNode !== d){
      // we're in a different node: create new edge for mousedown edge and add to graph
      var newEdge = {source: mouseDownNode, target: d, color: 0, stroke: 0, dir: 1};
      var filtRes = thisGraph.gedges.filter(function(d){
        if (d.source === newEdge.target && d.target === newEdge.source){
          thisGraph.edges.splice(thisGraph.edges.indexOf(d), 1);
        }
        return d.source === newEdge.source && d.target === newEdge.target;
      });
      if (!filtRes[0].length){
        thisGraph.addEdge(newEdge);
        thisGraph.updateGraph();
      }
    } else{
      // we're in the same node
      if (state.justDragged) {
        // dragged, not clicked
        state.justDragged = false;
      } else{
        // clicked, not dragged
        if (d3.event.shiftKey){
          // shift-clicked node: edit text content
          var d3txt = thisGraph.changeTextOfNode(d3node, d);
          var txtNode = d3txt.node();
          thisGraph.selectElementContents(txtNode);
          txtNode.focus();
        } else{
          if (state.selectedEdge){
            thisGraph.removeSelectFromEdge();
          }
          var prevNode = state.selectedNode;

          if (!prevNode || prevNode.id !== d.id){
            thisGraph.replaceSelectNode(d3node, d);
          } else{
            thisGraph.removeSelectFromNode();
          }
        }
      }
    }
    state.mouseDownNode = null;
    return;

  }; // end of gnodes mouseup

  // mousedown on main svg
  GraphCreator.prototype.svgMouseDown = function(){
    this.state.graphMouseDown = true;
  };

  // mouseup on main svg
  GraphCreator.prototype.svgMouseUp = function(){
    var thisGraph = this,
        consts = thisGraph.consts,
        state = thisGraph.state;
    if (state.justScaleTransGraph) {
      // dragged not clicked
      state.justScaleTransGraph = false;
    } else if (state.graphMouseDown && d3.event.shiftKey){
      // clicked not dragged from svg
      var xycoords = d3.mouse(thisGraph.svgG.node()),
          d = {id: thisGraph.idct++, title: consts.defaultTitle, x: xycoords[0], y: xycoords[1], color: 0, stroke: 0};
      thisGraph.addNode(d);
      thisGraph.updateGraph();
      // make title of text immediently editable
      var d3txt = thisGraph.changeTextOfNode(thisGraph.gnodes.filter(function(dval){
        return dval.id === d.id;
      }), d, true),
          txtNode = d3txt.node();
      thisGraph.selectElementContents(txtNode);
      txtNode.focus();
    } else if (state.shiftNodeDrag){
      // dragged from node
      state.shiftNodeDrag = false;
      thisGraph.dragLine.classed("hidden", true);
    }
    state.graphMouseDown = false;
  };

  // keydown on main svg
  GraphCreator.prototype.svgKeyDown = function() {
    var thisGraph = this,
        state = thisGraph.state,
        consts = thisGraph.consts;
    // make sure repeated key presses don't register for each keydown
    //if(state.lastKeyDown !== -1) return;

    state.lastKeyDown = d3.event.keyCode;
    var selectedNode = state.selectedNode,
        selectedEdge = state.selectedEdge;

    switch(d3.event.keyCode) {
    case consts.BACKSPACE_KEY:
    case consts.DELETE_KEY:
      d3.event.preventDefault();
      if (selectedNode){
        thisGraph.deleteNodeAndItsEdges(selectedNode);
        state.selectedNode = null;
        thisGraph.updateGraph();
      } else if (selectedEdge){
        thisGraph.deleteEdge(selectedEdge);
        state.selectedEdge = null;
        thisGraph.updateGraph();
      }
      break;
    case consts.COLOR_KEY:
      var next = (d3.event.shiftKey) ? -1 : +1;
      d3.event.preventDefault();
      if (selectedNode){
        selectedNode.color = (selectedNode.color + next) % consts.COLORS.length;
        thisGraph.updateGraph();
      } else if (selectedEdge){
        selectedEdge.color = (selectedEdge.color + next) % consts.COLORS.length;
        thisGraph.updateGraph();
      }
      break;
    case consts.FILL_KEY:
      var next = (d3.event.shiftKey) ? -1 : +1;
      d3.event.preventDefault();
      if (selectedNode){
        selectedNode.fint = (selectedNode.fint + next) % consts.COLOR_INTENSITIES;
        thisGraph.updateGraph();
      }
      break;
    case consts.STROKE_KEY:
      var next = (d3.event.shiftKey) ? -1 : +1;
      d3.event.preventDefault();
      if (selectedNode){
        selectedNode.stroke = (selectedNode.stroke + next) % consts.STROKES.length;
        thisGraph.updateGraph();
      } else if (selectedEdge){
        selectedEdge.stroke = (selectedEdge.stroke + next) % consts.STROKES.length;
        thisGraph.updateGraph();
      }
      break;
    case consts.DIRECTION_KEY:
      d3.event.preventDefault();
      if (selectedEdge){
        selectedEdge.dir = !selectedEdge.dir;
        thisGraph.updateGraph();
      }
      break;
    case consts.UNDO_KEY:
      if (d3.event.ctrlKey) {
        d3.event.preventDefault();
        thisGraph.undo_manager.undo();
        thisGraph.updateGraph();
      }
      break;
    case consts.REDO_KEY:
      if (d3.event.ctrlKey) {
        d3.event.preventDefault();
        thisGraph.undo_manager.redo();
        thisGraph.updateGraph();
      }
      break;
    }
  };

  GraphCreator.prototype.svgKeyUp = function() {
    this.state.lastKeyDown = -1;
  };

  // call to propagate changes to graph
  GraphCreator.prototype.updateGraph = function(){

    var thisGraph = this,
        consts = thisGraph.consts,
        state = thisGraph.state;

    var MAX_INT_IDX = consts.COLOR_INTENSITIES - 1;

    thisGraph.gedges = thisGraph.gedges.data(thisGraph.edges, function(d){
      return String(d.source.id) + "+" + String(d.target.id);
    });
    var gedges = thisGraph.gedges;
    // update existing gedges
    gedges
      .style('marker-mid', function (d) { return d.dir? 'url(#end-arrow)' : 'none';})
      .classed(consts.selectedClass, function(d){
        return d === state.selectedEdge;
      })
      .attr("d", function(d){
        var middle_x = (d.target.x - d.source.x) / 2 + d.source.x;
        var middle_y = (d.target.y - d.source.y) / 2 + d.source.y;
        return "M" + d.source.x + "," + d.source.y + "L" + middle_x + "," + middle_y + "L" + d.target.x + "," + d.target.y;
      });

    // add new gedges
    gedges.enter()
      .append("path")
      .style('marker-mid', function (d) { return d.dir? 'url(#end-arrow)' : 'none';})
      .classed("link", true)
      .attr("d", function(d){
        var middle_x = (d.target.x - d.source.x) / 2 + d.source.x;
        var middle_y = (d.target.y - d.source.y) / 2 + d.source.y;
        return "M" + d.source.x + "," + d.source.y + "L" + middle_x + "," + middle_y + "L" + d.target.x + "," + d.target.y;
      })
      .on("mousedown", function(d){
        thisGraph.pathMouseDown.call(thisGraph, d3.select(this), d);
        }
      )
      .on("mouseup", function(d){
        state.mouseDownLink = null;
      });

    // remove old links
    gedges.exit().remove();

    gedges
      .style('stroke', function (d) {return consts.COLORS[d.color][MAX_INT_IDX]; })
      .attr("stroke-dasharray", function (d) {return consts.STROKES[d.stroke]; })

    // update existing nodes
    thisGraph.gnodes = thisGraph.gnodes.data(thisGraph.nodes, function(d){ return d.id;});
    thisGraph.gnodes.attr("transform", function(d){return "translate(" + d.x + "," + d.y + ")";});

    // add new nodes
    var newGs= thisGraph.gnodes.enter()
          .append("g");

    newGs.classed(consts.nodeGClass, true)
      .attr("transform", function(d){return "translate(" + d.x + "," + d.y + ")";})
      .on("mouseover", function(d){
        if (state.shiftNodeDrag){
          d3.select(this).classed(consts.connectClass, true);
        }
      })
      .on("mouseout", function(d){
        d3.select(this).classed(consts.connectClass, false);
      })
      .on("mousedown", function(d){
        thisGraph.circleMouseDown.call(thisGraph, d3.select(this), d);
      })
      .on("mouseup", function(d){
        thisGraph.circleMouseUp.call(thisGraph, d3.select(this), d);
      })
      .call(thisGraph.drag);

    newGs.append('rect')
      .attr("width", String(consts.nodeRadius))
      .attr("height", String(consts.nodeRadius));

    newGs.each(function(d){
      thisGraph.insertTitleLinebreaks(d3.select(this), d.title);
    });

    // remove old nodes
    thisGraph.gnodes.exit().remove();

    // Update the size of the nodes to match the size of its text
    thisGraph.gnodes.each(function () {
        thisGraph.update_rectangle_size_based_on_text_size(this);
    });

    thisGraph.gnodes.selectAll('rect')
      .style("stroke", function (d) {return consts.COLORS[d.color][MAX_INT_IDX]; })
      .attr("stroke-dasharray", function (d) {return consts.STROKES[d.stroke]; })
      .style("fill", function (d) {return consts.COLORS[d.color][d.fint];});
  };

  // Given a "g" (group) dom element --a node--, change the size of its rect element to fit the size of its text.
  GraphCreator.prototype.update_rectangle_size_based_on_text_size = function (g_dom_element) {
      var nodeMargin = this.consts.nodeMargin;
      d3.select(g_dom_element).selectAll("rect")
        .attr("width", function(d) { return d3.select(this.parentNode).select("text")[0][0].getBBox().width + nodeMargin*2; })
        .attr("height", function(d) { return d3.select(this.parentNode).select("text")[0][0].getBBox().height + nodeMargin*2; });
      
      d3.select(g_dom_element).selectAll("rect")
        .attr("x", function(d) { return -d3.select(this).attr('width')/2; })
        .attr("y", function(d) { return -d3.select(this).attr('height')/2; });
  };

  GraphCreator.prototype.zoomed = function(){
    this.state.justScaleTransGraph = true;
    d3.select("." + this.consts.graphClass)
      .attr("transform", "translate(" + this.dragSvg.translate() + ") scale(" + this.dragSvg.scale() + ")");
  };

  GraphCreator.prototype.updateWindow = function(svg){
    var docEl = document.documentElement,
        bodyEl = document.getElementsByTagName('body')[0];
    var x = window.innerWidth || docEl.clientWidth || bodyEl.clientWidth;
    var y = window.innerHeight|| docEl.clientHeight|| bodyEl.clientHeight;
    svg.attr("width", x).attr("height", y);
  };

  GraphCreator.prototype.addNode = function (d) {
    var thisGraph = this;
    thisGraph.nodes.push(d);

    thisGraph.undo_manager.add({
            undo: function () {
                thisGraph.deleteNodeAndItsEdges(d);
            },
            redo: function () {
                thisGraph.addNode(d);
            }
        });
  };

  GraphCreator.prototype.deleteNodeAndItsEdges = function (d) {
    var thisGraph = this;
    var nodeAt = thisGraph.nodes.indexOf(d);
    thisGraph.nodes.splice(nodeAt, 1);
    
    // remove edges associated with a node
    var edgesAt = [];
    var edgesToSplice = thisGraph.edges.filter(function(l) {
      return (l.source === d || l.target === d);
    });
    edgesToSplice.map(function(l) {
      var edgeAt = thisGraph.edges.indexOf(l);
      edgesAt.push(edgesAt);
      thisGraph.edges.splice(edgeAt, 1);
    });

    thisGraph.undo_manager.add({
            undo: function () {
                // reinsert the node at the same position
                thisGraph.nodes.splice(nodeAt, 0, d);

                // and its edges too
                edgesToSplice.map(function(l, idx) {
                    var edgeAt = edgesAt[idx];
                    thisGraph.edges.splice(edgeAt, 0, l);
                });
            },
            redo: function () {
                thisGraph.deleteNodeAndItsEdges(d);
            }
        });
  };
  
  GraphCreator.prototype.addEdge = function(e) {
    var thisGraph = this;
    thisGraph.edges.push(e);

    thisGraph.undo_manager.add({
            undo: function () {
                thisGraph.deleteEdge(e);
            },
            redo: function () {
                thisGraph.addEdge(e);
            }
        });
  };

  GraphCreator.prototype.deleteEdge = function (e) {
    var thisGraph = this;
    var edgeAt = thisGraph.edges.indexOf(e);
    thisGraph.edges.splice(edgeAt, 1);
    
    thisGraph.undo_manager.add({
            undo: function () {
                thisGraph.edges.splice(edgeAt, 0, e);
            },
            redo: function () {
                thisGraph.deleteEdge(e);
            }
        });
  };


  var create_svg_helper = function create_svg_helper(el, width, height) {
      var docEl = document.documentElement,
          bodyEl = document.getElementsByTagName('body')[0];

      if (!width) {
          width = window.innerWidth || docEl.clientWidth || bodyEl.clientWidth;
      }

      if (!height) {
          height = window.innerHeight|| docEl.clientHeight|| bodyEl.clientHeight;
      }
  
      var svg = d3.select(el).append("svg")
        .attr("width", width)
        .attr("height", height);

      return svg;
  };

  var load_help_graph = function (thisGraph) {
      var data = '{"nodes":[{"id":2,"title":"...over the canvas to create a node","x":-32.8425874710083,"y":327.1973114013672,"color":0,"stroke":0},{"id":4,"title":"...over a node to edit it","x":82.56795167922974,"y":317.9345703125,"color":0,"stroke":0},{"id":5,"title":"Press left-click in the canvas and drag to move it","x":183.2431640625,"y":103.82405853271484,"color":2,"stroke":0},{"id":6,"title":"Use the mouse\'s wheel to zoom in and out","x":339.21282958984375,"y":102.45789337158203,"color":2,"stroke":0},{"id":7,"title":"Draw a graph","x":-34.29644012451172,"y":104.17717742919922,"color":0,"stroke":0},{"id":10,"title":"...over a node and drag to another node to draw an arrow","x":-181.8009796142578,"y":333.45040130615234,"color":0,"stroke":0},{"id":12,"title":"Press Delete to delete it","x":181.065185546875,"y":370.3305358886719,"color":0,"stroke":0},{"id":13,"title":"Press Center button in the toolbar to center the graph ","x":488.19317626953125,"y":103.96192169189453,"color":2,"stroke":0},{"id":14,"title":"Select a node or an arrow with a left-click","x":317.241943359375,"y":263.88804626464844,"color":0,"stroke":0},{"id":15,"title":"Press shift+left-click over...","x":-33.90104007720947,"y":219.1341094970703,"color":0,"stroke":0},{"id":17,"title":" Left-click and drag to move a node","x":-181.3450927734375,"y":218.22991943359375,"color":0,"stroke":0},{"id":18,"title":"Press ctrl-z to undo the last action","x":-34.092668533325195,"y":436.1949157714844,"color":0,"stroke":0},{"id":19,"title":"Press ctrl-y to redo the last undid action","x":-33.188438415527344,"y":537.9137573242188,"color":0,"stroke":0},{"id":20,"title":"Press C to change its color","x":275.23516845703125,"y":370.43804931640625,"color":0,"stroke":0},{"id":21,"title":"Press S to change the stroke pattern","x":372.23516845703125,"y":376.43804931640625,"color":0,"stroke":0},{"id":22,"title":"Press D to toggle the direction (arrows only)","x":488.23516845703125,"y":375.43804931640625,"color":0,"stroke":0},{"id":23,"title":"Change color, stroke and direction cyclically","x":316.73516845703125,"y":524.1255798339844,"color":0,"stroke":4},{"id":24,"title":"Pressing shift will go backward","x":173.73516845703125,"y":524.1255798339844,"color":0,"stroke":0},{"id":25,"title":"Load/Save the graph and export it to PNG image","x":486.5684814453125,"y":224.29222106933594,"color":2,"stroke":0}],"edges":[{"source":5,"target":6,"color":0,"stroke":0,"dir":true},{"source":6,"target":13,"color":0,"stroke":0,"dir":true},{"source":7,"target":14,"color":0,"stroke":0,"dir":true},{"source":14,"target":12,"color":0,"stroke":0,"dir":true},{"source":7,"target":15,"color":0,"stroke":0,"dir":true},{"source":15,"target":2,"color":0,"stroke":0,"dir":true},{"source":15,"target":4,"color":0,"stroke":0,"dir":true},{"source":7,"target":17,"color":0,"stroke":0,"dir":true},{"source":17,"target":10,"color":0,"stroke":0,"dir":true},{"source":15,"target":10,"color":0,"stroke":0,"dir":true},{"source":10,"target":18,"color":0,"stroke":0,"dir":true},{"source":2,"target":18,"color":0,"stroke":0,"dir":true},{"source":4,"target":18,"color":0,"stroke":0,"dir":true},{"source":12,"target":18,"color":0,"stroke":0,"dir":true},{"source":18,"target":19,"color":0,"stroke":0,"dir":true},{"source":14,"target":20,"color":0,"stroke":0,"dir":true},{"source":14,"target":21,"color":0,"stroke":0,"dir":true},{"source":14,"target":22,"color":0,"stroke":0,"dir":true},{"source":23,"target":20,"color":0,"stroke":4,"dir":true},{"source":23,"target":21,"color":0,"stroke":4,"dir":true},{"source":23,"target":24,"color":0,"stroke":0,"dir":true},{"source":13,"target":25,"color":0,"stroke":0,"dir":1}]}';
      thisGraph.load_graph_from_json(data);
      thisGraph.centerGraph();
  };

  // Save a SVG as a PNG image
  // Based on http://bl.ocks.org/Rokotyan/0556f8facbaf344507cdc45dc3622177
  function save_svg_as_png_image(svg_node, width, height, save_cb) {
      svg_node.setAttribute('xlink', 'http://www.w3.org/1999/xlink');
      add_css_rules_into_svg(svg_node);

      var svg_url = svg_string_as_url(serialize_svg_node(svg_node));
      svg_url_as_image(svg_url, 2*width, 2*height, 'png', save_cb);

      return;

      // helper functions
      function serialize_svg_node(svgNode) {
          var serializer = new XMLSerializer();
          var svgString = serializer.serializeToString(svgNode);
          svgString = svgString.replace(/(\w+)?:?xlink=/g, 'xmlns:xlink='); // Fix root xlink without namespace
          svgString = svgString.replace(/NS\d+:href/g, 'xlink:href'); // Safari NS namespace fix

          return svgString;
      }

      function svg_string_as_url(svg_string) {
          return 'data:image/svg+xml;base64,'+ btoa(unescape(encodeURIComponent(svg_string)));
      }

      // Get the CSS rules of the web page and insert them into the svg node
      // If the CSS rules are local (file://) this will not work on Chrome:
      //    - https://bugs.chromium.org/p/chromium/issues/detail?id=143626
      //    - https://bugs.chromium.org/p/chromium/issues/detail?id=490
      //
      // A workaround is to open Chrome with --allow-file-access-from-files flag
      function add_css_rules_into_svg(svg_node) {
          var extractedCSSText = "";
          for (var i = 0; i < document.styleSheets.length; i++) {
              var s = document.styleSheets[i];

              try {
                  if(!s.cssRules) 
                      continue;
              } catch( e ) {
                  if(e.name !== 'SecurityError') throw e; // for Firefox
                  continue;
              }

              var cssRules = s.cssRules;
              for (var r = 0; r < cssRules.length; r++) {
                  extractedCSSText += cssRules[r].cssText;
              }
          }

          var styleElement = document.createElement("style");
          styleElement.setAttribute("type","text/css"); 
          styleElement.innerHTML = extractedCSSText;

          var refNode = svg_node.hasChildNodes() ? svg_node.children[0] : null;
          svg_node.insertBefore( styleElement, refNode );
      }

      function svg_url_as_image(svg_as_url, width, height, format, callback) {
          var canvas = document.createElement("canvas");
          var context = canvas.getContext("2d");

          canvas.width = width;
          canvas.height = height;

          var image = new Image();
          image.onload = function() {
              context.clearRect ( 0, 0, width, height );
              context.drawImage(image, 0, 0, width, height);

              canvas.toBlob( function(blob) {
                  var filesize = Math.round( blob.length/1024 ) + ' KB';
                  if ( callback ) callback( blob, filesize );
              });
          };

          image.src = svg_as_url;
      }
  }


  // export
  window.GraphCreator = GraphCreator;
  window.create_svg_helper = create_svg_helper;
  window.load_help_graph = load_help_graph;

})(window.d3, window.saveAs, window.Blob, window.UndoManager, window.alertify);
