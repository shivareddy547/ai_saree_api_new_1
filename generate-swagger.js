#!/usr/bin/env node

const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const glob = require('glob');
const dotenv = require('dotenv');

class SwaggerGenerator {
    constructor(appPath, options = {}) {
        this.appPath = path.resolve(appPath);

        // Load .env file
        const envPath = path.join(this.appPath, '.env');
        if (fs.existsSync(envPath)) {
            const envConfig = dotenv.parse(fs.readFileSync(envPath, 'utf8'));
            process.env = { ...process.env, ...envConfig };
        }

        this.port = options.port || process.env.PORT || 5000;
        this.host = options.host || process.env.HOST || 'localhost';
        this.publicDir = path.join(this.appPath, 'public', 'api-docs');
        this.apiBasePath = options.apiBasePath || '/api';

        // Data storage
        this.routes = [];
        this.endpoints = [];
        this.controllers = {};
        this.services = {};
        this.models = {};
        this.projectName = options.projectName || process.env.PROJECT_NAME || 'Auth API';

        console.log(`\n📡 API Configuration: http://${this.host}:${this.port}${this.apiBasePath}`);
    }

    async run() {
        console.log('\n🚀 Generating Swagger Documentation...');
        console.log('='.repeat(60));

        try {
            await this.analyzeModels();
            await this.analyzeServices();
            await this.analyzeControllers();
            await this.analyzeRoutes();
            await this.generateEndpoints();
            await this.generateSwaggerFiles();
            await this.createPublicHtml();

            console.log('\n' + '='.repeat(60));
            console.log('✅ Swagger Documentation Generated Successfully!');
            console.log(`📁 Location: ${this.publicDir}`);
            console.log(`🌐 URL: http://${this.host}:${this.port}/api-docs`);
            console.log('='.repeat(60));

        } catch (error) {
            console.error('\n❌ Error generating documentation:', error.message);
            console.error(error.stack);
            throw error;
        }
    }

    async analyzeModels() {
        console.log('\n🔍 Analyzing models...');

        const modelPaths = [
            path.join(this.appPath, 'models', '**', '*.js'),
            path.join(this.appPath, 'src', 'models', '**', '*.js')
        ];

        for (const pattern of modelPaths) {
            const files = glob.sync(pattern, { absolute: true });
            for (const file of files) {
                await this.parseModelFile(file);
            }
        }

        console.log(`✅ Found ${Object.keys(this.models).length} models`);
    }

