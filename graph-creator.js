(function(d3, saveAs, Blob, UndoManager){
  "use strict";

  // TODO add user settings
  var settings = {
    appendElSpec: "#graph"
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
        saveEdges.push({source: val.source.id, target: val.target.id});
      });
      var blob = new Blob([window.JSON.stringify({"nodes": thisGraph.nodes, "edges": saveEdges})], {type: "text/plain;charset=utf-8"});
      saveAs(blob, "mydag.json");
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
            var jsonObj = JSON.parse(txtRes);
            thisGraph.deleteGraph(true);
            thisGraph.nodes = jsonObj.nodes;
            thisGraph.setIdCt(jsonObj.nodes.length + 1);
            var newEdges = jsonObj.edges;
            newEdges.forEach(function(e, i){
              newEdges[i] = {source: thisGraph.nodes.filter(function(n){return n.id == e.source;})[0],
                          target: thisGraph.nodes.filter(function(n){return n.id == e.target;})[0]};
            });
            thisGraph.edges = newEdges;
            thisGraph.updateGraph();
          }catch(err){
            window.alert("Error parsing uploaded file\nerror message: " + err.message);
            return;
          }
        };
        filereader.readAsText(uploadFile);

      } else {
        alert("Your browser won't let you save this graph -- try upgrading your browser to IE 10+ or Chrome or Firefox.");
      }

    });

    // handle delete graph
    d3.select("#delete-graph").on("click", function(){
      thisGraph.deleteGraph(false);
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
    editingOpacity: 0.4,
    BACKSPACE_KEY: 8,
    DELETE_KEY: 46,
    ENTER_KEY: 13,
    UNDO_KEY: 90, // Z
    REDO_KEY: 89, // Y
    nodeRadius: 50,
    nodeMargin: 7,
    charWidthPixel: 10,
    lineHeightPixel: 15,
    lowerTextRatio: 1.60,
    upperTextRatio: 4.0,
    zoomMinScale: 0.25,
    zoomMaxScale: 1.5
  };

  /* PROTOTYPE FUNCTIONS */

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

  GraphCreator.prototype.deleteGraph = function(skipPrompt){
    var thisGraph = this,
        doDelete = true;
    if (!skipPrompt){
      doDelete = window.confirm("Press OK to delete this graph");
    }
    if(doDelete){
      thisGraph.nodes = [];
      thisGraph.edges = [];
      thisGraph.updateGraph();
    }
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
  GraphCreator.prototype.changeTextOfNode = function(d3node, d){
    var thisGraph= this,
        consts = thisGraph.consts,
        htmlEl = d3node.node();

    var gnode = d3node.selectAll("rect");
    var original_opacity = gnode.attr("opacity");
    gnode.attr("opacity", thisGraph.consts.editingOpacity);

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
          .attr("width", 8*useHW)
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
            d.title = this.textContent;
            thisGraph.insertTitleLinebreaks(d3node, d.title);
            d3.select(this.parentElement).remove();

            thisGraph.update_rectangle_size_based_on_text_size(d3node[0][0]);
            gnode.attr("opacity", original_opacity);
          });
    return d3txt;
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
      var newEdge = {source: mouseDownNode, target: d};
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
          d = {id: thisGraph.idct++, title: consts.defaultTitle, x: xycoords[0], y: xycoords[1]};
      thisGraph.addNode(d);
      thisGraph.updateGraph();
      // make title of text immediently editable
      var d3txt = thisGraph.changeTextOfNode(thisGraph.gnodes.filter(function(dval){
        return dval.id === d.id;
      }), d),
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
    if(state.lastKeyDown !== -1) return;

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
    case consts.UNDO_KEY:
      if (d3.event.ctrlKey) {
        d3.event.preventDefault();
        console.log("Index before undo: " + thisGraph.undo_manager.getIndex());
        thisGraph.undo_manager.undo();
        thisGraph.updateGraph();
      }
      break;
    case consts.REDO_KEY:
      if (d3.event.ctrlKey) {
        d3.event.preventDefault();
        console.log("Index before redo: " + thisGraph.undo_manager.getIndex());
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

    thisGraph.gedges = thisGraph.gedges.data(thisGraph.edges, function(d){
      return String(d.source.id) + "+" + String(d.target.id);
    });
    var gedges = thisGraph.gedges;
    // update existing gedges
    gedges.style('marker-mid', 'url(#end-arrow)')
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
      .style('marker-mid','url(#end-arrow)')
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

  // export
  window.GraphCreator = GraphCreator;
  window.create_svg_helper = create_svg_helper;   

})(window.d3, window.saveAs, window.Blob, window.UndoManager);
