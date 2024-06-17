const APP_ELEMENT_ID = 'app'
const CANVAS_ELEMENT_ID = 'canvas';
const CREATE_INTERMEDIATE_NODE_BUTTON_ID = 'createIntermediateNodeButton';
const SCHEMA_INPUT_TYPE_SELECT_ID = 'schemaInputTypeSelect';
const SCHEMA_INPUT_ID = 'schemaInput';

const PATH_DELIMETER = '.'

const CANVAS_WIDTH = 1000
const CANVAS_HEIGHT = 1000
const MARGIN = 100
const DISTANCE_THRESHOLD = 10

const CANVAS_BORDER_WIDTH = 1;
const CANVAS_BORDER_COLOR = 'black';

const distance = (x1, y1, x2, y2) => Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)

class Model {
    constructor(view) {
        this.data = {
            source: {
                schema: {},
                nodes: [],
                edges: []
            },
            target: {
                schema: {},
                nodes: [],
                edges: []
            },
            intermediate: {
                nodes: [],
                edges: []
            }
        }
        this.view = view;
        this.schemaInputType = 'source'
    }
    schemaToTreeGraph(schema, basePath = ['$'], depth = 0) {
        const nodes = []
        const edges = []

        const newNode = {
            id: basePath.join(PATH_DELIMETER),
            path: basePath,
            depth,
            type: schema.type,
        }
        if (schema.type == 'object') {
            for (let [key, value] of Object.entries(schema?.properties || {})) {
                const path = [...basePath, key];

                edges.push({
                    source: newNode.id,
                    target: path.join(PATH_DELIMETER)
                })

                const subSchemaNodesAndEdges = this.schemaToTreeGraph(value, path, depth + 1)

                nodes.push(...subSchemaNodesAndEdges.nodes)
                edges.push(...subSchemaNodesAndEdges.edges)
            }
        }
        else {
            newNode.leaf = true
        }

        newNode.maxDepth = Math.max(...nodes.map(node => node.depth), depth)
        newNode.leaves = Math.max(nodes.filter(node => node.leaf).length, 1)

        nodes.push(newNode)

        return { nodes, edges }
    }
    updateSchema(schema) {
        this.data[this.schemaInputType] = {
            schema,
            ...this.schemaToTreeGraph(schema)
        }

        this.view.renderSchemaMap(this)

    }
    selectNode(selectedNode) {
        this.selectedNode = selectedNode
    }
    updateMousePosition(x, y) {
        this.mousePosition = { x, y }
        this.view.renderSchemaMap(this)
    }
    createIntermediateEdge(selectedNode) {
        this.data.intermediate.edges.push({
            source: this.selectedNode.id,
            target: selectedNode.id
        })
        this.selectedNode = null
        this.view.renderSchemaMap(this)
    }
    unselectNode() {
        this.selectedNode = null
        this.view.renderSchemaMap(this)

    }
    createIntermediateNode(name) {
        const path = ['intermediate', name]
        this.data.intermediate.nodes.push({
            id: path.join(PATH_DELIMETER),
            path
        })
        this.view.renderSchemaMap(this)
    }
}

class View {
    constructor() {
        this.app = document.getElementById(APP_ELEMENT_ID)


    }

    renderTreeGraph(x, y, w, h, treeGraph, rootNode = null) {
        if (!rootNode) {
            rootNode = treeGraph.nodes.find(node => node.depth == 0)
        }

        if (!rootNode) {
            return
        }

        rootNode.x = x
        rootNode.y = y + h / 2

        this.ctx.fillText(`${rootNode.path[rootNode.path.length - 1]} (${rootNode.type})`, rootNode.x, rootNode.y);

        const children = treeGraph.edges.filter(edge => edge.source == rootNode.id).map(edge => treeGraph.nodes.find(node => node.id == edge.target))
        let currentY = y;

        for (let child of children) {
            const subX = x + (w / (child.maxDepth - child.depth + 1));
            const subY = currentY;
            const subW = w - (subX - x);
            const subH = h * (child.leaves / rootNode.leaves);

            this.renderTreeGraph(subX, subY, subW, subH, treeGraph, child);

            this.ctx.beginPath();
            this.ctx.moveTo(rootNode.x, rootNode.y);
            this.ctx.lineTo(child.x, child.y);
            this.ctx.stroke();

            currentY += subH;
        }

        return treeGraph;
    }

    renderSourceTreeGraph(treeGraph) {
        this.renderTreeGraph(MARGIN, MARGIN, this.canvas.width / 4, this.canvas.height - 2 * MARGIN, treeGraph)
    }

    renderTargetTreeGraph(treeGraph) {
        this.renderTreeGraph(this.canvas.width - MARGIN, MARGIN, -(this.canvas.width / 4), this.canvas.height - 2 * MARGIN, treeGraph)
    }

    renderTemporaryEdge(selectedNode, mousePosition) {
        if (selectedNode) {
            this.ctx.moveTo(selectedNode.x, selectedNode.y)
            this.ctx.lineTo(mousePosition.x, mousePosition.y)
            this.ctx.stroke()
        }
    }

