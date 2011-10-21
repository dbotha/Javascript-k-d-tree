var datastructure = (function() {
	var AXIS_X  = 0;
	var AXIS_Y = 1;
	var K = 2; // I only require a 2d k-d tree & currently I'm too lazy to calculate bounding hyperrectangles, 2d ones will do just fine.
	
	/**
	 * KDTreeNode class that represents a node within a kd-tree. This is an internal class only.
	 * @param points An array of 2d point objects. Point objects must have x & y members: {x:?, y:?}
	 * @returns {KDTree} A balanced KDTree. 
	 */
	function KDTreeNode(point) {
		this.point = point;
		this.leftChild = null;
		this.rightChild = null;
	}
	
	/**
	 * KDTree class that represents a kd-tree data structure
	 * @param points An array of 2d point objects. Point objects must have x & y members: {x:?, y:?}
	 * @returns {KDTree} A balanced KDTree. 
	 */
	function KDTree(points) {
		
		var boundingRect = {
			maxX: -Math.pow(2, 31), 
			minX:  Math.pow(2, 31) - 1, 
			maxY: -Math.pow(2, 31), 
			minY:  Math.pow(2, 31) - 1
		};
		
		for (var i = 0; i < points.length; ++i) {
			boundingRect.minX = Math.min(boundingRect.minX, points[i].x);
			boundingRect.minY = Math.min(boundingRect.minY, points[i].y);
			boundingRect.maxX = Math.max(boundingRect.maxX, points[i].x);
			boundingRect.maxY = Math.max(boundingRect.maxY, points[i].y);
		}
		
		this.rootNode = createKDTree_(points, 0, boundingRect);
	};
	
	/**
	 * Internal recursive function to create a balanced kd-tree datastructure.
	 * @param points An array of 2d point objects. Point objects must have x & y members: {x:?, y:?}
	 * @param depth The depth of the current level that is being constructed
	 * @param boundingRect The rectangle that bounds all points within the current subtree
	 * @returns The root KDTreeNode 
	 */
	function createKDTree_(points, depth, boundingRect) {
		if (points.length == 0) {
			return null;
		}
		
		// select axis based on depth. Axis will cycle between AXIS_X & AXIS_Y.
		var axis = depth % K; 
		
		// sort point list as we need to choose the median point as pivot element
		points.sort(function (a, b) {
			if (axis == AXIS_X) {
				return a.x - b.x;
			} else {
				return a.y - b.y;
			}
		});
		
		var medianIndex = Math.floor(points.length / 2);
		var node = new KDTreeNode(points[medianIndex]);
		node.boundingRect = boundingRect;
		
		// calculate bounding rectangles for the two child nodes.
		var leftChildBoundingRect = {
			minX: boundingRect.minX, 
			maxX: axis == AXIS_X ? node.point.x : boundingRect.maxX, 
			minY: boundingRect.minY, 
			maxY: axis == AXIS_Y ? node.point.y : boundingRect.maxY
		};
		
		var rightChildBoundingRect = {
			minX: axis == AXIS_X ? node.point.x : boundingRect.minX, 
			maxX: boundingRect.maxX, 
			minY: axis == AXIS_Y ? node.point.y : boundingRect.minY, 
			maxY: boundingRect.maxY
		};
		
		// recursively create subtrees
		// TODO: do in place instead of splicing, boo slow & waste of memory...
		node.leftChild  = createKDTree_(points.slice(0, medianIndex), depth + 1, leftChildBoundingRect); 
		node.rightChild = createKDTree_(points.slice(medianIndex + 1), depth + 1, rightChildBoundingRect);
		
		return node;
	}
	
	/**
	 * Finds the nearest neighbour to a point within the k-d tree
	 * @param searchCoord The search point {x:?, y:?} of which the nearest neighbour are desired.
	 * @param opt_consideredPoints Optional empty array which if defined will hold a list of all points visited in the search.
	 * @returns The nearest neighbour point {x:?, y:?} to the searchCoord that was found within the tree.
	 */
	KDTree.prototype.getNearestNeighbour = function(searchCoord, opt_consideredPoints) {
		var results = [];
		this.getNearestNeighbours_(this.rootNode, searchCoord, 0, results, 1, opt_consideredPoints);
		return results.length == 0 ? null : results[0].node.point;
	};
	
	/**
	 * Finds a specified number of nearest neighbours to a point within the k-d tree.
	 * @param searchCoord The search point {x:?, y:?} of which the nearest neighbours are desired.
	 * @param maxResults The maximum number of nearest neighbours to find
	 * @param opt_consideredPoints Optional empty array which if defined will hold a list of all points visited in the search.
	 * @returns The nearest neighbour point {x:?, y:?} to the searchCoord that was found within the tree.
	 */
	KDTree.prototype.getNearestNeighbours = function(searchCoord, maxResults, opt_consideredPoints) {
		var results = [];
		this.getNearestNeighbours_(this.rootNode, searchCoord, 0, results, maxResults, opt_consideredPoints);
	
		// extract the point {x:?, y:?} objects from KDTreeNode objects and put them in the return array. 
		// Naturally this will result in a slower search for large values of maxResults & we also
		// lose the intermediate squared distances that were calculated from each point
		// to the search point. These will need to be calculated again if desired by
		// users of this tree. If greater efficiency is desired we could probably
		// return the internal search node objects that retain this info. It somewhat
		// complicates the public API interface though so I'll accept this inefficiency for now.
		var points = [];
		for (var i = 0; i < results.length; ++i) {
			points.push(results[i].node.point);
		}
		
		return points;
	};
	
	/**
	 * Finds a specified number of nearest neighbour(s) to a point within the k-d tree. This is an internal
	 * recursive function that performs the bulk of the search.
	 * @param currNode A KDTreeNode representing the current node being examined in the search.
	 * @param searchCoord The search point {x:?, y:?} of which the nearest neighbours are desired.
	 * @param depth The depth at which currNode resides within the tree. The root node resides at depth 0, the roots two children at 1, and so on
	 * @param results An array the will get filled with the nearest neighbour results as the search progresses.
	 * @param maxResults The maximum number of nearest neighbours to find
	 * @param opt_consideredPoints Optional empty array which if defined will hold a list of all points visited in the search.
	 */
	KDTree.prototype.getNearestNeighbours_ = function(currNode, searchCoord, depth, results, maxResults, opt_consideredPoints) {
		if (opt_consideredPoints) {
			opt_consideredPoints.push(currNode.point);
		}
		
		var axis = depth % K;
		var currNodeDistanceToDesiredCoord = getSquaredEuclidianDistance(searchCoord.x, searchCoord.y, currNode.point.x, currNode.point.y);
		var bestSeen = {node:currNode, distance: currNodeDistanceToDesiredCoord};
		insertResult_(results, bestSeen, maxResults);
		var searchNodeSplittingCoord = axis == AXIS_X ? searchCoord.x 	 : searchCoord.y;
		var currNodeSplittingCoord   = axis == AXIS_X ? currNode.point.x : currNode.point.y;
		
		var searchLeft    = searchNodeSplittingCoord < currNodeSplittingCoord;
		var targetChild   = searchLeft ? currNode.leftChild  : currNode.rightChild;
		var oppositeChild = searchLeft ? currNode.rightChild : currNode.leftChild;
		
		// search target subtree
		if (targetChild) {
			this.getNearestNeighbours_(targetChild, searchCoord, depth + 1, results, maxResults, opt_consideredPoints);
		}
	
		// check opposite subtree only if current node is better than best seen distance in the splitting plane.
		if (oppositeChild) {
			// find the nearest point to searchCoord on the perimeter of the oppositeChilds boundingRect. This will give us the
			// shortest possible distance to a point into the oppositeChild subtree.
			var toX, toY;
			if (axis == AXIS_X) {
				toX = currNode.point.x;
				toY = searchCoord.y;
				if (searchCoord.y < oppositeChild.boundingRect.minY) {
					toY = oppositeChild.boundingRect.minY;
				} else if (searchCoord.y > oppositeChild.boundingRect.maxY) {
					toY = oppositeChild.boundingRect.maxY;
				}
			} else {
				toY = currNode.point.y;
				toX = searchCoord.x;
				if (searchCoord.x < oppositeChild.boundingRect.minX) {
					toX = oppositeChild.boundingRect.minX;
				} else if (searchCoord.x > oppositeChild.boundingRect.maxX) {
					toX = oppositeChild.boundingRect.maxX;
				}
			}
			
			var squaredDist = getSquaredEuclidianDistance(searchCoord.x, searchCoord.y, toX, toY);
			if (squaredDist <= results[results.length - 1].distance) {
				// right side could contain a better node, need to check.
				this.getNearestNeighbours_(oppositeChild, searchCoord, depth + 1, results, maxResults, opt_consideredPoints);
			}
		}
	};
	
	/**
	 * inserts a result into the results array if it is better than an current result or if max results
	 * have not yet been reached.
	 * @param results A sorted array containing the current best seen nearest neighbour KDTreeNodes
	 * @param insertNode A KDTreeNode to insert into the results array if it's better than a node
	 * currently in the array or if the results array is not yet full
	 * @param maxResults The maximum size that the results array is allowed to reach
	 */
	function insertResult_(results, insertNode, maxResults) {
		// results list is sorted nearest-farthest
		var insertIndex;
		for (insertIndex = results.length - 1; insertIndex >= 0; --insertIndex) {
			var nearestNeighbourNode = results[insertIndex];
			if (insertNode.distance > nearestNeighbourNode.distance) {
				break;
			}
		}
		
		results.splice(insertIndex + 1, 0, insertNode);
		if (results.length > maxResults) {
			results.pop();
		}
	}
	
	/**
	 * A simple distance function that returns the squared distance between two points.
	 */
	function getSquaredEuclidianDistance(x1, y1, x2, y2) {
		var dx = x1 - x2;
		var dy = y1 - y2;
		return dx * dx + dy * dy;
	}
	
	// export the data structure
	var module = {};
	module.KDTree = KDTree;  // KDTree constructor.
	return module;
})();