    async parseModelFile(filePath) {
        try {
            const content = await fsPromises.readFile(filePath, 'utf8');
            const modelName = path.basename(filePath, '.js');
            const attributes = {};

            // Parse Sequelize model attributes
            const defineMatch = content.match(/sequelize\.define\([^,]+,\s*{([^}]+)}/s);
            if (defineMatch) {
                const attrStr = defineMatch[1];
                const attrRegex = /(\w+):\s*{/g;
                let match;
                while ((match = attrRegex.exec(attrStr)) !== null) {
                    const attrName = match[1];
                    const typeMatch = attrStr.substring(match.index, match.index + 200).match(/type:\s*Sequelize\.(\w+)/);
                    const type = typeMatch ? typeMatch[1].toLowerCase() : 'string';
                    attributes[attrName] = this.mapSequelizeType(type);
                }
            }

            if (Object.keys(attributes).length > 0) {
                this.models[modelName] = { name: modelName, attributes };
                console.log(`  ✓ Model: ${modelName} (${Object.keys(attributes).length} fields)`);
            }
        } catch (error) {
            // Silently skip
        }
    }

    async analyzeServices() {
        console.log('\n🔍 Analyzing services...');

        const servicePaths = [
            path.join(this.appPath, 'src', 'services', '**', '*.js'),
            path.join(this.appPath, 'services', '**', '*.js')
        ];

        for (const pattern of servicePaths) {
            const files = glob.sync(pattern, { absolute: true });
            for (const file of files) {
                await this.parseServiceFile(file);
            }
        }

        console.log(`✅ Found ${Object.keys(this.services).length} services`);
    }

    async parseServiceFile(filePath) {
        try {
            const content = await fsPromises.readFile(filePath, 'utf8');
            const serviceName = path.basename(filePath, '.js').replace('Service', '').toLowerCase();
            const functions = {};

            // Match both exports.functionName = async (params) => { ... } and exports.functionName = async ({ param }) => { ... }
            const funcRegex = /exports\.(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>?\s*{([^}]*)}/gs;
            let match;

            while ((match = funcRegex.exec(content)) !== null) {
                const funcName = match[1];
                const paramsStr = match[2];
                const funcBody = match[3];

                let params = [];

                // Check for destructured parameters in the function signature
                if (paramsStr.includes('{') && paramsStr.includes('}')) {
                    const destructured = paramsStr.match(/{([^}]+)}/);
                    if (destructured) {
                        const destructuredParams = destructured[1].split(',').map(p => p.trim());
                        params = destructuredParams;
                        console.log(`    ✓ Found destructured params in ${funcName}: ${params.join(', ')}`);
                    }
                } else if (paramsStr && paramsStr.trim() !== '') {
                    params = paramsStr.split(',').map(p => p.trim());
                }

                // If no params in signature, look for destructuring in function body
                if (params.length === 0) {
                    const destructureInBody = funcBody.match(/const\s+{([^}]+)}\s*=\s*(\w+)/);
                    if (destructureInBody) {
                        const destructuredParams = destructureInBody[1].split(',').map(p => p.trim());
                        params = destructuredParams;
                        console.log(`    ✓ Found destructured params in body of ${funcName}: ${params.join(', ')}`);
                    }
                }

                if (params.length > 0) {
                    functions[funcName] = { name: funcName, parameters: params };
                    console.log(`  ✓ Service function: ${funcName} -> params: [${params.join(', ')}]`);
                } else {
                    functions[funcName] = { name: funcName, parameters: [] };
                    console.log(`  ✓ Service function: ${funcName} -> no params detected`);
                }
            }

            if (Object.keys(functions).length > 0) {
                this.services[serviceName] = { name: serviceName, functions };
            }
        } catch (error) {
            console.log(`  ⚠️ Could not parse service ${filePath}:`, error.message);
        }
    }

    async analyzeControllers() {
        console.log('\n🔍 Analyzing controllers...');

        const controllerPaths = [
            path.join(this.appPath, 'src', 'controllers', '**', '*.js'),
            path.join(this.appPath, 'controllers', '**', '*.js')
        ];

        for (const pattern of controllerPaths) {
            const files = glob.sync(pattern, { absolute: true });
            for (const file of files) {
                await this.parseControllerFile(file);
            }
        }

        console.log(`✅ Found ${Object.keys(this.controllers).length} controllers`);
    }

    async parseControllerFile(filePath) {
        try {
            const content = await fsPromises.readFile(filePath, 'utf8');
            const controllerName = path.basename(filePath, '.js').replace('Controller', '').toLowerCase();
            const functions = {};

            const funcRegex = /(?:exports|module\.exports)\.(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)/g;
            let match;

            while ((match = funcRegex.exec(content)) !== null) {
                const funcName = match[1];
                const paramsStr = match[2];
                const params = this.parseParams(paramsStr);
                functions[funcName] = { name: funcName, parameters: params };
                console.log(`  ✓ Controller function: ${funcName} -> params: [${params.join(', ')}]`);
            }

            if (Object.keys(functions).length > 0) {
                this.controllers[controllerName] = { name: controllerName, functions };
            }
        } catch (error) {
            console.log(`  ⚠️ Could not parse controller ${filePath}:`, error.message);
        }
    }

    async analyzeRoutes() {
        console.log('\n🔍 Analyzing routes...');

        const routePaths = [
            path.join(this.appPath, 'src', 'routes', '**', '*.js'),
            path.join(this.appPath, 'routes', '**', '*.js')
        ];

        for (const pattern of routePaths) {
            const files = glob.sync(pattern, { absolute: true });
            for (const file of files) {
                await this.parseRouteFile(file);
            }
        }

        console.log(`✅ Found ${this.routes.length} routes`);

        if (this.routes.length > 0) {
            console.log('\n📋 Routes found:');
            this.routes.forEach(route => {
                console.log(`  ${route.method} ${route.path} -> ${route.controller}.${route.function}`);
            });
        }
    }

    async parseRouteFile(filePath) {
        try {
            const content = await fsPromises.readFile(filePath, 'utf8');

            // Match router.METHOD('/path', controller.function)
            const routeRegex = /router\.(get|post|put|patch|delete)\(['"]([^'"]+)['"],\s*(\w+\.\w+)/g;
            let match;

            while ((match = routeRegex.exec(content)) !== null) {
                const method = match[1].toUpperCase();
                let path = match[2];
                const handler = match[3];

                // Build full path - FIXED: Handle base path correctly
                let fullPath = path;

                // If path doesn't start with /api/auth, check if it should
                if (!path.startsWith('/api/')) {
                    // If it's an auth route, ensure it's under /api/auth
                    if (path.includes('signup') || path.includes('login') ||
                        path.includes('refresh') || path.includes('password')) {
                        fullPath = `/api/auth${path.startsWith('/') ? path : '/' + path}`;
                    } else {
                        // For other routes, just prepend /api if needed
                        fullPath = `/api${path.startsWith('/') ? path : '/' + path}`;
                    }
                }

                const [controllerName, functionName] = handler.split('.');

                this.routes.push({
                    method,
                    path: fullPath,
                    controller: controllerName.toLowerCase(),
                    function: functionName,
                    filePath
                });
            }
        } catch (error) {
            console.log(`  ⚠️ Could not parse route file ${filePath}:`, error.message);
        }
    }

    parseParams(paramsStr) {
        if (!paramsStr || paramsStr.trim() === '') return [];

        let cleaned = paramsStr.trim();
        if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
            cleaned = cleaned.slice(1, -1);
        }

        const params = cleaned.split(',').map(p => p.trim());
        const allParams = [];

        for (const param of params) {
            if (param.includes(':')) {
                const parts = param.split(':');
                allParams.push(parts[0].trim());
            } else if (param && param !== 'req' && param !== 'res' && param !== 'next') {
                allParams.push(param);
            }
        }

        return allParams;
    }

    async generateEndpoints() {
        console.log('\n🔄 Generating endpoints with parameters...');

        for (const route of this.routes) {
            const endpoint = await this.createEndpointFromRoute(route);
            if (endpoint) {
                this.endpoints.push(endpoint);
                const paramCount = endpoint.requestBody ?
                    Object.keys(endpoint.requestBody.content['application/json'].schema.properties).length : 0;
                console.log(`  ✓ ${endpoint.method} ${endpoint.path} (${paramCount} parameters in body)`);
            }
        }

        console.log(`✅ Generated ${this.endpoints.length} endpoints`);
    }

    async createEndpointFromRoute(route) {
        // Get service functions (these contain the actual parameters)
        let serviceFunc = null;
        for (const service of Object.values(this.services)) {
            if (service.functions[route.function]) {
                serviceFunc = service.functions[route.function];
                break;
            }
        }

        // Get controller functions
        const controller = this.controllers[route.controller];
        const controllerFunc = controller?.functions?.[route.function];

        // Extract parameters from service function
        let params = [];

        if (serviceFunc && serviceFunc.parameters.length > 0) {
            params = serviceFunc.parameters.map(param => this.createParam(param));
            console.log(`  📝 ${route.function} parameters from service: ${params.map(p => p.name).join(', ')}`);
        } else if (controllerFunc && controllerFunc.parameters.length > 0) {
            params = controllerFunc.parameters.map(param => this.createParam(param));
            console.log(`  📝 ${route.function} parameters from controller: ${params.map(p => p.name).join(', ')}`);
        }

        // If still no params, use defaults based on route
        if (params.length === 0) {
            if (route.path.includes('signup')) {
                params = [
                    this.createParam('email', 'string', 'User email address', 'user@example.com'),
                    this.createParam('password', 'string', 'User password', 'password123', 'password'),
                    this.createParam('name', 'string', 'Full name', 'John Doe')
                ];
                console.log(`  📝 ${route.function} using default signup params`);
            } else if (route.path.includes('login/email')) {
                params = [
                    this.createParam('email', 'string', 'User email address', 'user@example.com'),
                    this.createParam('password', 'string', 'User password', 'password123', 'password')
                ];
                console.log(`  📝 ${route.function} using default login params`);
            } else if (route.path.includes('login/phone/send-otp')) {
                params = [
                    this.createParam('phoneNumber', 'string', 'Phone number with country code', '+1234567890')
                ];
                console.log(`  📝 ${route.function} using default phone OTP params`);
            } else if (route.path.includes('login/phone/verify')) {
                params = [
                    this.createParam('phoneNumber', 'string', 'Phone number with country code', '+1234567890'),
                    this.createParam('otp', 'string', '6-digit OTP code', '123456')
                ];
                console.log(`  📝 ${route.function} using default phone verify params`);
            } else if (route.path.includes('refresh')) {
                params = [
                    this.createParam('refreshToken', 'string', 'Refresh token', 'your-refresh-token-here')
                ];
                console.log(`  📝 ${route.function} using default refresh params`);
            } else if (route.path.includes('forgot-password')) {
                params = [
                    this.createParam('email', 'string', 'User email address', 'user@example.com')
                ];
                console.log(`  📝 ${route.function} using default forgot password params`);
            } else if (route.path.includes('reset-password')) {
                params = [
                    this.createParam('token', 'string', 'Password reset token', 'reset-token-from-email'),
                    this.createParam('newPassword', 'string', 'New password', 'newPassword123', 'password')
                ];
                console.log(`  📝 ${route.function} using default reset password params`);
            }
        }

        // Generate request body for POST/PUT/PATCH
        let requestBody = null;
        if (['POST', 'PUT', 'PATCH'].includes(route.method) && params.length > 0) {
            requestBody = this.generateRequestBody(params, route);
        }

        // Extract path parameters
        const pathParams = this.extractPathParams(route.path);

        // Determine if auth endpoint
        const isAuth = route.path.includes('/auth/');

        return {
            path: route.path,
            method: route.method,
            summary: this.generateSummary(route, isAuth),
            description: this.generateDescription(route, params, isAuth),
            tags: isAuth ? ['Authentication'] : [this.capitalizeFirst(route.controller)],
            parameters: pathParams.map(p => ({
                name: p,
                in: 'path',
                required: true,
                schema: { type: 'string' },
                description: `${p} parameter`,
                example: this.getPathParamExample(p)
            })),
            requestBody: requestBody,
            responses: this.generateResponses(route.method, isAuth),
            isAuth: isAuth
        };
    }

    createParam(name, type = 'string', description = '', example = null, format = null) {
        const param = {
            name,
            type,
            description: description || `${name} field`,
            example: example || this.getParamExample(name)
        };
        if (format) param.format = format;
        return param;
    }

    generateRequestBody(params, route) {
        if (!params || params.length === 0) return null;

        const properties = {};
        const required = [];

        for (const param of params) {
            const prop = {
                type: param.type,
                description: param.description,
                example: param.example
            };
            if (param.format) prop.format = param.format;
            properties[param.name] = prop;

            // Mark as required for common fields
            if (['email', 'password', 'name', 'phoneNumber', 'otp', 'token', 'newPassword', 'refreshToken'].includes(param.name)) {
                required.push(param.name);
            }
        }

        // Create example object
        const example = {};
        for (const [key, value] of Object.entries(properties)) {
            example[key] = value.example;
        }

        return {
            required: required,
            content: {
                'application/json': {
                    schema: {
                        type: 'object',
                        properties: properties,
                        required: required
                    },
                    example: example
                }
            },
            description: `${route.method} request body with required fields`
        };
    }

    extractPathParams(path) {
        const params = [];
        const regex = /:(\w+)/g;
        let match;
        while ((match = regex.exec(path)) !== null) {
            params.push(match[1]);
        }
        return params;
    }

    getPathParamExample(param) {
        const examples = { id: 1, userId: 1, productId: 'prod_123' };
        return examples[param] || param;
    }

    getParamExample(paramName) {
        const examples = {
            email: 'user@example.com',
            password: 'password123',
            name: 'John Doe',
            phoneNumber: '+1234567890',
            otp: '123456',
            refreshToken: 'your-refresh-token-here',
            token: 'reset-token-from-email',
            newPassword: 'newPassword123'
        };
        return examples[paramName] || `example_${paramName}`;
    }

    generateSummary(route, isAuth) {
        const path = route.path;

        if (isAuth) {
            if (path.includes('login/email')) return 'Login with Email and Password';
            if (path.includes('login/phone/send-otp')) return 'Send OTP for Phone Login';
            if (path.includes('login/phone/verify')) return 'Verify OTP and Login with Phone';
            if (path.includes('signup')) return 'User Registration';
            if (path.includes('refresh')) return 'Refresh Access Token';
            if (path.includes('logout-all')) return 'Logout from All Devices';
            if (path.includes('logout')) return 'User Logout';
            if (path.includes('forgot-password')) return 'Forgot Password - Request Reset';
            if (path.includes('reset-password')) return 'Reset Password';
        }

        const action = path.split('/').pop();
        return `${route.method} ${action.charAt(0).toUpperCase() + action.slice(1)}`;
    }

    generateDescription(route, params, isAuth) {
        const path = route.path;

        if (isAuth) {
            if (path.includes('login/email')) {
                return 'Authenticate user with email and password. Returns access token and refresh token.';
            }
            if (path.includes('login/phone/send-otp')) {
                return 'Send a 6-digit OTP to the provided phone number for authentication.';
            }
            if (path.includes('login/phone/verify')) {
                return 'Verify the OTP sent to phone number and complete login. Returns access token and refresh token.';
            }
            if (path.includes('signup')) {
                const paramList = params.map(p => p.name).join(', ');
                return `Create a new user account. Required fields: ${paramList}`;
            }
            if (path.includes('refresh')) {
                return 'Get a new access token using a valid refresh token.';
            }
            if (path.includes('forgot-password')) {
                return 'Request a password reset email. A reset link will be sent to the provided email address.';
            }
            if (path.includes('reset-password')) {
                return 'Reset password using the token received in email.';
            }
            if (path.includes('logout-all')) {
                return 'Logout from all active sessions and devices.';
            }
            if (path.includes('logout')) {
                return 'Logout from current session.';
            }
        }

        const paramList = params.map(p => p.name).join(', ');
        return paramList ? `${route.method} request with body parameters: ${paramList}` : `${route.method} request`;
    }

    generateResponses(method, isAuth) {
        const responses = {
            '500': {
                description: 'Internal Server Error',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                error: { type: 'string', example: 'Internal Server Error' },
                                message: { type: 'string', example: 'Something went wrong' }
                            }
                        }
                    }
                }
            }
        };

        if (!isAuth) {
            responses['401'] = {
                description: 'Unauthorized',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                error: { type: 'string', example: 'Unauthorized' },
                                message: { type: 'string', example: 'Invalid or missing authentication token' }
                            }
                        }
                    }
                }
            };
        }

        if (method === 'POST') {
            // Login specific response
            if (isAuth) {
                responses['200'] = {
                    description: 'Operation successful',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    accessToken: { type: 'string', description: 'JWT access token' },
                                    refreshToken: { type: 'string', description: 'Refresh token' },
                                    user: {
                                        type: 'object',
                                        properties: {
                                            id: { type: 'integer' },
                                            email: { type: 'string' },
                                            name: { type: 'string' },
                                            phoneNumber: { type: 'string' }
                                        }
                                    },
                                    message: { type: 'string' }
                                }
                            }
                        }
                    }
                };
            } else {
                responses['201'] = {
                    description: 'Created',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    message: { type: 'string', example: 'Resource created successfully' },
                                    data: { type: 'object' }
                                }
                            }
                        }
                    }
                };
            }

            responses['400'] = {
                description: 'Bad Request - Validation Error',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                error: { type: 'string', example: 'Validation Error' },
                                message: { type: 'string', example: 'Invalid request data' }
                            }
                        }
                    }
                }
            };
        } else if (method === 'GET') {
            responses['200'] = {
                description: 'Success',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                data: { type: ['object', 'array'] },
                                meta: {
                                    type: 'object',
                                    properties: {
                                        page: { type: 'integer', example: 1 },
                                        limit: { type: 'integer', example: 20 },
                                        total: { type: 'integer', example: 100 }
                                    }
                                }
                            }
                        }
                    }
                }
            };
            responses['404'] = {
                description: 'Not Found',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                error: { type: 'string', example: 'Not Found' },
                                message: { type: 'string', example: 'Resource not found' }
                            }
                        }
                    }
                }
            };
        } else if (method === 'DELETE') {
            responses['204'] = { description: 'No Content - Successfully deleted' };
            responses['404'] = {
                description: 'Not Found',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                error: { type: 'string', example: 'Not Found' },
                                message: { type: 'string', example: 'Resource not found' }
                            }
                        }
                    }
                }
            };
        }

        return responses;
    }

    mapSequelizeType(type) {
        const map = {
            'STRING': 'string',
            'INTEGER': 'integer',
            'BIGINT': 'integer',
            'BOOLEAN': 'boolean',
            'DATE': 'string',
            'DATEONLY': 'string',
            'FLOAT': 'number',
            'DOUBLE': 'number',
            'DECIMAL': 'number',
            'TEXT': 'string',
            'UUID': 'string'
        };
        return map[type] || 'string';
    }

    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    async generateSwaggerFiles() {
        console.log('\n📝 Generating Swagger files...');

        const swaggerSpec = {
            openapi: '3.0.0',
            info: {
                title: this.projectName,
                version: '1.0.0',
                description: 'Auto-generated API documentation from code analysis',
                contact: {
                    name: 'API Support',
                    email: 'support@example.com'
                }
            },
            servers: [
                {
                    url: `http://${this.host}:${this.port}`,
                    description: 'Development server'
                },
                {
                    url: `https://${this.host}:${this.port}`,
                    description: 'Production server (HTTPS)'
                }
            ],
            paths: {},
            components: {
                securitySchemes: {
                    bearerAuth: {
                        type: 'http',
                        scheme: 'bearer',
                        bearerFormat: 'JWT',
                        description: 'Enter your JWT token'
                    }
                }
            },
            tags: [
                { name: 'Authentication', description: 'Authentication endpoints for user management' }
            ]
        };

        // Add unique tags from controllers
        const uniqueTags = new Set();
        for (const endpoint of this.endpoints) {
            endpoint.tags.forEach(tag => uniqueTags.add(tag));
        }

        for (const tag of uniqueTags) {
            if (tag !== 'Authentication' && !swaggerSpec.tags.find(t => t.name === tag)) {
                swaggerSpec.tags.push({
                    name: tag,
                    description: `${tag} related operations`
                });
            }
        }

        // Build paths
        for (const endpoint of this.endpoints) {
            const path = endpoint.path;
            const method = endpoint.method.toLowerCase();

            if (!swaggerSpec.paths[path]) swaggerSpec.paths[path] = {};

            const operation = {
                summary: endpoint.summary,
                description: endpoint.description,
                tags: endpoint.tags,
                parameters: endpoint.parameters,
                responses: endpoint.responses
            };

            if (endpoint.requestBody) operation.requestBody = endpoint.requestBody;
            if (!endpoint.isAuth && endpoint.method !== 'POST' && endpoint.method !== 'GET') {
                operation.security = [{ bearerAuth: [] }];
            }

            swaggerSpec.paths[path][method] = operation;
        }

        // Create public directory
        await fsPromises.mkdir(this.publicDir, { recursive: true });

        // Save swagger.json
        const jsonPath = path.join(this.publicDir, 'swagger.json');
        await fsPromises.writeFile(jsonPath, JSON.stringify(swaggerSpec, null, 2));
        console.log(`✅ Saved: ${jsonPath}`);

        // Save swagger.yaml
        const yamlPath = path.join(this.publicDir, 'swagger.yaml');
        const yamlStr = yaml.dump(swaggerSpec, { indent: 2, lineWidth: -1 });
        await fsPromises.writeFile(yamlPath, yamlStr);
        console.log(`✅ Saved: ${yamlPath}`);

        // Log the generated endpoints for debugging
        console.log('\n📋 Generated Swagger Endpoints:');
        for (const [path, methods] of Object.entries(swaggerSpec.paths)) {
            for (const [method, details] of Object.entries(methods)) {
                const hasBody = details.requestBody ? '✓ has body' : '✗ no body';
                console.log(`  ${method.toUpperCase()} ${path} - ${hasBody}`);
            }
        }
    }

    async createPublicHtml() {
        console.log('\n📄 Creating HTML interface with refresh button...');

        const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API Documentation - ${this.projectName}</title>
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
        }

        .refresh-btn-container {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 10000;
        }

        .refresh-btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 50px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            gap: 8px;
            font-family: monospace;
        }

        .refresh-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0,0,0,0.3);
            background: linear-gradient(135deg, #5a67d8 0%, #6b46a0 100%);
        }

        .refresh-btn:active {
            transform: translateY(0);
        }

        .refresh-btn.spinning svg {
            animation: spin 0.5s linear;
        }

        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }

        .status-indicator {
            position: fixed;
            bottom: 20px;
            left: 20px;
            z-index: 10000;
            background: rgba(0,0,0,0.8);
            color: #00ff88;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 12px;
            font-family: monospace;
            backdrop-filter: blur(10px);
            pointer-events: none;
        }

        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10001;
            background: #00ff88;
            color: #000;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            transform: translateX(400px);
            transition: transform 0.3s ease;
            font-family: monospace;
        }

        .notification.show {
            transform: translateX(0);
        }

        .notification.error {
            background: #ff4444;
            color: white;
        }

        .notification.warning {
            background: #ffaa00;
            color: #000;
        }

        .loading-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.7);
            z-index: 9999;
            display: none;
            justify-content: center;
            align-items: center;
            backdrop-filter: blur(5px);
        }

        .loading-overlay.active {
            display: flex;
        }

        .spinner {
            width: 50px;
            height: 50px;
            border: 4px solid rgba(255,255,255,0.3);
            border-top-color: #fff;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>

    <div class="refresh-btn-container">
        <button class="refresh-btn" id="refreshBtn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M23 4V10H17M1 20V14H7M3.51 9.00001C4.15817 7.00013 5.38733 5.24778 7.03341 3.95927C8.6795 2.67076 10.6642 1.90976 12.7347 1.77379C14.8052 1.63782 16.8643 2.13347 18.6468 3.19011C20.4294 4.24675 21.8497 5.81335 22.73 7.68001M20.49 15C19.8418 16.9999 18.6127 18.7522 16.9666 20.0407C15.3205 21.3292 13.3358 22.0902 11.2653 22.2262C9.19476 22.3622 7.13568 21.8665 5.35316 20.8099C3.57064 19.7533 2.15027 18.1867 1.27 16.32" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Refresh Documentation
        </button>
    </div>

    <div class="status-indicator" id="statusIndicator">
        📡 Swagger v1.0.0 | Last updated: <span id="lastUpdated">--:--:--</span>
    </div>

    <div class="loading-overlay" id="loadingOverlay">
        <div class="spinner"></div>
    </div>

    <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-standalone-preset.js"></script>

    <script>
        let ui = null;

        function showNotification(message, type = 'success') {
            const notification = document.createElement('div');
            notification.className = \`notification \${type}\`;
            notification.textContent = message;
            document.body.appendChild(notification);

            setTimeout(() => notification.classList.add('show'), 10);
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => notification.remove(), 300);
            }, 3000);
        }

        function updateTimestamp() {
            const now = new Date();
            const timeStr = now.toLocaleTimeString();
            document.getElementById('lastUpdated').textContent = timeStr;
        }

        async function loadSwaggerSpec() {
            const timestamp = Date.now();
            const url = \`/api-docs/swagger.json?t=\${timestamp}\`;

            try {
                const response = await fetch(url, {
                    cache: 'no-cache',
                    headers: {
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache'
                    }
                });

                if (!response.ok) {
                    throw new Error(\`HTTP \${response.status}\`);
                }

                const spec = await response.json();
                return spec;
            } catch (error) {
                console.error('Failed to load swagger spec:', error);
                throw error;
            }
        }

        async function initSwagger(showMessage = true) {
            const loadingOverlay = document.getElementById('loadingOverlay');
            loadingOverlay.classList.add('active');

            try {
                const spec = await loadSwaggerSpec();

                if (ui) {
                    ui.specActions.updateSpec(spec);
                    showMessage && showNotification('✅ Documentation refreshed!', 'success');
                } else {
                    ui = SwaggerUIBundle({
                        spec: spec,
                        dom_id: '#swagger-ui',
                        deepLinking: true,
                        presets: [
                            SwaggerUIBundle.presets.apis,
                            SwaggerUIStandalonePreset
                        ],
                        plugins: [
                            SwaggerUIBundle.plugins.DownloadUrl
                        ],
                        layout: 'StandaloneLayout',
                        validatorUrl: null,
                        docExpansion: 'list',
                        filter: true,
                        displayRequestDuration: true,
                        defaultModelsExpandDepth: 1,
                        defaultModelExpandDepth: 1,
                        tryItOutEnabled: true,
                        persistAuthorization: true
                    });
                }

                updateTimestamp();
                showMessage && showNotification('✅ Documentation loaded successfully!', 'success');
            } catch (error) {
                console.error('Error loading swagger:', error);
                showNotification('❌ Failed to load documentation. Make sure server is running.', 'error');
            } finally {
                loadingOverlay.classList.remove('active');
            }
        }

        async function refreshDocumentation() {
            const btn = document.getElementById('refreshBtn');
            btn.classList.add('spinning');

            showNotification('🔄 Refreshing documentation...', 'warning');

            if ('caches' in window) {
                const cacheNames = await caches.keys();
                await Promise.all(cacheNames.map(name => caches.delete(name)));
            }

            localStorage.clear();
            sessionStorage.clear();

            await initSwagger(true);

            btn.classList.remove('spinning');
        }

        document.addEventListener('DOMContentLoaded', () => {
            initSwagger(false);

            const refreshBtn = document.getElementById('refreshBtn');
            refreshBtn.addEventListener('click', refreshDocumentation);

            document.addEventListener('keydown', (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
                    e.preventDefault();
                    refreshDocumentation();
                }
            });

            updateTimestamp();
        });
    </script>
</body>
</html>`;

        const htmlPath = path.join(this.publicDir, 'index.html');
        await fsPromises.writeFile(htmlPath, htmlContent);
        console.log(`✅ Saved: ${htmlPath}`);
    }
}

// CLI interface
async function main() {
    const args = process.argv.slice(2);
    const appPath = args[0] || '.';

    const options = {};
    for (let i = 1; i < args.length; i++) {
        if (args[i] === '--port' && args[i + 1]) {
            options.port = parseInt(args[i + 1]);
            i++;
        } else if (args[i] === '--host' && args[i + 1]) {
            options.host = args[i + 1];
            i++;
        } else if (args[i] === '--project-name' && args[i + 1]) {
            options.projectName = args[i + 1];
            i++;
        } else if (args[i] === '--api-base-path' && args[i + 1]) {
            options.apiBasePath = args[i + 1];
            i++;
        }
    }

    const generator = new SwaggerGenerator(appPath, options);

    try {
        await generator.run();
        process.exit(0);
    } catch (error) {
        console.error('❌ Failed to generate documentation:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = SwaggerGenerator;