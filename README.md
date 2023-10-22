NCL Simulator
=============

This webapp lets you draw and simulate
[Nondeterministic Constraint Logic](https://en.wikipedia.org/wiki/Nondeterministic_constraint_logic)
graphs, which are directed graphs with edge weights of 1 (red) or 2 (blue)
where every node of degree &ge;3 has an incoming weight of &ge;2 and
(in this implementation)
where every node of degree 2 has an incoming weight of &ge;1.

This project was written by Ivan Tadeu Ferreira Antunes Filho
during the 2019 MIT class
[6.892: Algorithmic Lower Bounds: Fun with Hardness Proofs](https://courses.csail.mit.edu/6.892/spring19/).
It is a fork of [Mindcraft](https://github.com/eldipa/Mindcraft),
a mind-mapping tool for drawing directed graphs.

## [Deployed Webapp](https://6892-2019.github.io/ncl-simulator/)

## Usage

* <kbd>Shift</kbd> + click to create a node.
* <kbd>Shift</kbd> + drag to create edge.
* Click on an edge and press <kbd>C</kbd> to change colors.
* <kbd>N</kbd> or press the play button to enter NCL mode.
  * Helper mode (speech bubble) automatically highlights flippable edges.
  * Click on an edge and press <kbd>R</kbd> to flip (reflect) it.
* Drag nodes to move them around
* Drag the canvas to pan around
* Scroll wheel to zoom in/out
* Load/save graph in JSON format via the leftmost buttons

## Development

To run the app locally,
clone the repo and open the `index.html` file with a browser.
You won't need internet access.

If you are using Chrome or Chromium, you will need to open the browser with the `--allow-file-access-from-files` flag; otherwise you will not be able to export the graph as a PNG image. (This a limitation of Chrome/Chromium.)

## License

The main source code
is under the [MIT license](https://opensource.org/licenses/mit-license.html).
See the [`LICENSE.md`](LICENSE.md) file.

The source code is a fork of
[Mindcraft](https://github.com/eldipa/Mindcraft),
which in turn is a fork of
[directed-graph-creator](https://github.com/cjrd/directed-graph-creator),
both of which are under the same MIT license.

The current git repository also includes files that aren't covered by this license and belong to other projects.
You can find them under the [`external/`](external) folder.

To the authors and contributors of those projects, thanks.

Until my knowledge, these are their respective licenses:


**d3**
 - URL: https://d3js.org/d3.v3.min.js
 - Version: 3.5.17
 - Date: 06/19/2016
 - License: BSD 3-clause "New" or "Revised" License

**FileSaver**
 - URL: http://purl.eligrey.com/github/FileSaver.js
 - Version: 1.3.2
 - Date: 02/07/2017
 - License: MIT License

**Javascript-Undo-Manager**
 - URL: https://github.com/ArthurClemens/Javascript-Undo-Manager
 - Version: 1.0.5.
 - Date: 02/07/2017
 - License: MIT License

**JavaScript Canvas to Blob**
 - URL: https://github.com/blueimp/JavaScript-Canvas-to-Blob/blob/master/js/canvas-to-blob.js
 - Version: 3.2.0
 - Date: 08/04/2017
 - License: MIT License

**AlertifyJS**
 - URL: https://github.com/MohammadYounes/AlertifyJS
 - Version: 1.11.0
 - Date: 08/05/2017
 - License: GNU GENERAL PUBLIC LICENSE Version 3

**ColorBrewer**
 - URL: http://colorbrewer.org/
 - Version: 1
 - Date: 08/05/2017
 - License: Apache-Style Software License 2.0

**FontAwesome**
 - URL: https://github.com/FortAwesome/Font-Awesome
 - Version: 4.7.0
 - License: 
    - The Font Awesome font is licensed under the SIL OFL 1.1:
        - http://scripts.sil.org/OFL
    - Font Awesome CSS, LESS, and Sass files are licensed under the MIT License:
        - https://opensource.org/licenses/mit-license.html
    - The Font Awesome documentation is licensed under the CC BY 3.0 License:
        - http://creativecommons.org/licenses/by/3.0/
    - Full details: http://fontawesome.io/license/