    renderIntermediateEdges(data) {
        for (let edge of data.intermediate.edges) {
            const sourceNodes = [...data.source.nodes, ...data.intermediate.nodes]
            const targetNodes = [...data.target.nodes, ...data.intermediate.nodes]

            const source = sourceNodes.find(node => node.id == edge.source)
            const target = targetNodes.find(node => node.id == edge.target)

            console.log(sourceNodes, targetNodes, edge)

            this.ctx.beginPath()
            this.ctx.moveTo(source.x, source.y)
            this.ctx.lineTo(target.x, target.y)
            this.ctx.stroke()
        }
    }

    renderIntermediateNodes(nodes) {
        let x = this.canvas.width / 2
        let currentY = MARGIN
        const dy = (this.canvas.height - 2 * MARGIN) / nodes.length

        for (let node of nodes) {
            node.x = x
            node.y = currentY
            this.ctx.fillText(node.path[node.path.length - 1], node.x, node.y)
            currentY += dy
        }
    }

    renderSchemaMap(model) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
        this.renderSourceTreeGraph(model.data.source)
        this.renderTargetTreeGraph(model.data.target)
        this.renderTemporaryEdge(model.selectedNode, model.mousePosition)
        this.renderIntermediateEdges(model.data)
        this.renderIntermediateNodes(model.data.intermediate.nodes)
    }

    renderSchemaMapDOM() {
        this.canvas = document.createElement('canvas')
        this.createIntermediateNodeButton = document.createElement('button')
        this.schemaInputTypeSelect = document.createElement('select')
        this.schemaInput = document.createElement('textarea')

        this.canvas.id = CANVAS_ELEMENT_ID
        this.canvas.style.border = `${CANVAS_BORDER_WIDTH}px solid ${CANVAS_BORDER_COLOR}`
        this.canvas.width = CANVAS_WIDTH
        this.canvas.height = CANVAS_HEIGHT
        this.createIntermediateNodeButton.id = CREATE_INTERMEDIATE_NODE_BUTTON_ID
        this.createIntermediateNodeButton.innerHTML = 'Create Intermediate Node'
        this.schemaInputTypeSelect.id = SCHEMA_INPUT_TYPE_SELECT_ID
        this.schemaInputTypeSelect.innerHTML = `
            <option value="source">Source</option>
            <option value="target">Target</option>
        `
        this.schemaInput.id = SCHEMA_INPUT_ID
        this.schemaInput.style.width = '100%'
        this.schemaInput.style.height = '200px'
        this.ctx = this.canvas.getContext('2d')

        this.app.appendChild(this.canvas)
        this.app.appendChild(this.createIntermediateNodeButton)
        this.app.appendChild(this.schemaInputTypeSelect)
        this.app.appendChild(this.schemaInput)
    }
}

class Controller {
    constructor(model) {
        this.app = document.getElementById(APP_ELEMENT_ID)
        this.model = model


    }
    handleCanvasMouseDown(event) {
        const rect = event.target.getBoundingClientRect()
        let x = event.clientX - rect.left;
        let y = event.clientY - rect.top;

        const nodes = [...this.model.data.source.nodes, ...this.model.data.intermediate.nodes]
        let selectedNode = nodes.find(node => distance(x, y, node.x, node.y) < DISTANCE_THRESHOLD)
        if (selectedNode) {
            console.log(selectedNode)
            this.model.selectNode(selectedNode)
        }
    }

    handleCanvasMouseMove(event) {
        if (this.model.selectedNode) {
            const rect = event.target.getBoundingClientRect()
            let x = event.clientX - rect.left;
            let y = event.clientY - rect.top;

            this.model.updateMousePosition(x, y)
        }


    }

    handleCanvasMouseUp(event) {
        const rect = event.target.getBoundingClientRect()
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        const nodes = [...this.model.data.target.nodes, ...this.model.data.intermediate.nodes]

        const selectedNode = nodes.find(node => distance(x, y, node.x, node.y) < DISTANCE_THRESHOLD)

        if (selectedNode) {
            this.model.createIntermediateEdge(selectedNode)
        }
        else {
            this.model.unselectNode()
        }

    }

    handleCreateIntermediateNodeButtonClick(event) {
        let name = prompt('Enter the name of the intermediate node')
        this.model.createIntermediateNode(name)
    }

    handleSchemaInputTypeSelectChange(event) {
        this.model.schemaInputType = event.target.value
    }

    handleSchemaInputChange(event) {
        console.log(event)
        this.model.updateSchema(JSON.parse(event.target.value))
    }

    initializeSchemaMapDOM() {
        this.canvas = document.getElementById(CANVAS_ELEMENT_ID)
        this.createIntermediateNodeButton = document.getElementById(CREATE_INTERMEDIATE_NODE_BUTTON_ID)
        this.schemaInputTypeSelect = document.getElementById(SCHEMA_INPUT_TYPE_SELECT_ID)
        this.schemaInput = document.getElementById(SCHEMA_INPUT_ID)

        this.canvas.onmousedown = event => this.handleCanvasMouseDown(event)
        this.canvas.onmousemove = event => this.handleCanvasMouseMove(event)
        this.canvas.onmouseup = event => this.handleCanvasMouseUp(event)

        this.createIntermediateNodeButton.onclick = event => this.handleCreateIntermediateNodeButtonClick(event)

        this.schemaInputTypeSelect.onchange = event => this.handleSchemaInputTypeSelectChange(event)

        this.schemaInput.onchange = event => this.handleSchemaInputChange(event)
    }
}

const view = new View()
const model = new Model(view)
const controller = new Controller(model)

view.renderSchemaMapDOM();
controller.initializeSchemaMapDOM();
